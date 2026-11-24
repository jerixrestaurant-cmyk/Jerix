require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const app = express();

// 1. STRIPE WEBHOOK — Must come BEFORE express.json()
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orderRef = db.collection('orders').doc(session.id);
    const existing = await orderRef.get();

    if (!existing.exists) {
      let parsedItems = [];
      try {
        parsedItems = JSON.parse(session.metadata?.items || '[]');
      } catch (e) {
        parsedItems = [];
      }

      const totalEuros = typeof session.amount_total === 'number'
        ? Number((session.amount_total / 100).toFixed(2))
        : 0;

      await orderRef.set({
        stripeSessionId: session.id,
        userId: session.metadata?.userId || 'guest',
        customerName: session.metadata?.customerName || 'Client',
        customerEmail: session.metadata?.customerEmail || session.customer_details?.email || '',
        deliveryAddress: session.metadata?.deliveryAddress || '',
        deliveryPhone: session.metadata?.deliveryPhone || '',
        items: parsedItems,
        totalAmount: totalEuros,
        currency: session.currency || 'eur',
        paymentMethod: 'card',
        paymentStatus: 'Paid',
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  }

  res.status(200).json({ received: true });
});

// 2. STANDARD MIDDLEWARE
const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : true
}));
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// 3. CREATE STRIPE CHECKOUT SESSION
app.post('/create-checkout-session', async (req, res) => {
  try {
    const {
      userId,
      customerName,
      customerEmail,
      deliveryAddress,
      deliveryPhone,
      items
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Panier vide ou invalide.' });
    }

    const line_items = items.map((item) => {
      const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
      const unitPrice = parseFloat(item.unitPrice ?? item.price ?? 0) || 0;
      const unitAmountCents = Math.round(unitPrice * 100);

      if (unitAmountCents <= 0) {
        throw new Error(`Prix invalide pour l'article : ${item.name || 'Produit'}`);
      }

      const suffix = item.type === 'meal' ? ' (Formule Menu)' : '';

      return {
        price_data: {
          currency: 'eur',
          product_data: {
            name: `${item.name || 'Produit'}${suffix}`
          },
          unit_amount: unitAmountCents
        },
        quantity: qty
      };
    });

    const compactItems = items.map((i) => ({
      name: i.name,
      type: i.type || null,
      quantity: parseInt(i.quantity, 10) || 1,
      unitPrice: Number((parseFloat(i.unitPrice ?? i.price ?? 0) || 0).toFixed(2))
    }));

    const baseFrontendUrl = allowedOrigins[0] || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: customerEmail || undefined,
      line_items,
      metadata: {
        userId: String(userId || 'guest').slice(0, 100),
        customerName: String(customerName || '').slice(0, 150),
        customerEmail: String(customerEmail || '').slice(0, 150),
        deliveryAddress: String(deliveryAddress || '').slice(0, 250),
        deliveryPhone: String(deliveryPhone || '').slice(0, 50),
        items: JSON.stringify(compactItems).slice(0, 490)
      },
      success_url: `${baseFrontendUrl}/index.html?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseFrontendUrl}/payment.html?payment=cancelled`
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Error creating Stripe checkout session:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Jerix backend listening on port ${PORT}`);
});
