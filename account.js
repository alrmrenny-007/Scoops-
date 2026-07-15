import {
  supabase, signIn, signUp, signOut, getCurrentUser,
  fetchProfile, upsertProfile, fetchMyOrders
} from './supabase-client.js';

const money = (n) => '₦' + n.toLocaleString('en-NG');
const STATUS_LABELS = { pending: 'Order received', preparing: 'Preparing', out_for_delivery: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled' };

const authScreen = document.getElementById('authScreen');
const accountScreen = document.getElementById('accountScreen');
let currentUser = null;
let currentProfile = null;
let authMode = 'login';

/* ============ BOOT ============ */
async function boot() {
  if (!supabase) {
    document.getElementById('authError').hidden = false;
    document.getElementById('authError').textContent = 'Connect Supabase first — see supabase-client.js.';
    return;
  }
  currentUser = await getCurrentUser();
  if (currentUser) {
    currentProfile = await fetchProfile(currentUser.id);
    showAccount();
  }
}

function showAccount() {
  authScreen.hidden = true;
  accountScreen.hidden = false;
  document.getElementById('accountEmail').textContent = currentUser.email;
  document.getElementById('profileName').value = currentProfile?.name || '';
  document.getElementById('profilePhone').value = currentProfile?.phone || '';
  document.getElementById('profileAddress').value = currentProfile?.default_address || '';
  loadOrderHistory();
}

/* ============ AUTH FORM ============ */
document.getElementById('authToggleMode').addEventListener('click', () => {
  authMode = authMode === 'login' ? 'signup' : 'login';
  document.getElementById('authTitle').textContent = authMode === 'login' ? 'Log in' : 'Sign up';
  document.getElementById('authSubmit').textContent = authMode === 'login' ? 'Log in' : 'Sign up';
  document.getElementById('authToggleMode').textContent =
    authMode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in';
  document.getElementById('authError').hidden = true;
});

document.getElementById('authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!supabase) return;
  const errEl = document.getElementById('authError');
  errEl.hidden = true;

  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const { data, error } = authMode === 'login' ? await signIn(email, password) : await signUp(email, password);

  if (error) {
    errEl.hidden = false;
    errEl.textContent = error.message || 'Something went wrong.';
    return;
  }

  currentUser = data.user;
  currentProfile = currentUser ? await fetchProfile(currentUser.id) : null;
  showAccount();
});

/* ============ TABS ============ */
document.querySelectorAll('.admin-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('is-active'));
    tab.classList.add('is-active');
    const target = tab.dataset.tab;
    document.getElementById('detailsPanel').hidden = target !== 'details';
    document.getElementById('historyPanel').hidden = target !== 'history';
    if (target === 'history') loadOrderHistory();
  });
});

/* ============ PROFILE ============ */
document.getElementById('profileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return;
  const profile = {
    name: document.getElementById('profileName').value.trim(),
    phone: document.getElementById('profilePhone').value.trim(),
    default_address: document.getElementById('profileAddress').value.trim()
  };
  const { data, error } = await upsertProfile(currentUser.id, profile);
  const savedEl = document.getElementById('profileSaved');
  if (error) {
    savedEl.hidden = false; savedEl.textContent = 'Could not save — try again.';
    return;
  }
  currentProfile = data;
  savedEl.hidden = false; savedEl.textContent = 'Saved ✓';
  setTimeout(() => { savedEl.hidden = true; }, 2000);
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await signOut();
  currentUser = null;
  currentProfile = null;
  accountScreen.hidden = true;
  authScreen.hidden = false;
});

/* ============ ORDER HISTORY ============ */
async function loadOrderHistory() {
  const list = document.getElementById('orderHistoryList');
  list.innerHTML = `<p class="cart-empty">Loading your orders…</p>`;

  const orders = await fetchMyOrders(currentUser.id);
  if (!orders || !orders.length) {
    list.innerHTML = `<p class="cart-empty">No orders yet. Once you check out, they'll show up here.</p>`;
    return;
  }

  const STATUS_STEPS = ['pending', 'preparing', 'out_for_delivery', 'delivered'];
  list.innerHTML = orders.map(o => {
    const stepIndex = STATUS_STEPS.indexOf(o.status);
    const time = new Date(o.created_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
    const items = (o.items || []).map(i => `${i.qty}× ${i.name}${i.size ? ' (' + i.size + ')' : ''}`).join(', ');
    return `
      <div class="order-card">
        <div class="order-card__top">
          <span class="order-card__id">#${o.id}</span>
          <span class="order-card__time">${time}</span>
        </div>
        <div class="order-card__items">${items}</div>
        <div class="order-card__total">${money(o.total)}</div>
        <span class="status-pill" data-status="${o.status}">${STATUS_LABELS[o.status] || o.status}</span>
        ${o.status !== 'cancelled' ? `
          <div class="status-track">
            ${STATUS_STEPS.map((s, i) => `<span class="status-track__seg ${i <= stepIndex ? 'is-filled' : ''}"></span>`).join('')}
          </div>` : ''}
      </div>
    `;
  }).join('');
}

boot();
