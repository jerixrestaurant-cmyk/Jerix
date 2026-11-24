// Replace with your live Render Web Service URL once deployed
const RENDER_BACKEND_URL = "https://jerix.onrender.com";

var cart = JSON.parse(localStorage.getItem("jerix_cart")) || [];

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

    // Floating Checkout Box Toggle
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

function addToCart(productName, productPrice, itemType = null) {
    const validPrice = typeof productPrice === "number" && !isNaN(productPrice) ? productPrice : 0;
    
    // Sync global cart variable directly
    cart = JSON.parse(localStorage.getItem("jerix_cart")) || [];
    
    const existingIndex = cart.findIndex(item => item.name === productName && item.type === itemType);

    if (existingIndex > -1) {
        cart[existingIndex].quantity = (cart[existingIndex].quantity || 1) + 1;
    } else {
        cart.push({
            name: productName,
            price: validPrice,
            type: itemType,
            quantity: 1
        });
    }

    localStorage.setItem("jerix_cart", JSON.stringify(cart));
    updateCartUI();
}

function updateCartUI() {
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

// 3. Stripe Checkout Redirect via Render Backend
async function checkoutWithStripe() {
    if (!cart || cart.length === 0) {
        alert("Votre panier est vide !");
        return;
    }

    try {
        const response = await fetch(`${RENDER_BACKEND_URL}/create-checkout-session`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                items: cart,
                customerName: localStorage.getItem("jerix_user_name") || "Client",
                customerPhone: localStorage.getItem("jerix_user_phone") || "",
                customerAddress: localStorage.getItem("jerix_user_address") || ""
            })
        });

        const data = await response.json();
        if (data.url) {
            window.location.href = data.url;
        } else {
            console.error("Stripe session error:", data.error);
            alert("Erreur lors de la création du paiement.");
        }
    } catch (err) {
        console.error("Network error connecting to Render:", err);
        alert("Impossible de contacter le serveur de paiement.");
    }
}

// 4. User Auth State LocalStorage Sync
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
