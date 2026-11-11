// State
let menuItems = [];
let categories = [];
let cart = [];
let selectedCategory = "All";
let appliedCoupon = null;
let orderType = "Dine In";
let paymentMethod = "Cash";
let lastCreatedOrderId = null;

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  formatCurrentDate();
  setupNavigation();
  setupCartOrderTypes();
  setupPaymentMethods();
  setupSearch();
  loadMenu();
});

// Format top header date
function formatCurrentDate() {
  const options = { month: 'long', day: 'numeric', year: 'numeric' };
  const today = new Date().toLocaleDateString('en-US', options);
  const el = document.getElementById("current-date");
  if (el) el.innerText = today;
}

// Navigation between views
function setupNavigation() {
  const navBtns = document.querySelectorAll(".nav-btn[data-view]");
  navBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const view = btn.getAttribute("data-view");
      switchView(view);
      navBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });
}

function switchView(viewName) {
  document.querySelectorAll(".view-panel").forEach(p => p.classList.remove("active"));
  const target = document.getElementById(`view-${viewName}`);
  if (target) {
    target.classList.add("active");
  }

  if (viewName === "history") {
    loadOrderHistory();
  } else if (viewName === "admin") {
    loadAdminData();
  } else if (viewName === "report") {
    loadSalesReport();
  }
}

// ----------------- MENU & CATEGORIES -----------------
async function loadMenu() {
  try {
    const res = await fetch("/api/menu");
    const data = await res.json();
    if (data.success) {
      menuItems = data.data;
      categories = ["All", ...data.categories.filter(c => c !== "All")];
      renderCategories();
      renderMenu(menuItems);
      updateRecommendations();
    }
  } catch (err) {
    showToast("Error loading menu: " + err.message);
  }
}

function renderCategories() {
  const container = document.getElementById("categories-bar");
  container.innerHTML = "";

  categories.forEach(cat => {
    const btn = document.createElement("button");
    btn.className = `category-pill ${cat === selectedCategory ? 'active' : ''}`;
    btn.innerText = cat;
    btn.onclick = () => {
      selectedCategory = cat;
      renderCategories();
      filterMenu();
    };
    container.appendChild(btn);
  });

  const resetBtn = document.getElementById("reset-filter-btn");
  if (resetBtn) {
    resetBtn.onclick = () => {
      selectedCategory = "All";
      document.getElementById("search-input").value = "";
      renderCategories();
      renderMenu(menuItems);
    };
  }
}

function setupSearch() {
  const input = document.getElementById("search-input");
  const clearBtn = document.getElementById("clear-search-btn");
  const popularBtn = document.getElementById("filter-popular-btn");

  input.addEventListener("input", () => {
    clearBtn.style.display = input.value.trim() ? "block" : "none";
    filterMenu();
  });

  clearBtn.addEventListener("click", () => {
    input.value = "";
    clearBtn.style.display = "none";
    filterMenu();
  });

  let popularFilterActive = false;
  popularBtn.addEventListener("click", () => {
    popularFilterActive = !popularFilterActive;
    popularBtn.classList.toggle("active", popularFilterActive);
    filterMenu(popularFilterActive);
  });
}

function filterMenu(onlyPopular = false) {
  const search = document.getElementById("search-input").value.trim().toLowerCase();
  let filtered = menuItems;

  if (selectedCategory && selectedCategory !== "All") {
    filtered = filtered.filter(item => item.category.toLowerCase() === selectedCategory.toLowerCase());
  }

  if (search) {
    filtered = filtered.filter(item =>
      item.name.toLowerCase().includes(search) ||
      item.description.toLowerCase().includes(search)
    );
  }

  if (onlyPopular) {
    filtered = filtered.filter(item => item.is_popular);
  }

  renderMenu(filtered);
}

function renderMenu(items) {
  const grid = document.getElementById("food-grid");
  grid.innerHTML = "";

  if (items.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
        <i class="fa-solid fa-utensils" style="font-size: 32px; margin-bottom: 12px; display: block;"></i>
        <p>No food dishes found matching your criteria.</p>
      </div>`;
    return;
  }

  items.forEach(dish => {
    const card = document.createElement("div");
    card.className = "food-card";
    card.innerHTML = `
      <button class="favorite-btn" title="Add to Favorites" onclick="toggleFavorite(this)">
        <i class="fa-regular fa-heart"></i>
      </button>
      <div class="dish-image-wrapper">
        <img src="${dish.image}" alt="${dish.name}" class="dish-img" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80'">
      </div>
      <div class="dish-header-row">
        <span class="dish-title">${dish.name}</span>
        <span class="dish-price">$${dish.price.toFixed(2)}</span>
      </div>
      <p class="dish-desc">${dish.description || 'Fresh ingredients and savory seasoning.'}</p>
      <div class="dish-footer-row">
        <div class="rating-badge">
          <i class="fa-solid fa-star"></i>
          <span>${dish.rating ? dish.rating.toFixed(1) : '5.0'}</span>
        </div>
        <button class="add-cart-btn" onclick="addToCart(${dish.id})">
          Add to cart
        </button>
      </div>
    `;
    grid.appendChild(card);
  });
}

function toggleFavorite(btn) {
  btn.classList.toggle("active");
  const icon = btn.querySelector("i");
  if (btn.classList.contains("active")) {
    icon.classList.remove("fa-regular");
    icon.classList.add("fa-solid");
  } else {
    icon.classList.remove("fa-solid");
    icon.classList.add("fa-regular");
  }
}

// ----------------- CART & BILLING -----------------
function setupCartOrderTypes() {
  const btns = document.querySelectorAll(".order-type-btn");
  btns.forEach(btn => {
    btn.addEventListener("click", () => {
      btns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      orderType = btn.getAttribute("data-type");
    });
  });
}

function setupPaymentMethods() {
  const btns = document.querySelectorAll(".payment-btn");
  btns.forEach(btn => {
    btn.addEventListener("click", () => {
      btns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      paymentMethod = btn.getAttribute("data-payment");
    });
  });
}

function addToCart(itemId, variant = "Regular") {
  const dish = menuItems.find(i => i.id === itemId);
  if (!dish) return;

  const existing = cart.find(ci => ci.id === itemId && ci.variant === variant);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      id: dish.id,
      name: dish.name,
      price: dish.price,
      quantity: 1,
      variant: variant,
      image: dish.image
    });
  }

  showToast(`Added ${dish.name} to cart`);
  renderCart();
  updateRecommendations();
}

function updateCartQty(index, change) {
  if (!cart[index]) return;
  cart[index].quantity += change;
  if (cart[index].quantity <= 0) {
    cart.splice(index, 1);
  }
  renderCart();
  updateRecommendations();
}

function removeFromCart(index) {
  cart.splice(index, 1);
  renderCart();
  updateRecommendations();
}

function calculateBill() {
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  let discount = 0.0;

  if (appliedCoupon) {
    if (appliedCoupon.type === "fixed") {
      discount = Math.min(appliedCoupon.value, subtotal);
    } else if (appliedCoupon.type === "percent") {
      discount = parseFloat((subtotal * (appliedCoupon.value / 100.0)).toFixed(2));
    }
  }

  const total = Math.max(0, subtotal - discount);

  return {
    subtotal: subtotal,
    discount: discount,
    total: total
  };
}

function renderCart() {
  const container = document.getElementById("cart-items-list");
  const subtotalEl = document.getElementById("summary-subtotal");
  const discountRow = document.getElementById("summary-discount-row");
  const discountEl = document.getElementById("summary-discount");
  const totalEl = document.getElementById("summary-total");

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="empty-cart-message">
        <i class="fa-solid fa-basket-shopping"></i>
        <p>Your order is empty.<br>Choose delicious dishes from the menu!</p>
      </div>`;
    subtotalEl.innerText = "$0.00";
    discountRow.style.display = "none";
    totalEl.innerText = "$0.00";
    return;
  }

  container.innerHTML = "";
  cart.forEach((item, index) => {
    const itemEl = document.createElement("div");
    itemEl.className = "cart-item";
    itemEl.innerHTML = `
      <img src="${item.image}" alt="${item.name}" class="cart-item-img" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80'">
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-sub">${item.variant}</div>
        <div class="cart-item-price">$${(item.price * item.quantity).toFixed(2)}</div>
      </div>
      <div class="qty-control">
        <button class="qty-btn" onclick="updateCartQty(${index}, -1)">-</button>
        <span class="qty-val">${String(item.quantity).padStart(2, '0')}</span>
        <button class="qty-btn" onclick="updateCartQty(${index}, 1)">+</button>
      </div>
      <button class="delete-item-btn" onclick="removeFromCart(${index})" title="Remove item">
        <i class="fa-regular fa-trash-can"></i>
      </button>
    `;
    container.appendChild(itemEl);
  });

  const bill = calculateBill();
  subtotalEl.innerText = `$${bill.subtotal.toFixed(2)}`;

  if (bill.discount > 0) {
    discountRow.style.display = "flex";
    discountEl.innerText = `-$${bill.discount.toFixed(2)}`;
    document.getElementById("applied-coupon-tag").innerText = `(${appliedCoupon.code})`;
  } else {
    discountRow.style.display = "none";
  }

  totalEl.innerText = `$${bill.total.toFixed(2)}`;
}

// ----------------- COUPONS -----------------
async function applyCouponCode() {
  const code = document.getElementById("coupon-code-input").value.trim().toUpperCase();
  const feedback = document.getElementById("coupon-feedback");

  if (!code) {
    feedback.innerText = "Please enter a code (e.g. WELCOME, SAVE10)";
    feedback.className = "coupon-feedback error";
    return;
  }

  const bill = calculateBill();
  if (bill.subtotal <= 0) {
    feedback.innerText = "Add items to your cart before applying coupons.";
    feedback.className = "coupon-feedback error";
    return;
  }

  try {
    const res = await fetch("/api/coupons/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code, subtotal: bill.subtotal })
    });
    const data = await res.json();

    if (data.success) {
      appliedCoupon = {
        code: data.coupon_code,
        discount: data.discount,
        value: code === "WELCOME" ? 3 : (code === "SAVE10" ? 10 : 20),
        type: code === "WELCOME" ? "fixed" : "percent"
      };
      feedback.innerText = data.message;
      feedback.className = "coupon-feedback success";
      renderCart();
      showToast("Coupon applied!");
    } else {
      appliedCoupon = null;
      feedback.innerText = data.message;
      feedback.className = "coupon-feedback error";
      renderCart();
    }
  } catch (err) {
    feedback.innerText = "Failed to apply coupon";
    feedback.className = "coupon-feedback error";
  }
}

// ----------------- BONUS: RECOMMENDATIONS -----------------
async function updateRecommendations() {
  const cartIds = cart.map(i => i.id).join(",");
  const recBox = document.getElementById("recommendations-box");
  const recRow = document.getElementById("rec-items-row");
  const recReason = document.getElementById("rec-reason");

  try {
    const res = await fetch(`/api/recommendations?cart=${cartIds}`);
    const data = await res.json();

    if (data.success && data.recommendations && data.recommendations.length > 0) {
      recBox.style.display = "block";
      recReason.innerText = data.reason;
      recRow.innerHTML = "";

      data.recommendations.forEach(dish => {
        const div = document.createElement("div");
        div.className = "rec-card";
        div.innerHTML = `
          <img src="${dish.image}" alt="${dish.name}" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80'">
          <div class="rec-info">
            <div class="rec-name" title="${dish.name}">${dish.name}</div>
            <div class="rec-price">$${dish.price.toFixed(2)}</div>
          </div>
          <button class="rec-add-btn" onclick="addToCart(${dish.id})" title="Add recommended item">
            <i class="fa-solid fa-plus"></i>
          </button>
        `;
        recRow.appendChild(div);
      });
    } else {
      recBox.style.display = "none";
    }
  } catch (err) {
    recBox.style.display = "none";
  }
}

// ----------------- PLACE ORDER -----------------
async function checkoutOrder() {
  if (cart.length === 0) {
    showToast("Please add items to your cart first!");
    return;
  }

  const customerName = document.getElementById("customer-name-input").value.trim() || "Table 4";
  const couponCode = appliedCoupon ? appliedCoupon.code : "";

  const payload = {
    customer_name: customerName,
    order_type: orderType,
    payment_method: paymentMethod,
    items: cart,
    coupon_code: couponCode
  };

  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      const order = data.data;
      lastCreatedOrderId = order.id;

      // Show success modal
      document.getElementById("success-order-id").innerText = order.id;
      document.getElementById("success-order-summary").innerText =
        `${order.customer_name} • ${order.order_type} • Paid via ${order.payment_method} • Total: $${order.total.toFixed(2)}`;
      document.getElementById("success-modal").classList.add("active");

      // Reset cart and coupon
      cart = [];
      appliedCoupon = null;
      document.getElementById("coupon-code-input").value = "";
      document.getElementById("coupon-feedback").innerText = "";
      renderCart();
      updateRecommendations();
    } else {
      showToast(data.message || "Failed to place order");
    }
  } catch (err) {
    showToast("Error placing order: " + err.message);
  }
}

function closeSuccessModal() {
  document.getElementById("success-modal").classList.remove("active");
}

function trackCreatedOrder() {
  closeSuccessModal();
  switchView("tracking");
  const navBtns = document.querySelectorAll(".nav-btn[data-view]");
  navBtns.forEach(b => b.classList.remove("active"));
  document.querySelector(".nav-btn[data-view='tracking']").classList.add("active");

  if (lastCreatedOrderId) {
    document.getElementById("track-id-input").value = lastCreatedOrderId;
    fetchAndDisplayTracking(lastCreatedOrderId);
  }
}

// ----------------- LIVE ORDER TRACKING -----------------
function trackOrderFromInput() {
  const orderId = document.getElementById("track-id-input").value.trim();
  if (!orderId) {
    showToast("Please enter an Order ID");
    return;
  }
  fetchAndDisplayTracking(orderId);
}

async function fetchAndDisplayTracking(orderId) {
  const container = document.getElementById("tracking-card-container");
  container.innerHTML = `<div style="text-align:center; padding: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> Fetching status...</div>`;

  try {
    const res = await fetch(`/api/orders/${orderId}`);
    const data = await res.json();

    if (!data.success) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-circle-exclamation" style="color: #ef4444;"></i>
          <p>Order "${orderId}" was not found. Please verify the ID.</p>
        </div>`;
      return;
    }

    const order = data.data;
    const stages = ["Pending", "Preparing", "Ready", "Completed"];
    const currentIdx = stages.indexOf(order.status);
    const progressWidth = currentIdx >= 0 ? (currentIdx / (stages.length - 1)) * 100 : 0;

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 16px;">
        <div>
          <span class="status-badge ${order.status.toLowerCase()}">${order.status}</span>
          <h2 style="font-size: 20px; font-weight: 800; margin-top: 6px;">Order #${order.id}</h2>
          <p style="font-size: 13px; color: var(--text-muted);">${order.customer_name} • ${order.order_type} • ${order.created_at.replace('T', ' ')}</p>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 13px; color: var(--text-muted);">Total Paid</div>
          <div style="font-size: 22px; font-weight: 800; color: var(--primary);">$${order.total.toFixed(2)}</div>
        </div>
      </div>

      <div class="tracking-stepper">
        <div class="step-progress-bar" style="width: calc(${progressWidth}% - 60px);"></div>
        ${stages.map((st, idx) => {
          const isDone = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const cls = isCurrent ? 'active' : (isDone ? 'completed' : '');
          const icon = idx === 0 ? 'fa-clipboard-check' : (idx === 1 ? 'fa-fire-burner' : (idx === 2 ? 'fa-bell-concierge' : 'fa-check'));
          return `
            <div class="step-item ${cls}">
              <div class="step-circle"><i class="fa-solid ${icon}"></i></div>
              <span class="step-label">${st}</span>
            </div>
          `;
        }).join('')}
      </div>

      <div class="tracking-details">
        <h4 style="font-size: 14px; font-weight: 700; margin-bottom: 10px;">Ordered Items</h4>
        <ul style="list-style: none; display: flex; flex-direction: column; gap: 8px;">
          ${order.items.map(it => `
            <li style="display: flex; justify-content: space-between; font-size: 13px;">
              <span><strong>${it.quantity}x</strong> ${it.name} <small style="color:var(--text-muted);">(${it.variant})</small></span>
              <span>$${(it.price * it.quantity).toFixed(2)}</span>
            </li>
          `).join('')}
        </ul>
        ${order.discount > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 13px; color: #10b981; margin-top: 10px; border-top: 1px dashed var(--border); padding-top: 8px;">
            <span>Discount Applied (${order.coupon_code})</span>
            <span>-$${order.discount.toFixed(2)}</span>
          </div>
        ` : ''}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Error retrieving tracking information.</p></div>`;
  }
}

// ----------------- ORDER HISTORY -----------------
async function loadOrderHistory() {
  const tbody = document.getElementById("orders-history-body");
  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</td></tr>`;

  try {
    const res = await fetch("/api/orders");
    const data = await res.json();

    if (!data.success || data.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 24px; color: var(--text-muted);">No orders found.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    data.data.forEach(order => {
      const tr = document.createElement("tr");
      const itemsText = order.items.map(i => `${i.quantity}x ${i.name}`).join(", ");
      tr.innerHTML = `
        <td><strong>#${order.id}</strong></td>
        <td>${order.customer_name}</td>
        <td><span style="font-weight:600;">${order.order_type}</span></td>
        <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${itemsText}">${itemsText}</td>
        <td><strong>$${order.total.toFixed(2)}</strong></td>
        <td><span class="status-badge ${order.status.toLowerCase()}">${order.status}</span></td>
        <td>${order.created_at.replace('T', ' ')}</td>
        <td>
          <button class="btn-secondary" style="padding: 4px 10px; font-size: 11px;" onclick="trackSpecificOrder('${order.id}')">
            Track
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: red;">Error loading orders</td></tr>`;
  }
}

function trackSpecificOrder(orderId) {
  switchView("tracking");
  document.querySelectorAll(".nav-btn[data-view]").forEach(b => b.classList.remove("active"));
  document.querySelector(".nav-btn[data-view='tracking']").classList.add("active");
  document.getElementById("track-id-input").value = orderId;
  fetchAndDisplayTracking(orderId);
}

// ----------------- ADMIN MANAGEMENT -----------------
function switchAdminTab(tab, btn) {
  document.querySelectorAll(".admin-tab-content").forEach(c => c.classList.remove("active"));
  document.querySelectorAll(".admin-tabs .tab-btn").forEach(b => b.classList.remove("active"));
  document.getElementById(`tab-${tab}`).classList.add("active");
  btn.classList.add("active");
}

async function loadAdminData() {
  await loadAdminFoodGrid();
  await loadAdminOrdersList();
}

async function loadAdminFoodGrid() {
  const container = document.getElementById("admin-food-grid");
  container.innerHTML = `<div style="padding: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading dishes...</div>`;

  try {
    const res = await fetch("/api/menu");
    const data = await res.json();

    if (data.success) {
      container.innerHTML = "";
      data.data.forEach(dish => {
        const div = document.createElement("div");
        div.className = "admin-card";
        div.innerHTML = `
          <img src="${dish.image}" alt="${dish.name}" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80'">
          <div class="admin-card-info">
            <h4 style="font-size: 14px; font-weight: 700;">${dish.name}</h4>
            <div style="font-size: 12px; color: var(--text-muted);">${dish.category} • $${dish.price.toFixed(2)}</div>
            <div style="font-size: 11px; color: #f59e0b; margin-top: 2px;">⭐ ${dish.rating.toFixed(1)}</div>
          </div>
          <div class="admin-card-actions">
            <button class="btn-secondary" style="padding: 6px 10px; font-size: 12px;" onclick="openEditDishModal(${dish.id})">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn-secondary" style="padding: 6px 10px; font-size: 12px; color: #ef4444;" onclick="deleteDish(${dish.id})">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        `;
        container.appendChild(div);
      });
    }
  } catch (err) {
    container.innerHTML = `<div style="color: red;">Error loading dishes</div>`;
  }
}

async function loadAdminOrdersList() {
  const tbody = document.getElementById("admin-orders-body");
  tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading orders...</td></tr>`;

  try {
    const res = await fetch("/api/orders");
    const data = await res.json();

    if (!data.success || data.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px;">No orders found.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    data.data.forEach(order => {
      const tr = document.createElement("tr");
      const summary = order.items.map(i => `${i.quantity}x ${i.name}`).join(", ");
      tr.innerHTML = `
        <td><strong>#${order.id}</strong></td>
        <td>${order.customer_name}</td>
        <td>${order.order_type}</td>
        <td style="max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${summary}">${summary}</td>
        <td><strong>$${order.total.toFixed(2)}</strong></td>
        <td><span class="status-badge ${order.status.toLowerCase()}">${order.status}</span></td>
        <td>
          <select onchange="updateOrderStatus('${order.id}', this.value)" style="padding: 4px 8px; border-radius: 6px; border: 1px solid var(--border); font-size: 12px;">
            <option value="Pending" ${order.status === 'Pending' ? 'selected' : ''}>Pending</option>
            <option value="Preparing" ${order.status === 'Preparing' ? 'selected' : ''}>Preparing</option>
            <option value="Ready" ${order.status === 'Ready' ? 'selected' : ''}>Ready</option>
            <option value="Completed" ${order.status === 'Completed' ? 'selected' : ''}>Completed</option>
            <option value="Cancelled" ${order.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="color: red; text-align: center;">Error loading orders</td></tr>`;
  }
}

async function updateOrderStatus(orderId, newStatus) {
  try {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Order #${orderId} status updated to ${newStatus}`);
      loadAdminOrdersList();
    } else {
      showToast(data.message || "Failed to update status");
    }
  } catch (err) {
    showToast("Error updating order status");
  }
}

// Admin Add / Edit Modal
function openAddDishModal() {
  document.getElementById("modal-dish-title").innerText = "Add New Food Item";
  document.getElementById("dish-id").value = "";
  document.getElementById("dish-name").value = "";
  document.getElementById("dish-category").value = "Pizza";
  document.getElementById("dish-price").value = "";
  document.getElementById("dish-desc").value = "";
  document.getElementById("dish-image").value = "";
  document.getElementById("dish-rating").value = "5.0";
  document.getElementById("dish-modal").classList.add("active");
}

function openEditDishModal(dishId) {
  const dish = menuItems.find(d => d.id === dishId);
  if (!dish) return;

  document.getElementById("modal-dish-title").innerText = "Edit Food Item";
  document.getElementById("dish-id").value = dish.id;
  document.getElementById("dish-name").value = dish.name;
  document.getElementById("dish-category").value = dish.category;
  document.getElementById("dish-price").value = dish.price;
  document.getElementById("dish-desc").value = dish.description || "";
  document.getElementById("dish-image").value = dish.image || "";
  document.getElementById("dish-rating").value = dish.rating || "5.0";
  document.getElementById("dish-modal").classList.add("active");
}

function closeDishModal() {
  document.getElementById("dish-modal").classList.remove("active");
}

async function handleDishSubmit(e) {
  e.preventDefault();
  const id = document.getElementById("dish-id").value;
  const name = document.getElementById("dish-name").value.trim();
  const category = document.getElementById("dish-category").value;
  const price = parseFloat(document.getElementById("dish-price").value);
  const description = document.getElementById("dish-desc").value.trim();
  const image = document.getElementById("dish-image").value.trim();
  const rating = parseFloat(document.getElementById("dish-rating").value);

  const payload = { name, category, price, description, image, rating };

  try {
    let res;
    if (id) {
      res = await fetch(`/api/menu/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } else {
      res = await fetch("/api/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    }

    const data = await res.json();
    if (data.success) {
      showToast(id ? "Dish updated successfully!" : "New dish created successfully!");
      closeDishModal();
      await loadMenu();
      await loadAdminFoodGrid();
    } else {
      showToast(data.message || "Failed to save dish");
    }
  } catch (err) {
    showToast("Error saving dish: " + err.message);
  }
}

async function deleteDish(dishId) {
  if (!confirm("Are you sure you want to delete this food item from the menu?")) return;

  try {
    const res = await fetch(`/api/menu/${dishId}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      showToast("Dish deleted successfully!");
      await loadMenu();
      await loadAdminFoodGrid();
    } else {
      showToast(data.message || "Failed to delete dish");
    }
  } catch (err) {
    showToast("Error deleting dish");
  }
}

// ----------------- DAILY SALES REPORT -----------------
async function loadSalesReport() {
  try {
    const res = await fetch("/api/reports/daily");
    const data = await res.json();

    if (data.success) {
      document.getElementById("stat-orders-today").innerText = data.total_orders_today;
      document.getElementById("stat-revenue-today").innerText = `$${data.total_revenue_today.toFixed(2)}`;
      document.getElementById("stat-revenue-all").innerText = `$${data.total_revenue_all_time.toFixed(2)}`;
      document.getElementById("stat-orders-all").innerText = data.total_orders_all_time;

      // Top selling items
      const topList = document.getElementById("top-items-list");
      topList.innerHTML = "";
      if (data.top_selling_items.length === 0) {
        topList.innerHTML = `<li style="color:var(--text-muted); font-size: 13px;">No item sales recorded yet.</li>`;
      } else {
        data.top_selling_items.forEach((it, idx) => {
          const li = document.createElement("li");
          li.className = "top-item-row";
          li.innerHTML = `
            <span>#${idx + 1} <strong>${it.name}</strong></span>
            <span style="color: var(--accent);">${it.quantity} orders</span>
          `;
          topList.appendChild(li);
        });
      }

      // Breakdown lists
      const breakdownBox = document.getElementById("report-breakdowns");
      breakdownBox.innerHTML = `
        <div style="font-weight: 700; font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">ORDER TYPES</div>
        ${Object.entries(data.order_types).map(([k, v]) => `
          <div class="breakdown-row">
            <span>${k}</span>
            <strong>${v} orders</strong>
          </div>
        `).join('')}
        <div style="font-weight: 700; font-size: 12px; color: var(--text-muted); margin: 12px 0 4px;">PAYMENT METHODS</div>
        ${Object.entries(data.payment_methods).map(([k, v]) => `
          <div class="breakdown-row">
            <span>${k}</span>
            <strong>${v} transactions</strong>
          </div>
        `).join('')}
      `;
    }
  } catch (err) {
    showToast("Error generating sales report");
  }
}

// ----------------- UTILITIES -----------------
function showToast(msg) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.innerText = msg;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}
