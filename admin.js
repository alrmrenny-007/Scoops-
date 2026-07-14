import {
  supabase, signIn, signOut, getCurrentUser, fetchProfile,
  fetchAllOrders, updateOrderStatus, fetchDishes, toggleDishAvailability
} from './supabase-client.js';

const money = (n) => '₦' + n.toLocaleString('en-NG');
const STATUS_FLOW = ['pending', 'preparing', 'out_for_delivery', 'delivered'];
const STATUS_LABELS = { pending: 'Order received', preparing: 'Preparing', out_for_delivery: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled' };
const NEXT_LABEL = { pending: 'Start preparing', preparing: 'Mark out for delivery', out_for_delivery: 'Mark delivered' };

const loginScreen = document.getElementById('loginScreen');
const dashboard = document.getElementById('dashboard');
let pollTimer = null;

/* ============ AUTH GATE ============ */
async function boot() {
  if (!supabase) {
    document.getElementById('loginError').hidden = false;
    document.getElementById('loginError').textContent = 'Connect Supabase first — see supabase-client.js.';
    return;
  }
  const user = await getCurrentUser();
  if (!user) return; // show login screen (default state)

  const profile = await fetchProfile(user.id);
  if (!profile?.is_staff) {
    await signOut();
    document.getElementById('loginError').hidden = false;
    document.getElementById('loginError').textContent = 'This account is not a staff account.';
    return;
  }

  showDashboard();
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('loginError');
  errEl.hidden = true;

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const { data, error } = await signIn(email, password);

  if (error) {
    errEl.hidden = false; errEl.textContent = error.message || 'Login failed.';
    return;
  }

  const profile = await fetchProfile(data.user.id);
  if (!profile?.is_staff) {
    await signOut();
    errEl.hidden = false; errEl.textContent = 'This account is not a staff account.';
    return;
  }

  showDashboard();
});

document.getElementById('logoutBtnAdmin').addEventListener('click', async () => {
  await signOut();
  clearInterval(pollTimer);
  dashboard.hidden = true;
  loginScreen.hidden = false;
});

function showDashboard() {
  loginScreen.hidden = true;
  dashboard.hidden = false;
  loadOrders();
  loadMenu();
  pollTimer = setInterval(loadOrders, 20000); // light polling refresh
}

/* ============ TABS ============ */
document.querySelectorAll('.admin-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('is-active'));
    tab.classList.add('is-active');
    const target = tab.dataset.tab;
    document.getElementById('ordersPanel').hidden = target !== 'orders';
    document.getElementById('menuPanel').hidden = target !== 'menu';
  });
});

/* ============ ORDERS ============ */
async function loadOrders() {
  const orders = await fetchAllOrders();
  renderOrders(orders ?? []);
}

function renderOrders(orders) {
  const list = document.getElementById('adminOrdersList');
  if (!orders.length) {
    list.innerHTML = `<p class="cart-empty">No orders yet.</p>`;
    return;
  }
  list.innerHTML = orders.map(o => {
    const time = new Date(o.created_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
    const items = (o.items || []).map(i => `${i.qty}× ${i.name}${i.size ? ' (' + i.size + ')' : ''}`).join(', ');
    const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(o.status) + 1];
    const isDone = o.status === 'delivered' || o.status === 'cancelled';

    return `
      <div class="manage-card">
        <div class="manage-card__top">
          <span class="manage-card__id">#${o.id} · ${STATUS_LABELS[o.status] || o.status}</span>
          <span class="manage-card__time">${time}</span>
        </div>
        <div class="manage-card__customer">${o.customer_name || 'Guest'}</div>
        <div class="manage-card__contact">${o.phone || '—'} · ${o.delivery_type === 'pickup' ? 'Pickup' : (o.address || 'Delivery — no address given')}</div>
        <div class="manage-card__items">${items}</div>
        ${o.notes ? `<div class="manage-card__notes">Note: ${o.notes}</div>` : ''}
        <div class="manage-card__total">${money(o.total)}</div>
        <div class="manage-card__actions">
          ${nextStatus ? `<button class="status-btn" data-advance="${o.id}" data-next="${nextStatus}">${NEXT_LABEL[o.status]}</button>` : ''}
          ${!isDone ? `<button class="status-btn status-btn--cancel" data-cancel="${o.id}">Cancel order</button>` : ''}
        </div>
      </div>
    `;
  }).join('');

  list.querySelectorAll('[data-advance]').forEach(btn => {
    btn.addEventListener('click', () => setStatus(Number(btn.dataset.advance), btn.dataset.next));
  });
  list.querySelectorAll('[data-cancel]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Cancel this order?')) setStatus(Number(btn.dataset.cancel), 'cancelled');
    });
  });
}

async function setStatus(orderId, status) {
  const { error } = await updateOrderStatus(orderId, status);
  if (error) { alert('Could not update order: ' + error.message); return; }
  loadOrders();
}

document.getElementById('refreshOrders').addEventListener('click', loadOrders);

/* ============ MENU AVAILABILITY ============ */
async function loadMenu() {
  const dishes = await fetchDishes();
  renderMenu(dishes ?? []);
}

function renderMenu(dishes) {
  const list = document.getElementById('adminMenuList');
  if (!dishes.length) {
    list.innerHTML = `<p class="cart-empty">No dishes found — connect Supabase and run schema.sql.</p>`;
    return;
  }

  let lastCategory = null;
  list.innerHTML = dishes.map(d => {
    const catHeader = d.category !== lastCategory ? `<div class="cat-group-label">${d.category}</div>` : '';
    lastCategory = d.category;
    const checked = d.is_available !== false ? 'checked' : '';
    return `
      ${catHeader}
      <div class="menu-row">
        <div>
          <div class="menu-row__name">${d.name}</div>
          <div class="menu-row__cat">${d.is_available !== false ? 'Available' : 'Sold out'}</div>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" data-dish="${d.id}" ${checked}>
          <span class="toggle-switch__track"><span class="toggle-switch__thumb"></span></span>
        </label>
      </div>
    `;
  }).join('');

  list.querySelectorAll('[data-dish]').forEach(input => {
    input.addEventListener('change', async () => {
      const { error } = await toggleDishAvailability(Number(input.dataset.dish), input.checked);
      if (error) { alert('Could not update: ' + error.message); input.checked = !input.checked; return; }
      loadMenu();
    });
  });
}

boot();
