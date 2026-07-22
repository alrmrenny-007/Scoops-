import {
  supabase, signIn, signOut, getCurrentUser, fetchProfile,
  fetchAllOrders, updateOrderStatus, deleteOrder, clearDeliveredOrders,
  fetchDishes, toggleDishAvailability, updateDishImage, createDish, updateDish, deleteDish,
  fetchAllProfiles, savePushSubscription,
  fetchDeliveryZones, createDeliveryZone, updateDeliveryZone, deleteDeliveryZone
} from './supabase-client.js';

const VAPID_PUBLIC_KEY = 'BI5LOaH6Ckd7X2OkZSMuqFNo4CTpi-fNVGzOCpl-Gkro93tFWXpwz4JSvZjdaytsThMxuXLrj99kGSiXSF1clMc';

const money = (n) => '₦' + n.toLocaleString('en-NG');
const STATUS_FLOW = ['pending', 'preparing', 'out_for_delivery', 'delivered'];
const STATUS_LABELS = { pending: 'Order received', preparing: 'Preparing', out_for_delivery: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled' };
const NEXT_LABEL = { pending: 'Start preparing', preparing: 'Mark out for delivery', out_for_delivery: 'Mark delivered' };

const loginScreen = document.getElementById('loginScreen');
const dashboard = document.getElementById('dashboard');
let pollTimer = null;
let allDishes = []; // cached for the dish edit form
let currentStaffUser = null;

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

  currentStaffUser = user;
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

  currentStaffUser = data.user;
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
  pollTimer = setInterval(loadOrders, 20000); // light polling refresh (backup for push)
  initPushUI();
  listenForNewOrders();
}

/* ============ PUSH NOTIFICATIONS ============ */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

async function initPushUI() {
  const btn = document.getElementById('enableAlertsBtn');
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    btn.title = 'Push not supported on this browser';
    btn.disabled = true;
    return;
  }
  // If already subscribed, quietly confirm the subscription is saved (no re-prompt).
  if (Notification.permission === 'granted') {
    const reg = await navigator.serviceWorker.register('/sw.js');
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      btn.textContent = '🔔';
      btn.title = 'Order alerts enabled';
      await savePushSubscription(currentStaffUser.id, sub.toJSON());
      return;
    }
  }
  btn.addEventListener('click', enablePushNotifications);
}

async function enablePushNotifications() {
  const btn = document.getElementById('enableAlertsBtn');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    alert('Notification permission was not granted — you can still see live updates while this tab is open.');
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
    const { error } = await savePushSubscription(currentStaffUser.id, sub.toJSON());
    if (error) { alert('Could not save subscription: ' + error.message); return; }
    btn.textContent = '🔔';
    btn.title = 'Order alerts enabled';
  } catch (err) {
    alert('Could not enable push notifications: ' + err.message);
  }
}

/* ============ LIVE UPDATES WHILE DASHBOARD IS OPEN ============ */
function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine'; osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(); osc.stop(ctx.currentTime + 0.6);
  } catch (e) { /* audio not available — ignore */ }
}

function listenForNewOrders() {
  if (!supabase) return;
  supabase
    .channel('admin-orders-listen')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
      playAlertSound();
      if (Notification.permission === 'granted') {
        new Notification('New order received!', {
          body: `Order #${payload.new.id} — ${money(payload.new.total)} from ${payload.new.customer_name || 'a guest'}`
        });
      }
      loadOrders();
    })
    .subscribe();
}

/* ============ TABS ============ */
document.querySelectorAll('.admin-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('is-active'));
    tab.classList.add('is-active');
    const target = tab.dataset.tab;
    document.getElementById('ordersPanel').hidden = target !== 'orders';
    document.getElementById('menuPanel').hidden = target !== 'menu';
    document.getElementById('customersPanel').hidden = target !== 'customers';
    document.getElementById('salesPanel').hidden = target !== 'sales';
    document.getElementById('deliveryPanel').hidden = target !== 'delivery';

    if (target === 'customers') loadCustomers();
    if (target === 'sales') loadSales();
    if (target === 'delivery') loadZones();
  });
});

/* ============ ORDERS ============ */
async function loadOrders() {
  const orders = await fetchAllOrders();
  renderOrders(orders ?? []);
}

function paymentBadge(o) {
  if (o.payment_method !== 'online') return `<span class="status-pill" data-status="pending" style="margin-left:6px;">Pay on delivery</span>`;
  if (o.payment_status === 'paid') return `<span class="status-pill" data-status="delivered" style="margin-left:6px;">✓ Paid online</span>`;
  if (o.payment_status === 'failed') return `<span class="status-pill" data-status="out_for_delivery" style="margin-left:6px;">Payment failed</span>`;
  return `<span class="status-pill" data-status="pending" style="margin-left:6px;">Payment pending</span>`;
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
        <div class="manage-card__total">${money(o.total)} ${paymentBadge(o)}</div>
        <div class="manage-card__actions">
          ${nextStatus ? `<button class="status-btn" data-advance="${o.id}" data-next="${nextStatus}">${NEXT_LABEL[o.status]}</button>` : ''}
          ${!isDone ? `<button class="status-btn status-btn--cancel" data-cancel="${o.id}">Cancel order</button>` : ''}
          <button class="status-btn status-btn--cancel" data-delete-order="${o.id}">Delete</button>
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
  list.querySelectorAll('[data-delete-order]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Permanently delete this order? This cannot be undone.')) return;
      const { error } = await deleteOrder(Number(btn.dataset.deleteOrder));
      if (error) { alert('Could not delete: ' + error.message); return; }
      loadOrders();
    });
  });
}

async function setStatus(orderId, status) {
  const { error } = await updateOrderStatus(orderId, status);
  if (error) { alert('Could not update order: ' + error.message); return; }
  loadOrders();
}

document.getElementById('refreshOrders').addEventListener('click', loadOrders);

/* ============ INSTALL APP (PWA) ============ */
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (!window.matchMedia('(display-mode: standalone)').matches) {
    document.getElementById('installBtnAdmin').hidden = false;
  }
});

document.getElementById('installBtnAdmin').addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  document.getElementById('installBtnAdmin').hidden = true;
});

window.addEventListener('appinstalled', () => {
  document.getElementById('installBtnAdmin').hidden = true;
});

/* ============ MENU: AVAILABILITY, PHOTOS, CRUD ============ */
async function loadMenu() {
  const dishes = await fetchDishes();
  allDishes = dishes ?? [];
  renderMenu(allDishes);
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
    const thumb = d.image_url
      ? `<img class="menu-row__thumb" src="${d.image_url}" alt="">`
      : `<div class="menu-row__thumb menu-row__thumb--empty">🍽️</div>`;
    return `
      ${catHeader}
      <div class="menu-row">
        <div class="menu-row__top">
          ${thumb}
          <div class="menu-row__info">
            <div class="menu-row__name">${d.name}</div>
            <div class="menu-row__cat">${d.is_available !== false ? 'Available' : 'Sold out'}</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" data-dish="${d.id}" ${checked}>
            <span class="toggle-switch__track"><span class="toggle-switch__thumb"></span></span>
          </label>
        </div>
        <div class="menu-row__photo">
          <input type="url" class="photo-input" data-photo-for="${d.id}" placeholder="Paste photo URL…" value="${d.image_url || ''}">
          <button class="status-btn" data-save-photo="${d.id}">Save</button>
        </div>
        <p class="photo-hint">Link must point directly to an image file (.jpg/.png) — not a Google Photos/Drive share page.</p>
        <p class="photo-warning" id="warn-${d.id}" hidden>⚠️ Couldn't load this link as an image — double-check it's a direct image URL.</p>
        <div class="menu-row__actions">
          <button class="status-btn" data-edit-dish="${d.id}">Edit</button>
          <button class="status-btn status-btn--cancel" data-delete-dish="${d.id}">Delete</button>
        </div>
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

  // Live-test the pasted URL so a broken link is obvious before Save is even tapped.
  list.querySelectorAll('.photo-input').forEach(input => {
    let debounceTimer;
    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      const dishId = input.dataset.photoFor;
      const warn = document.getElementById(`warn-${dishId}`);
      warn.hidden = true;
      const url = input.value.trim();
      if (!url) return;
      debounceTimer = setTimeout(() => {
        const probe = new Image();
        probe.onload = () => { warn.hidden = true; };
        probe.onerror = () => { warn.hidden = false; };
        probe.src = url;
      }, 500);
    });
  });

  list.querySelectorAll('[data-save-photo]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const dishId = Number(btn.dataset.savePhoto);
      const input = list.querySelector(`[data-photo-for="${dishId}"]`);
      const originalText = btn.textContent;
      btn.textContent = 'Saving…'; btn.disabled = true;
      const { error } = await updateDishImage(dishId, input.value.trim());
      btn.disabled = false;
      if (error) { alert('Could not save photo: ' + error.message); btn.textContent = originalText; return; }
      loadMenu();
    });
  });

  list.querySelectorAll('[data-edit-dish]').forEach(btn => {
    btn.addEventListener('click', () => openDishForm(Number(btn.dataset.editDish)));
  });

  list.querySelectorAll('[data-delete-dish]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const dish = allDishes.find(d => d.id === Number(btn.dataset.deleteDish));
      if (!confirm(`Delete "${dish?.name}" from the menu? This cannot be undone.`)) return;
      const { error } = await deleteDish(Number(btn.dataset.deleteDish));
      if (error) { alert('Could not delete: ' + error.message); return; }
      loadMenu();
    });
  });
}

/* ============ DISH ADD/EDIT FORM ============ */
const dishFormDrawer = document.getElementById('dishFormDrawer');
const dishFormScrim = document.getElementById('dishFormScrim');
const dishForm = document.getElementById('dishForm');
const dfHasSizes = document.getElementById('dfHasSizes');
const dfSingleBlock = document.getElementById('dfSingleBlock');
const dfSizesBlock = document.getElementById('dfSizesBlock');
const dfSizeRows = document.getElementById('dfSizeRows');
let editingDishId = null;

function openDishForm(dishId = null) {
  editingDishId = dishId;
  document.getElementById('dfError').hidden = true;
  dishForm.reset();
  dfSizeRows.innerHTML = '';

  if (dishId) {
    const dish = allDishes.find(d => d.id === dishId);
    document.getElementById('dishFormTitle').textContent = 'Edit dish';
    document.getElementById('dfName').value = dish.name || '';
    document.getElementById('dfCategory').value = dish.category || '';
    document.getElementById('dfDesc').value = dish.desc || '';
    document.getElementById('dfIngredients').value = dish.ingredients || '';
    document.getElementById('dfPrepTime').value = dish.prep_time || '';
    document.getElementById('dfCalories').value = dish.calories ?? '';
    document.getElementById('dfInstructions').value = dish.instructions || '';
    if (dish.sizes && dish.sizes.length) {
      dfHasSizes.checked = true;
      dish.sizes.forEach(s => addSizeRow(s.label, s.price));
    } else {
      dfHasSizes.checked = false;
      document.getElementById('dfPrice').value = dish.price ?? '';
    }
  } else {
    document.getElementById('dishFormTitle').textContent = 'Add dish';
    addSizeRow('', '');
  }

  toggleSizeBlocks();
  dishFormDrawer.classList.add('is-open');
  dishFormScrim.classList.add('is-open');
}

function closeDishForm() {
  dishFormDrawer.classList.remove('is-open');
  dishFormScrim.classList.remove('is-open');
}

function toggleSizeBlocks() {
  dfSingleBlock.hidden = dfHasSizes.checked;
  dfSizesBlock.hidden = !dfHasSizes.checked;
}
dfHasSizes.addEventListener('change', toggleSizeBlocks);

function addSizeRow(label = '', price = '') {
  const row = document.createElement('div');
  row.className = 'size-row';
  row.innerHTML = `
    <input type="text" class="size-row__label" placeholder="e.g. Small" value="${label}">
    <input type="number" class="size-row__price" placeholder="Price" min="0" value="${price}">
    <button type="button" class="size-row__remove" aria-label="Remove size">✕</button>
  `;
  row.querySelector('.size-row__remove').addEventListener('click', () => row.remove());
  dfSizeRows.appendChild(row);
}

document.getElementById('dfAddSize').addEventListener('click', () => addSizeRow());
document.getElementById('addDishBtn').addEventListener('click', () => openDishForm(null));
document.getElementById('closeDishForm').addEventListener('click', closeDishForm);
dishFormScrim.addEventListener('click', closeDishForm);

dishForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('dfError');
  errEl.hidden = true;

  const name = document.getElementById('dfName').value.trim();
  const category = document.getElementById('dfCategory').value.trim().toLowerCase();
  const desc = document.getElementById('dfDesc').value.trim();

  let price = null;
  let sizes = null;

  if (dfHasSizes.checked) {
    sizes = Array.from(dfSizeRows.querySelectorAll('.size-row')).map(row => ({
      label: row.querySelector('.size-row__label').value.trim(),
      price: Number(row.querySelector('.size-row__price').value)
    })).filter(s => s.label && !isNaN(s.price) && s.price >= 0);

    if (!sizes.length) {
      errEl.hidden = false; errEl.textContent = 'Add at least one size option with a label and price.';
      return;
    }
  } else {
    price = Number(document.getElementById('dfPrice').value);
    if (isNaN(price) || price < 0) {
      errEl.hidden = false; errEl.textContent = 'Enter a valid price.';
      return;
    }
  }

  const dish = {
    name, category, desc, price, sizes,
    ingredients: document.getElementById('dfIngredients').value.trim() || null,
    prep_time: document.getElementById('dfPrepTime').value.trim() || null,
    instructions: document.getElementById('dfInstructions').value.trim() || null,
    calories: document.getElementById('dfCalories').value ? Number(document.getElementById('dfCalories').value) : null
  };
  const saveBtn = document.getElementById('dfSaveBtn');
  saveBtn.disabled = true; saveBtn.textContent = 'Saving…';

  const { error } = editingDishId ? await updateDish(editingDishId, dish) : await createDish(dish);

  saveBtn.disabled = false; saveBtn.textContent = 'Save dish';

  if (error) {
    errEl.hidden = false; errEl.textContent = error.message || 'Could not save this dish.';
    return;
  }

  closeDishForm();
  loadMenu();
});

/* ============ CUSTOMERS ============ */
async function loadCustomers() {
  const list = document.getElementById('customersList');
  list.innerHTML = `<p class="cart-empty">Loading…</p>`;

  const profiles = await fetchAllProfiles();
  if (!profiles) {
    list.innerHTML = `<p class="cart-empty">Could not load customers.</p>`;
    document.getElementById('customerCount').textContent = '—';
    return;
  }

  const withEmail = profiles.filter(p => p.email);
  document.getElementById('customerCount').textContent = `${withEmail.length} signed-up customer${withEmail.length === 1 ? '' : 's'}`;

  if (!withEmail.length) {
    list.innerHTML = `<p class="cart-empty">No customers have signed up yet.</p>`;
    return;
  }

  list.innerHTML = withEmail.map(p => {
    const joined = new Date(p.created_at).toLocaleDateString('en-NG', { dateStyle: 'medium' });
    return `
      <div class="customer-card">
        <div class="customer-card__email">${p.email}</div>
        <div class="customer-card__meta">${p.name || 'No name saved'} · ${p.phone || 'No phone'}</div>
        <div class="customer-card__meta">Joined ${joined}${p.is_staff ? ' · Staff' : ''}</div>
      </div>
    `;
  }).join('');
}

/* ============ SALES ============ */
async function loadSales() {
  document.getElementById('salesWeek').textContent = '…';
  document.getElementById('salesMonth').textContent = '…';
  document.getElementById('salesAll').textContent = '…';

  const orders = await fetchAllOrders();
  const delivered = (orders ?? []).filter(o => o.status === 'delivered');

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  let weekTotal = 0, monthTotal = 0, allTotal = 0;
  delivered.forEach(o => {
    const created = new Date(o.created_at);
    allTotal += o.total;
    if (created >= startOfMonth) monthTotal += o.total;
    if (created >= startOfWeek) weekTotal += o.total;
  });

  document.getElementById('salesWeek').textContent = money(weekTotal);
  document.getElementById('salesMonth').textContent = money(monthTotal);
  document.getElementById('salesAll').textContent = money(allTotal);

  renderBestSellers(delivered);
}

function renderBestSellers(delivered) {
  const list = document.getElementById('bestSellersList');
  const tally = {}; // name -> { qty, revenue }

  delivered.forEach(o => {
    (o.items || []).forEach(item => {
      const key = item.name + (item.size ? ` (${item.size})` : '');
      if (!tally[key]) tally[key] = { qty: 0, revenue: 0 };
      tally[key].qty += item.qty;
      tally[key].revenue += item.qty * item.price;
    });
  });

  const ranked = Object.entries(tally).sort((a, b) => b[1].qty - a[1].qty).slice(0, 5);

  if (!ranked.length) {
    list.innerHTML = `<p class="cart-empty">No delivered orders yet — best sellers will show up once you have sales history.</p>`;
    return;
  }

  list.innerHTML = ranked.map(([name, stats], i) => `
    <div class="manage-card">
      <div class="manage-card__top">
        <span class="manage-card__id">#${i + 1} · ${name}</span>
      </div>
      <div class="manage-card__items">${stats.qty} sold · ${money(stats.revenue)} in revenue</div>
    </div>
  `).join('');
}

document.getElementById('clearDeliveredBtn').addEventListener('click', async () => {
  if (!confirm('Permanently delete every order marked "Delivered"? This cannot be undone and will reset your sales totals to zero.')) return;
  const { error } = await clearDeliveredOrders();
  if (error) { alert('Could not clear orders: ' + error.message); return; }
  loadSales();
  loadOrders();
});

/* ============ DELIVERY ZONES ============ */
let allZones = [];
let editingZoneId = null;

async function loadZones() {
  allZones = (await fetchDeliveryZones()) || [];
  renderZones();
}

function renderZones() {
  const list = document.getElementById('zonesList');
  if (!allZones.length) {
    list.innerHTML = `<p class="cart-empty">No delivery zones yet — add one so customers can pick it at checkout.</p>`;
    return;
  }
  list.innerHTML = allZones.map(z => `
    <div class="manage-card">
      <div class="manage-card__top">
        <span class="manage-card__id">${z.name}</span>
        <span class="manage-card__time">${money(z.fee)}</span>
      </div>
      <div class="manage-card__actions">
        <button class="status-btn" data-edit-zone="${z.id}">Edit</button>
        <button class="status-btn status-btn--cancel" data-delete-zone="${z.id}">Delete</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('[data-edit-zone]').forEach(btn => {
    btn.addEventListener('click', () => openZoneForm(Number(btn.dataset.editZone)));
  });
  list.querySelectorAll('[data-delete-zone]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this delivery zone?')) return;
      const { error } = await deleteDeliveryZone(Number(btn.dataset.deleteZone));
      if (error) { alert('Could not delete: ' + error.message); return; }
      loadZones();
    });
  });
}

function openZoneForm(zoneId) {
  editingZoneId = zoneId || null;
  document.getElementById('zfError').hidden = true;
  document.getElementById('zoneForm').reset();
  document.getElementById('zfDeleteBtn').hidden = !zoneId;

  if (zoneId) {
    const zone = allZones.find(z => z.id === zoneId);
    document.getElementById('zoneFormTitle').textContent = 'Edit zone';
    document.getElementById('zfName').value = zone.name;
    document.getElementById('zfFee').value = zone.fee;
  } else {
    document.getElementById('zoneFormTitle').textContent = 'Add zone';
  }

  document.getElementById('zoneFormOverlay').hidden = false;
}

function closeZoneForm() {
  document.getElementById('zoneFormOverlay').hidden = true;
}

document.getElementById('addZoneBtn').addEventListener('click', () => openZoneForm(null));
document.getElementById('closeZoneForm').addEventListener('click', closeZoneForm);

document.getElementById('zoneForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const zone = {
    name: document.getElementById('zfName').value.trim(),
    fee: Number(document.getElementById('zfFee').value)
  };
  const errEl = document.getElementById('zfError');
  const saveBtn = document.getElementById('zfSaveBtn');
  saveBtn.disabled = true; saveBtn.textContent = 'Saving…';

  const { error } = editingZoneId ? await updateDeliveryZone(editingZoneId, zone) : await createDeliveryZone(zone);

  saveBtn.disabled = false; saveBtn.textContent = 'Save zone';

  if (error) {
    errEl.hidden = false; errEl.textContent = error.message || 'Could not save this zone.';
    return;
  }
  closeZoneForm();
  loadZones();
});

document.getElementById('zfDeleteBtn').addEventListener('click', async () => {
  if (!editingZoneId || !confirm('Delete this delivery zone?')) return;
  const { error } = await deleteDeliveryZone(editingZoneId);
  if (error) { alert('Could not delete: ' + error.message); return; }
  closeZoneForm();
  loadZones();
});

boot();
