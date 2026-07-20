import {
  supabase, signIn, signUp, signOut, getCurrentUser,
  fetchProfile, upsertProfile, fetchMyOrders, savePushSubscription
} from './supabase-client.js';

const VAPID_PUBLIC_KEY = 'BI5LOaH6Ckd7X2OkZSMuqFNo4CTpi-fNVGzOCpl-Gkro93tFWXpwz4JSvZjdaytsThMxuXLrj99kGSiXSF1clMc';

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
  initOrderAlertsUI();
}

/* ============ ORDER UPDATE PUSH NOTIFICATIONS ============ */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

async function initOrderAlertsUI() {
  const btn = document.getElementById('enableOrderAlertsBtn');
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    btn.hidden = true;
    return;
  }
  if (Notification.permission === 'granted') {
    const reg = await navigator.serviceWorker.register('/sw.js');
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      btn.textContent = '🔔 Order alerts enabled';
      await savePushSubscription(currentUser.id, sub.toJSON());
      return;
    }
  }
  btn.textContent = '🔕 Get notified when your order status changes';
}

document.getElementById('enableOrderAlertsBtn').addEventListener('click', async () => {
  const btn = document.getElementById('enableOrderAlertsBtn');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    alert('Notification permission was not granted.');
    return;
  }
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    const { error } = await savePushSubscription(currentUser.id, sub.toJSON());
    if (error) { alert('Could not save subscription: ' + error.message); return; }
    btn.textContent = '🔔 Order alerts enabled';
  } catch (err) {
    alert('Could not enable notifications: ' + err.message);
  }
});

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
  // Make sure the email is on record right away so this customer shows up
  // in the admin Customers list even if they never open "My details".
  if (currentUser) {
    const { data: profile } = await upsertProfile(currentUser.id, { email: currentUser.email });
    if (profile) currentProfile = profile;
  }
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
    email: currentUser.email,
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
        <button class="btn btn--primary" data-reorder="${o.id}" style="margin-top:12px; padding:9px 16px; font-size:.8rem; width:auto;">🔁 Order again</button>
      </div>
    `;
  }).join('');

  list.querySelectorAll('[data-reorder]').forEach(btn => {
    btn.addEventListener('click', () => {
      const order = orders.find(o => String(o.id) === btn.dataset.reorder);
      if (!order) return;
      // main.js (on index.html) owns the live menu data and cart, so hand off
      // the items to reorder via localStorage and let it pick them up on load.
      localStorage.setItem('scoops_reorder_items', JSON.stringify(order.items));
      window.location.href = 'index.html';
    });
  });
}

boot();
