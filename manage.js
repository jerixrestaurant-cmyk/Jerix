const firebaseConfig = {
    apiKey: "AIzaSyAFGnXNg51y82dtNVIR5Yd_JWYK1Aty5Yw",
    authDomain: "jerixrestaurant-12a9b.firebaseapp.com",
    projectId: "jerixrestaurant-12a9b",
    storageBucket: "jerixrestaurant-12a9b.firebasestorage.app",
    messagingSenderId: "347378956164",
    appId: "1:347378956164:web:af66d148cd20b417124fd1",
    measurementId: "G-CE02CK78XQ"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentCategoryFilter = 'All';
let allProductsCache = [];
let allCategoriesCache = [];
let salesChartInstance = null;
let ordersChartInstance = null;

// 1. Admin Authentication Check
auth.onAuthStateChanged((user) => {
    if (user) {
        db.collection("users").doc(user.uid).get().then((doc) => {
            if (doc.exists && doc.data().role === 'admin') {
                document.getElementById('adminContent').style.display = 'block';
                initCharts();
                loadCategoriesAndMenu();
                loadAnalyticsData();
            } else {
                alert("Accès refusé. Réservé aux administrateurs.");
                window.location.href = 'index.html';
            }
        }).catch((error) => {
            console.error("Error verifying admin role:", error);
            window.location.href = 'index.html';
        });
    } else {
        window.location.href = 'auth.html';
    }
});

// 2. Initialize Charts
function initCharts() {
    const ctxSales = document.getElementById('salesBarChart').getContext('2d');
    salesChartInstance = new Chart(ctxSales, {
        type: 'bar',
        data: {
            labels: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'],
            datasets: [{
                label: 'Ventes (€)',
                data: [0, 0, 0, 0, 0, 0, 0],
                backgroundColor: '#ffd700',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { 
                    beginAtZero: true,
                    ticks: { color: '#aaa' }, 
                    grid: { color: '#333' } 
                },
                x: { ticks: { color: '#aaa' }, grid: { display: false } }
            }
        }
    });

    const ctxOrders = document.getElementById('ordersPieChart').getContext('2d');
    ordersChartInstance = new Chart(ctxOrders, {
        type: 'doughnut',
        data: {
            labels: ['Carte (Card)', 'Espèces (Cash)'],
            datasets: [{
                data: [0, 0],
                backgroundColor: ['#ffd700', '#ff4757'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#fff' } }
            }
        }
    });
}

// 2.5 Load Live Analytics Data from Firestore 'orders' collection
function loadAnalyticsData() {
    db.collection("orders").onSnapshot((snapshot) => {
        let dailySales = [0, 0, 0, 0, 0, 0, 0];
        let paymentMethods = { card: 0, cash: 0 };

        snapshot.forEach((doc) => {
            const order = doc.data();
            const total = parseFloat(order.total || order.amount || 0);
            
            if (order.createdAt && typeof order.createdAt.toDate === 'function') {
                const date = order.createdAt.toDate();
                let dayIndex = date.getDay();
                dayIndex = dayIndex === 0 ? 6 : dayIndex - 1;
                dailySales[dayIndex] += total;
            }

            const method = (order.paymentMethod || order.method || '').toLowerCase();
            if (method.includes('card') || method.includes('carte')) {
                paymentMethods.card += 1;
            } else if (method.includes('cash') || method.includes('especes') || method.includes('espèces')) {
                paymentMethods.cash += 1;
            }
        });

        if (salesChartInstance) {
            salesChartInstance.data.datasets[0].data = dailySales;
            salesChartInstance.update();
        }

        if (ordersChartInstance) {
            ordersChartInstance.data.datasets[0].data = [paymentMethods.card, paymentMethods.cash];
            ordersChartInstance.update();
        }
    }, (error) => {
        console.error("Erreur lors du chargement des analytiques :", error);
    });
}

// 3. Load Categories and Menu Products in Real-time from Firestore
const menuTableBody = document.getElementById('menuTableBody');
const addProductForm = document.getElementById('addProductForm');

function loadCategoriesAndMenu() {
    db.collection("categories").onSnapshot((snapshot) => {
        allCategoriesCache = [];
        snapshot.forEach((doc) => {
            allCategoriesCache.push({ id: doc.id, ...doc.data() });
        });
        renderAdminCategories();
        renderTable();
    });

    db.collection("menu").onSnapshot((snapshot) => {
        allProductsCache = [];
        snapshot.forEach((doc) => {
            allProductsCache.push({ id: doc.id, ...doc.data() });
        });
        renderTable();
    });
}

function renderAdminCategories() {
    const tabsContainer = document.getElementById('adminCategoryTabs');
    const selectDropdown = document.getElementById('productCategory');
    const categoryList = document.getElementById('categoryList');
    
    if (!tabsContainer || !selectDropdown) return;

    tabsContainer.innerHTML = `<button class="tab-btn ${currentCategoryFilter === 'All' ? 'active' : ''}" onclick="filterCategory('All', this)">Tous</button>`;
    selectDropdown.innerHTML = '';
    if (categoryList) categoryList.innerHTML = '';

    allCategoriesCache.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `tab-btn ${currentCategoryFilter === cat.name ? 'active' : ''}`;
        btn.textContent = cat.name;
        btn.onclick = (e) => filterCategory(cat.name, e.target);
        tabsContainer.appendChild(btn);

        const opt = document.createElement('option');
        opt.value = cat.name;
        opt.textContent = cat.name;
        selectDropdown.appendChild(opt);

        if (categoryList) {
            const chip = document.createElement('div');
            chip.style.cssText = "background:#1e1e1e; border:1px solid #444; padding:5px 10px; border-radius:4px; display:inline-flex; align-items:center; gap:8px;";
            chip.innerHTML = `<span>${cat.name}</span> <button class="btn-danger" style="padding:2px 6px; font-size:0.75em;" onclick="deleteCategory('${cat.id}')">X</button>`;
            categoryList.appendChild(chip);
        }
    });
}

window.filterCategory = function(category, btnElement) {
    currentCategoryFilter = category;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');
    renderTable();
};

function renderTable() {
    if (!menuTableBody) return;
    menuTableBody.innerHTML = "";
    const filteredProducts = currentCategoryFilter === 'All' 
        ? allProductsCache 
        : allProductsCache.filter(p => p.category === currentCategoryFilter);

    if (filteredProducts.length === 0) {
        menuTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #888;">Aucun produit trouvé dans cette catégorie.</td></tr>`;
        return;
    }

    filteredProducts.forEach((product) => {
        let categoryOptionsHTML = '';
        allCategoriesCache.forEach(cat => {
            const selected = product.category === cat.name ? 'selected' : '';
            categoryOptionsHTML += `<option value="${cat.name}" ${selected}>${cat.name}</option>`;
        });

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="${product.image || 'https://via.placeholder.com/45'}" class="product-thumb" alt="Preview" onerror="this.src='https://via.placeholder.com/45'">
                    <div style="flex-grow: 1;">
                        <input type="text" value="${product.name}" id="name-${product.id}" style="background:transparent; border:none; color:#fff; width:100%; margin-bottom:4px; font-weight:bold;">
                        <input type="text" value="${product.image || ''}" id="image-${product.id}" placeholder="URL image" style="background:#1e1e1e; border:1px solid #444; color:#aaa; font-size:0.8em; padding:2px 5px; width:100%;">
                    </div>
                </div>
            </td>
            <td>
                <select id="cat-${product.id}" style="background:#1e1e1e; border:1px solid #444; color:#fff; padding:4px;">
                    ${categoryOptionsHTML}
                </select>
            </td>
            <td><input type="number" step="0.01" value="${product.price}" id="price-${product.id}" style="background:transparent; border:none; color:#ffd700; width:80px; font-weight:bold;"> €</td>
            <td>
                <button class="btn btn-primary" style="padding:6px 10px; font-size:0.85em; margin-right:5px;" onclick="updateProduct('${product.id}')">Modifier</button>
                <button class="btn btn-danger" onclick="deleteProduct('${product.id}')">Supprimer</button>
            </td>
        `;
        menuTableBody.appendChild(tr);
    });
}

// Add New Category Handler
const addCategoryBtn = document.getElementById('addCategoryBtn');
if (addCategoryBtn) {
    addCategoryBtn.addEventListener('click', () => {
        const catNameInput = document.getElementById('newCategoryName');
        const catName = catNameInput.value.trim();
        if (!catName) return;

        db.collection("categories").add({
            name: catName
        }).then(() => {
            catNameInput.value = '';
            alert("Catégorie ajoutée avec succès !");
        }).catch((error) => {
            console.error("Erreur lors de l'ajout de la catégorie :", error);
        });
    });
}

window.deleteCategory = function(catId) {
    if (confirm("Voulez-vous vraiment supprimer cette catégorie ?")) {
        db.collection("categories").doc(catId).delete().catch((error) => {
            console.error("Erreur lors de la suppression de la catégorie :", error);
        });
    }
};

// Add New Product
addProductForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('productName').value.trim();
    const price = parseFloat(document.getElementById('productPrice').value);
    const category = document.getElementById('productCategory').value;
    const image = document.getElementById('productImage').value.trim();

    db.collection("menu").add({
        name: name,
        price: price,
        category: category,
        image: image,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        addProductForm.reset();
        alert("Produit ajouté avec succès !");
    }).catch((error) => {
        console.error("Erreur lors de l'ajout :", error);
    });
});

// Update Existing Product
window.updateProduct = function(id) {
    const updatedName = document.getElementById(`name-${id}`).value.trim();
    const updatedCategory = document.getElementById(`cat-${id}`).value;
    const updatedPrice = parseFloat(document.getElementById(`price-${id}`).value);
    const updatedImage = document.getElementById(`image-${id}`).value.trim();

    db.collection("menu").doc(id).update({
        name: updatedName,
        category: updatedCategory,
        price: updatedPrice,
        image: updatedImage
    }).then(() => {
        alert("Modifications enregistrées !");
    }).catch((error) => {
        console.error("Erreur lors de la mise à jour :", error);
    });
};

// Delete Product
window.deleteProduct = function(id) {
    if (confirm("Voulez-vous vraiment supprimer ce produit ?")) {
        db.collection("menu").doc(id).delete().catch((error) => {
            console.error("Erreur lors de la suppression :", error);
        });
    }
};