require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Example: Using the secret key securely
console.log("Stripe initialized securely.");

var cart = JSON.parse(localStorage.getItem("jerix_cart")) || [];


// At the top of script.js
if (typeof cart === "undefined") {
    var cart = JSON.parse(localStorage.getItem("jerix_cart")) || [];
} else {
    cart = JSON.parse(localStorage.getItem("jerix_cart")) || [];
}

document.addEventListener("DOMContentLoaded", () => {
    // Gallery Carousel Navigation
    const container = document.getElementById("galleryContainer");
    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");

    if (nextBtn && container) {
        nextBtn.addEventListener("click", () => {
            container.scrollBy({ left: container.clientWidth + 20, behavior: 'smooth' });
        });
    }

    if (prevBtn && container) {
        prevBtn.addEventListener("click", () => {
            container.scrollBy({ left: -(container.clientWidth + 20), behavior: 'smooth' });
        });
    }

    // Floating Checkout Box Toggle (Guarded against duplicate handlers in index.html)
    const toggleHeader = document.getElementById("checkoutBoxToggle");
    const boxContent = document.getElementById("checkoutBoxContent");

    if (toggleHeader && boxContent && !toggleHeader.dataset.listenerAttached) {
        toggleHeader.dataset.listenerAttached = "true";
        toggleHeader.addEventListener("click", () => {
            boxContent.style.display = (boxContent.style.display === "none" || boxContent.style.display === "") ? "block" : "none";
        });
    }

    // Refresh Cart UI on initial page load
    updateCartUI();
});

// 2. Global Cart Helper Functions
function clearCart() {
    cart = [];
    localStorage.removeItem("jerix_cart");
    updateCartUI();
}

function addToCart(productName, productPrice) {
    const validPrice = typeof productPrice === "number" && !isNaN(productPrice) ? productPrice : 0;
    
    // Get current cart from localStorage
    let currentCart = JSON.parse(localStorage.getItem("jerix_cart")) || [];
    
    // Check if item already exists
    const existingIndex = currentCart.findIndex(item => item.name === productName);

    if (existingIndex > -1) {
        currentCart[existingIndex].quantity = (currentCart[existingIndex].quantity || 1) + 1;
    } else {
        currentCart.push({
            name: productName,
            price: validPrice,
            quantity: 1
        });
    }

    // Save back to localStorage and update UI
    localStorage.setItem("jerix_cart", JSON.stringify(currentCart));
    
    if (typeof updateCartUI === "function") {
        updateCartUI();
    }
}

function updateCartUI() {
    // Filter out corrupted items missing a numeric price
    cart = cart.filter(item => typeof item.price === "number" && !isNaN(item.price));
    localStorage.setItem("jerix_cart", JSON.stringify(cart));

    const cartCountEl = document.getElementById("cartCount");
    const cartTotalEl = document.getElementById("cartTotal");
    const cartItemsList = document.getElementById("cartItemsList");

    let totalCount = 0;
    let totalPrice = 0;

    cart.forEach(item => {
        const qty = item.quantity || 1;
        totalCount += qty;
        totalPrice += item.price * qty;
    });

    if (cartCountEl) cartCountEl.textContent = totalCount;
    if (cartTotalEl) cartTotalEl.textContent = totalPrice.toFixed(2) + " €";

    if (cartItemsList) {
        if (cart.length === 0) {
            cartItemsList.innerHTML = `<p class="empty-cart-text">Votre panier est vide.</p>`;
        } else {
            cartItemsList.innerHTML = "";
            cart.forEach((item, index) => {
                const row = document.createElement("div");
                row.className = "cart-item-row";
                row.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #333; font-size: 0.9rem; color: #fff; cursor: pointer;";
                row.title = "Cliquez pour supprimer cet article";
                
                const label = item.type ? `${item.quantity}x ${item.name} (${item.type === 'meal' ? 'Menu' : 'Seul'})` : `${item.quantity}x ${item.name}`;
                
                row.innerHTML = `
                    <span class="cart-item-name">${label}</span>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="cart-item-price">${(item.price * item.quantity).toFixed(2)} €</span>
                        <span style="color: #ff4444; font-weight: bold;">✕</span>
                    </div>
                `;
                
                row.addEventListener("click", () => {
                    cart.splice(index, 1);
                    updateCartUI();
                });

                cartItemsList.appendChild(row);
            });
        }
    }
}

// 3. User Auth State LocalStorage Sync
if (typeof firebase !== "undefined" && firebase.auth) {
    firebase.auth().onAuthStateChanged((user) => {
        if (user && typeof db !== "undefined") {
            db.collection("users").doc(user.uid).get().then((doc) => {
                if (doc.exists) {
                    const data = doc.data();
                    localStorage.setItem("jerix_user_name", data.name || data.fullName || "Utilisateur");
                    localStorage.setItem("jerix_user_email", user.email);
                    if (data.address) localStorage.setItem("jerix_user_address", data.address);
                    if (data.phone) localStorage.setItem("jerix_user_phone", data.phone);
                }
            }).catch(err => console.error("Error fetching user data for local storage:", err));
        }
    });
}