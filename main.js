import {
  fetchDishes, fetchDeals, fetchBirthdayPackages, placeOrder,
  signUp, getCurrentUser,
  fetchProfile, upsertProfile, fetchMyOrders, supabase
} from './supabase-client.js';

const money = (n) => '₦' + n.toLocaleString('en-NG');

// Safe GSAP wrapper — animations degrade gracefully if the CDN script hasn't loaded yet.
const anim = (fn) => { if (typeof gsap !== 'undefined') fn(); };

/* ============ DEMO DATA — Scoops Chops & Drinks × Mr. Jollof ============ */
// Items with multiple sizes use `sizes: [{label, price}]`. Single-price items use `price`.
const DEMO_DISHES = [
  // SHAWARMA
  { id: 1, name: 'Beef Shawarma', category: 'shawarma', desc: 'Grilled beef, house sauce, warm wrap.', sizes: [{label:'Small',price:3000},{label:'Medium',price:3400},{label:'Big',price:3800}] },
  { id: 2, name: 'Chicken Shawarma', category: 'shawarma', desc: 'Grilled chicken, house sauce, warm wrap.', sizes: [{label:'Small',price:3000},{label:'Medium',price:3400},{label:'Big',price:3800}] },
  { id: 3, name: 'Coconut-Chicken Shawarma', category: 'shawarma', desc: 'Chicken with a coconut twist.', sizes: [{label:'Small',price:3000},{label:'Medium',price:3400},{label:'Big',price:3800}] },

  // PIZZA
  { id: 4, name: 'Beef Pizza', category: 'pizza', desc: 'Seasoned beef, mozzarella, tomato base.', sizes: [{label:'Small',price:9000},{label:'Medium',price:10000},{label:'Big',price:11000}] },
  { id: 5, name: 'Chicken Pizza', category: 'pizza', desc: 'Shredded chicken, mozzarella, tomato base.', sizes: [{label:'Small',price:9000},{label:'Medium',price:10000},{label:'Big',price:11000}] },
  { id: 6, name: 'Coconut-Chicken Pizza', category: 'pizza', desc: 'Chicken pizza with a coconut twist.', sizes: [{label:'Small',price:9000},{label:'Medium',price:10000},{label:'Big',price:11000}] },
  { id: 7, name: 'Pepperoni Pizza', category: 'pizza', desc: 'Classic pepperoni, mozzarella.', sizes: [{label:'Small',price:9000},{label:'Medium',price:10000},{label:'Big',price:11000}] },
  { id: 8, name: 'Margherita Pizza', category: 'pizza', desc: 'Basil, mozzarella, tomato base.', sizes: [{label:'Small',price:9000},{label:'Medium',price:10000},{label:'Big',price:11000}] },

  // BURGER
  { id: 9, name: 'Beef Burger', category: 'burger', desc: 'Beef patty, cheese, house sauce.', sizes: [{label:'Single',price:4500},{label:'Double',price:5500}] },
  { id: 10, name: 'Chicken Burger', category: 'burger', desc: 'Crispy chicken, cheese, house sauce.', sizes: [{label:'Single',price:4500},{label:'Double',price:5500}] },

  // FRIES & SIDES
  { id: 11, name: 'Yam Fries', category: 'sides', desc: 'Golden fried yam sticks.', price: 1000 },
  { id: 12, name: 'French Fries', category: 'sides', desc: 'Classic salted fries.', price: 1000 },
  { id: 13, name: 'Plantain Fries', category: 'sides', desc: 'Sweet fried plantain sticks.', price: 1000 },

  // MILKSHAKES
  { id: 14, name: 'Strawberry Milkshake', category: 'milkshake', desc: 'Blended thick and cold.', price: 4000 },
  { id: 15, name: 'Chocolate Milkshake', category: 'milkshake', desc: 'Blended thick and cold.', price: 4000 },
  { id: 16, name: 'Banana Milkshake', category: 'milkshake', desc: 'Blended thick and cold.', price: 4000 },
  { id: 17, name: 'Coconut Milkshake', category: 'milkshake', desc: 'Blended thick and cold.', price: 4000 },
  { id: 18, name: 'Vanilla Milkshake', category: 'milkshake', desc: 'Blended thick and cold.', price: 4000 },

  // ICE CREAM
  { id: 19, name: 'Strawberry Ice Cream', category: 'dessert', desc: 'Creamy scoop.', sizes: [{label:'Small',price:2000},{label:'Big',price:4000}] },
  { id: 20, name: 'Vanilla Ice Cream', category: 'dessert', desc: 'Creamy scoop.', sizes: [{label:'Small',price:2000},{label:'Big',price:4000}] },
  { id: 21, name: 'Mixed Ice Cream', category: 'dessert', desc: 'Creamy scoop.', sizes: [{label:'Small',price:2000},{label:'Big',price:4000}] },

  // SNACKS
  { id: 22, name: 'Meat Pie', category: 'snacks', desc: 'Flaky pastry, seasoned filling.', price: 1500 },
  { id: 23, name: 'Doughnut', category: 'snacks', desc: 'Soft and sweet.', price: 1000 },
  { id: 24, name: 'Beefwich', category: 'snacks', desc: 'Beef-filled pastry.', price: 2500 },

  // DRINKS
  { id: 25, name: 'Coke', category: 'drinks', desc: 'Chilled bottle.', price: 700 },
  { id: 26, name: 'Fanta', category: 'drinks', desc: 'Chilled bottle.', price: 700 },
  { id: 27, name: 'Sprite', category: 'drinks', desc: 'Chilled bottle.', price: 700 },
  { id: 28, name: 'Pepsi', category: 'drinks', desc: 'Chilled bottle.', price: 700 },
  { id: 29, name: 'Schweppes', category: 'drinks', desc: 'Chilled bottle.', price: 1000 },
  { id: 30, name: '5 Alive', category: 'drinks', desc: 'Fruit juice.', sizes: [{label:'Small',price:1000},{label:'Big',price:2500}] },
  { id: 31, name: 'Hollandia Yogurt', category: 'drinks', desc: 'Chilled yogurt drink.', sizes: [{label:'Small',price:1000},{label:'Big',price:2500}] },
  { id: 32, name: 'Exotic Drink', category: 'drinks', desc: 'Chilled fruit drink.', sizes: [{label:'Small',price:1000},{label:'Big',price:2500}] },
  { id: 33, name: 'Water', category: 'drinks', desc: 'Bottled water.', price: 400 },

  // RICE & SPAGHETTI
  { id: 34, name: 'Jollof Rice', category: 'rice', desc: 'The famous Mr. Jollof recipe.', price: 1300 },
  { id: 35, name: 'Fried Rice', category: 'rice', desc: 'Peppered, vegetable fried rice.', price: 1300 },
  { id: 36, name: 'Jollof Spaghetti', category: 'rice', desc: 'Spaghetti in smoky jollof sauce.', price: 1300 },

  // NOODLES
  { id: 37, name: 'Cooked / Stir-fried Noodles', category: 'noodles', desc: 'Choose cooked or stir-fried.', price: 1500 },
  { id: 38, name: 'Chicken Noodles', category: 'noodles', desc: 'Noodles topped with chicken.', price: 3500 },
  { id: 39, name: 'Beef Noodles', category: 'noodles', desc: 'Noodles topped with beef.', price: 2500 },

  // PROTEIN & EXTRAS
  { id: 40, name: 'Chicken (protein add-on)', category: 'protein', desc: 'Grilled chicken portion.', price: 2000 },
  { id: 41, name: 'Wings (4 pieces)', category: 'protein', desc: 'Crispy chicken wings.', price: 2000 },
  { id: 42, name: 'Beef (protein add-on)', category: 'protein', desc: 'Seasoned beef portion.', price: 1000 },
  { id: 43, name: 'Plantain (extra)', category: 'protein', desc: 'Side of fried plantain.', price: 1000 },
  { id: 44, name: 'Coleslaw (extra)', category: 'protein', desc: 'Fresh, creamy coleslaw.', price: 1000 },
];

const DEMO_DEALS = [
  { id: 'd1', name: 'Breakfast Budget', items: 'Tea/Coffee + Toasted Bread', was: 2500, price: 2000, save: 500, badge: '20% OFF', note: 'Everyday, 7:30am – 11am' },
  { id: 'd2', name: 'Breakfast Feast', items: 'Meat Pie + Yogurt', was: 2700, price: 2200, save: 500, badge: '18% OFF', note: 'Everyday, 7:30am – 11am' },
  { id: 'd3', name: 'Breakfast Deluxe', items: 'Rice (alt. spaghetti) + Beef (alt. double egg) + Drink', was: 3500, price: 3000, save: 500, badge: '14% OFF', note: 'Everyday, 7:30am – 11am' },
  { id: 'd4', name: 'Jinja Family Combo', items: '4 Jollof Rice + 2 Chicken (or fish) + 2 Beef (or 4pc wings) + 2 Plantain + 2 Coleslaw + 4 Drinks + 2 Water', was: 18800, price: 15980, save: 2820, badge: '15% OFF' },
  { id: 'd5', name: 'Jinja Combo', items: 'Jollof Rice (alt. spaghetti/fried) + Chicken Thigh + Plantain + Coleslaw + Drink', was: 6000, price: 5400, save: 600, badge: '10% OFF' },
  { id: 'd6', name: 'Jinja Max', items: 'Shawarma + Fries + Milkshake', was: 8800, price: 7920, save: 880, badge: '10% OFF' },
  { id: 'd7', name: 'Stay Sweet', items: 'Burger + Fries + Milkshake', was: 9500, price: 8075, save: 1425, badge: '15% OFF' },
];

const DEMO_BIRTHDAYS = [
  { tier: 'Basic', cost: 30000, voucher: 35000, perks: ['1 Table Reservation', 'Balloon table decoration', 'Allowed to bring in Cakes'] },
  { tier: 'Flex', cost: 80000, voucher: 90000, perks: ['2 Table Reservations', 'Balloon table decoration', 'Allowed to bring in Cakes', '1 gift pack for celebrant'], featured: true },
  { tier: 'Experience', cost: 150000, voucher: 165000, perks: ['2+ Table Reservation', 'Balloon table decoration', 'Allowed to bring in Cakes', '1 gift pack for celebrant', 'Free photoshoot'] },
];

/* ============ STATE ============ */
let dishes = [];
let deals = [];
let bdayPackages = [];
let activeCategory = 'all';
let cart = JSON.parse(localStorage.getItem('scoops_cart') || '[]');
let currentUser = null;
let currentProfile = null;
let lastOrderCustomer = null;

/* ============ THEME ============ */
const themeToggle = document.getElementById('themeToggle');
const savedTheme = localStorage.getItem('scoops_theme') || 'dark';
document.body.setAttribute('data-theme', savedTheme);

themeToggle.addEventListener('click', () => {
  const next = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', next);
  localStorage.setItem('scoops_theme', next);
});

/* ============ RENDER: DEALS ============ */
function renderDeals() {
  const grid = document.getElementById('dealGrid');
  grid.innerHTML = deals.map(d => `
    <div class="deal-card">
      ${d.image_url ? `<img class="deal-card__img" src="${d.image_url}" alt="${d.name}" loading="lazy">` : ''}
      <span class="deal-card__badge">${d.badge}</span>
      <div class="deal-card__name">${d.name}</div>
      <div class="deal-card__items">${d.items}</div>
      <div class="deal-card__prices">
        <span class="deal-card__was">${money(d.was)}</span>
        <span class="deal-card__now">${money(d.price)}</span>
      </div>
      <span class="deal-card__save">You save ${money(d.save)}</span>
      ${d.note ? `<div class="deal-card__note">${d.note}</div>` : ''}
      <button class="add-btn" data-add-deal="${d.id}" aria-label="Add ${d.name} to cart">+</button>
    </div>
  `).join('');

  grid.querySelectorAll('[data-add-deal]').forEach(btn => {
    btn.addEventListener('click', () => addDealToCart(btn.dataset.addDeal));
  });
  anim(() => gsap.from(grid.children, { opacity: 0, y: 14, duration: 0.4, stagger: 0.05, ease: 'power2.out' }));
}

const CATEGORY_ICON = {
  shawarma: '🌯', pizza: '🍕', burger: '🍔', rice: '🍚', noodles: '🍜',
  sides: '🍟', protein: '🍗', milkshake: '🥤', dessert: '🍦', snacks: '🥐', drinks: '🧃'
};

function dishImageHtml(d) {
  const icon = CATEGORY_ICON[d.category] || '🍽️';
  if (d.image_url) {
    return `<img class="d-card__img" src="${d.image_url}" alt="${d.name}" loading="lazy" onerror="this.outerHTML='<div class=&quot;d-card__img d-card__img--placeholder&quot;>${icon}</div>'">`;
  }
  return `<div class="d-card__img d-card__img--placeholder">${icon}</div>`;
}

/* ============ RENDER: DISHES ============ */
function renderDishes(list) {
  const grid = document.getElementById('dishGrid');
  if (!list.length) {
    grid.innerHTML = `<p class="cart-empty">No dishes match your search.</p>`;
    return;
  }
  grid.innerHTML = list.map(d => `
    <div class="d-card ${d.is_available === false ? 'is-sold-out' : ''}" data-dish="${d.id}">
      ${dishImageHtml(d)}
      <div class="d-card__name">${d.name}</div>
      <div class="d-card__desc">${d.desc}</div>
      <div class="d-card__row">
        ${d.is_available === false
          ? `<span class="d-card__price">Sold out</span>`
          : d.sizes
            ? `<select class="size-select" data-size-for="${d.id}">
                ${d.sizes.map((s,i) => `<option value="${i}">${s.label} — ${money(s.price)}</option>`).join('')}
               </select>`
            : `<span class="d-card__price">${money(d.price)}</span>`
        }
        <button class="add-btn" data-add="${d.id}" aria-label="Add ${d.name} to cart" ${d.is_available === false ? 'disabled' : ''}>+</button>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('[data-add]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); addToCart(Number(btn.dataset.add)); });
  });
  grid.querySelectorAll('.size-select').forEach(sel => {
    sel.addEventListener('click', (e) => e.stopPropagation());
  });
  grid.querySelectorAll('.d-card').forEach(card => {
    card.addEventListener('click', () => openProductDetail(Number(card.dataset.dish)));
  });
  anim(() => gsap.from(grid.children, { opacity: 0, y: 14, duration: 0.4, stagger: 0.04, ease: 'power2.out' }));
}

/* ============ RENDER: BIRTHDAY PACKAGES ============ */
function renderBirthdays() {
  const grid = document.getElementById('bdayGrid');
  grid.innerHTML = bdayPackages.map(b => `
    <div class="bday-card ${b.featured ? 'is-flex' : ''}">
      <div class="bday-card__tier">${b.tier}</div>
      <div class="bday-card__cost">${money(b.cost)}</div>
      <div class="bday-card__voucher">Voucher value: ${money(b.voucher)}</div>
      <ul class="bday-card__list">${b.perks.map(p => `<li>${p}</li>`).join('')}</ul>
      <a class="btn btn--primary" href="https://wa.me/2347087662962?text=${encodeURIComponent('Hi, I want to enquire about the ' + b.tier + ' birthday package.')}" target="_blank" rel="noopener">Enquire on WhatsApp</a>
    </div>
  `).join('');
  anim(() => gsap.from(grid.children, { opacity: 0, y: 14, duration: 0.4, stagger: 0.08, ease: 'power2.out' }));
}

/* ============ HERO CAROUSEL ============ */
let heroIndex = 0;
let heroTimer = null;

function renderHeroCarousel() {
  const track = document.getElementById('heroTrack');
  const dotsEl = document.getElementById('heroDots');

  const brandSlide = `
    <div class="hero-slide" style="background:linear-gradient(155deg, var(--red) 0%, #A81811 100%);">
      <div class="hero-slide__ember" aria-hidden="true"></div>
      <span class="hero__eyebrow">Big Flavour · Great Value · Everyday</span>
      <h1 class="hero__title">Chops, drinks<br><span class="ink">& jollof done right.</span></h1>
      <p class="hero__sub">Shawarma, pizza, burgers, and the jollof everyone's talking about.</p>
      <div class="hero__ctas">
        <a href="#deals" class="btn btn--primary">See today's deals</a>
        <a href="#menu" class="btn btn--outline">Browse menu</a>
      </div>
    </div>
  `;

  const dealSlides = deals.slice(0, 2).map(d => `
    <div class="hero-slide" style="background:linear-gradient(155deg, #2E1815 0%, #170907 100%);">
      <div class="hero-slide__ember" aria-hidden="true"></div>
      <span class="hero__eyebrow">${d.badge}</span>
      <h1 class="hero__title">${d.name}</h1>
      <p class="hero__sub">${d.items}</p>
      <div class="hero__ctas">
        <button class="btn btn--primary" data-hero-deal="${d.id}">Order now — ${money(d.price)}</button>
      </div>
    </div>
  `);

  const slides = [brandSlide, ...dealSlides];
  track.innerHTML = slides.join('');
  dotsEl.innerHTML = slides.map((_, i) => `<span class="hero-dot ${i === 0 ? 'is-active' : ''}" data-dot="${i}"></span>`).join('');

  track.querySelectorAll('[data-hero-deal]').forEach(btn => {
    btn.addEventListener('click', () => addDealToCart(btn.dataset.heroDeal));
  });
  dotsEl.querySelectorAll('[data-dot]').forEach(dot => {
    dot.addEventListener('click', () => goToHeroSlide(Number(dot.dataset.dot)));
  });

  clearInterval(heroTimer);
  heroTimer = setInterval(() => goToHeroSlide((heroIndex + 1) % slides.length), 4500);
}

function goToHeroSlide(i) {
  heroIndex = i;
  const track = document.getElementById('heroTrack');
  if (typeof gsap !== 'undefined') {
    gsap.to(track, { xPercent: -i * 100, duration: 0.55, ease: 'power2.inOut' });
  } else {
    track.style.transform = `translateX(-${i * 100}%)`;
  }
  document.querySelectorAll('.hero-dot').forEach((d, idx) => d.classList.toggle('is-active', idx === i));
}

/* ============ TOP CHOICES ============ */
function renderTopChoices() {
  const row = document.getElementById('topChoicesRow');
  const picks = dishes.slice(0, 8);
  row.innerHTML = picks.map(d => `
    <div class="tc-card" data-dish="${d.id}">
      ${d.image_url
        ? `<img class="tc-card__img" src="${d.image_url}" alt="${d.name}" loading="lazy" onerror="this.outerHTML='<div class=&quot;tc-card__img tc-card__img--placeholder&quot;>${CATEGORY_ICON[d.category] || '🍽️'}</div>'">`
        : `<div class="tc-card__img tc-card__img--placeholder">${CATEGORY_ICON[d.category] || '🍽️'}</div>`
      }
      <div class="tc-card__name">${d.name}</div>
      <div class="tc-card__price">${d.sizes ? 'From ' + money(d.sizes[0].price) : money(d.price)}</div>
    </div>
  `).join('');

  row.querySelectorAll('.tc-card').forEach(card => {
    card.addEventListener('click', () => openProductDetail(Number(card.dataset.dish)));
  });
  anim(() => gsap.from(row.children, { opacity: 0, x: 20, duration: 0.4, stagger: 0.06, ease: 'power2.out' }));
}

/* ============ PRODUCT DETAIL OVERLAY ============ */
const favorites = new Set(JSON.parse(localStorage.getItem('scoops_favorites') || '[]'));
let pdSelectedSizeIndex = 0;

function openProductDetail(dishId) {
  const dish = dishes.find(d => d.id === dishId);
  if (!dish) return;
  pdSelectedSizeIndex = 0;

  const media = document.getElementById('pdMedia');
  const icon = CATEGORY_ICON[dish.category] || '🍽️';
  media.innerHTML = `
    <button class="pd-float-btn pd-back" id="pdBack" aria-label="Back">←</button>
    <button class="pd-float-btn pd-fav" id="pdFav" aria-label="Save favorite">${favorites.has(dishId) ? '♥' : '♡'}</button>
    ${dish.image_url ? `<img src="${dish.image_url}" alt="${dish.name}" onerror="this.remove()">` : `<span>${icon}</span>`}
  `;
  document.getElementById('pdFav').classList.toggle('is-active', favorites.has(dishId));
  document.getElementById('pdBack').addEventListener('click', closeProductDetail);
  document.getElementById('pdFav').addEventListener('click', () => toggleFavorite(dishId));

  document.getElementById('pdCat').textContent = dish.category;
  document.getElementById('pdName').textContent = dish.name;
  document.getElementById('pdDesc').textContent = dish.desc;

  const sizesWrap = document.getElementById('pdSizesWrap');
  if (dish.sizes) {
    sizesWrap.hidden = false;
    document.getElementById('pdSizeRow').innerHTML = dish.sizes.map((s, i) => `
      <button class="pd-size-pill ${i === 0 ? 'is-selected' : ''}" data-size-idx="${i}">${s.label} — ${money(s.price)}</button>
    `).join('');
    document.getElementById('pdSizeRow').querySelectorAll('.pd-size-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        pdSelectedSizeIndex = Number(pill.dataset.sizeIdx);
        document.querySelectorAll('.pd-size-pill').forEach(p => p.classList.remove('is-selected'));
        pill.classList.add('is-selected');
        document.getElementById('pdPrice').textContent = money(dish.sizes[pdSelectedSizeIndex].price);
      });
    });
    document.getElementById('pdPrice').textContent = money(dish.sizes[0].price);
  } else {
    sizesWrap.hidden = true;
    document.getElementById('pdPrice').textContent = money(dish.price);
  }

  const similar = dishes.filter(d => d.category === dish.category && d.id !== dish.id).slice(0, 4);
  const similarWrap = document.getElementById('pdSimilarWrap');
  if (similar.length) {
    similarWrap.hidden = false;
    document.getElementById('pdSimilarRow').innerHTML = similar.map(d => `
      <div class="tc-card" data-similar="${d.id}">
        ${d.image_url
          ? `<img class="tc-card__img" src="${d.image_url}" alt="${d.name}" loading="lazy" onerror="this.outerHTML='<div class=&quot;tc-card__img tc-card__img--placeholder&quot;>${CATEGORY_ICON[d.category] || '🍽️'}</div>'">`
          : `<div class="tc-card__img tc-card__img--placeholder">${CATEGORY_ICON[d.category] || '🍽️'}</div>`
        }
        <div class="tc-card__name">${d.name}</div>
        <div class="tc-card__price">${d.sizes ? 'From ' + money(d.sizes[0].price) : money(d.price)}</div>
      </div>
    `).join('');
    document.getElementById('pdSimilarRow').querySelectorAll('[data-similar]').forEach(card => {
      card.addEventListener('click', () => openProductDetail(Number(card.dataset.similar)));
    });
  } else {
    similarWrap.hidden = true;
  }

  document.getElementById('pdAddBtn').onclick = () => {
    addToCart(dishId, dish.sizes ? pdSelectedSizeIndex : undefined);
    closeProductDetail();
  };

  document.getElementById('productDetail').hidden = false;
  document.getElementById('productDetail').scrollTop = 0;
  anim(() => gsap.fromTo('#productDetail', { y: '4%', opacity: 0 }, { y: '0%', opacity: 1, duration: 0.35, ease: 'power3.out' }));
}

function closeProductDetail() {
  const el = document.getElementById('productDetail');
  if (typeof gsap !== 'undefined') {
    gsap.to(el, { y: '4%', opacity: 0, duration: 0.25, ease: 'power2.in', onComplete: () => { el.hidden = true; gsap.set(el, { clearProps: 'all' }); } });
  } else {
    el.hidden = true;
  }
}

function toggleFavorite(dishId) {
  if (favorites.has(dishId)) favorites.delete(dishId); else favorites.add(dishId);
  localStorage.setItem('scoops_favorites', JSON.stringify([...favorites]));
  const favBtn = document.getElementById('pdFav');
  favBtn.textContent = favorites.has(dishId) ? '♥' : '♡';
  favBtn.classList.toggle('is-active', favorites.has(dishId));
}

document.getElementById('bellBtn').addEventListener('click', openOrders);

/* ============ FOOTER: COPYRIGHT YEAR + COOKIE CONSENT ============ */
document.getElementById('copyYear').textContent = new Date().getFullYear();

const cookieBanner = document.getElementById('cookieBanner');
if (!localStorage.getItem('scoops_cookie_consent')) {
  cookieBanner.hidden = false;
}
document.getElementById('cookieAcceptBtn').addEventListener('click', () => {
  localStorage.setItem('scoops_cookie_consent', 'true');
  cookieBanner.hidden = true;
});

/* ============ INSTALL APP (PWA) ============ */
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const btn = document.getElementById('installBtn');
  if (!window.matchMedia('(display-mode: standalone)').matches) btn.hidden = false;
});

document.getElementById('installBtn').addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  document.getElementById('installBtn').hidden = true;
});

window.addEventListener('appinstalled', () => {
  document.getElementById('installBtn').hidden = true;
});

/* ============ FILTERING ============ */
function applyFilters() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  let list = dishes.filter(d => activeCategory === 'all' || activeCategory === 'combos' || d.category === activeCategory);
  if (q) list = list.filter(d => d.name.toLowerCase().includes(q) || d.desc.toLowerCase().includes(q));

  document.getElementById('menu').style.display = activeCategory === 'combos' ? 'none' : '';
  document.getElementById('deals').style.display = (activeCategory === 'all' || activeCategory === 'combos') ? '' : 'none';

  renderDishes(list);
}

document.getElementById('searchInput').addEventListener('input', applyFilters);

document.getElementById('categoryRow').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('is-active'));
  chip.classList.add('is-active');
  activeCategory = chip.dataset.cat;
  applyFilters();
});

/* ============ CART ============ */
function addToCart(dishId, presetSizeIndex) {
  const dish = dishes.find(d => d.id === dishId);
  if (!dish) return;

  let price = dish.price;
  let sizeLabel = null;
  if (dish.sizes) {
    let idx = presetSizeIndex;
    if (idx === undefined) {
      const select = document.querySelector(`[data-size-for="${dishId}"]`);
      idx = select ? Number(select.value) : 0;
    }
    const opt = dish.sizes[idx] || dish.sizes[0];
    price = opt.price;
    sizeLabel = opt.label;
  }

  const lineId = dishId + '::' + (sizeLabel ?? '');
  const line = cart.find(c => c.lineId === lineId);
  if (line) line.qty += 1;
  else cart.push({ lineId, id: dish.id, name: dish.name, size: sizeLabel, price, qty: 1, image_url: dish.image_url, category: dish.category });

  saveCart(); renderCart(); openCart();
}

function addDealToCart(dealId) {
  const deal = deals.find(d => d.id === dealId);
  if (!deal) return;
  const lineId = 'deal::' + dealId;
  const line = cart.find(c => c.lineId === lineId);
  if (line) line.qty += 1;
  else cart.push({ lineId, id: dealId, name: deal.name, size: 'Combo', price: deal.price, qty: 1, image_url: deal.image_url, category: null });
  saveCart(); renderCart(); openCart();
}

function changeQty(lineId, delta) {
  const line = cart.find(c => c.lineId === lineId);
  if (!line) return;
  line.qty += delta;
  if (line.qty <= 0) cart = cart.filter(c => c.lineId !== lineId);
  saveCart(); renderCart();
}

function removeLine(lineId) {
  cart = cart.filter(c => c.lineId !== lineId);
  saveCart(); renderCart();
}

function saveCart() { localStorage.setItem('scoops_cart', JSON.stringify(cart)); }

function cartLineImageHtml(c) {
  const icon = CATEGORY_ICON[c.category] || '🍽️';
  if (c.image_url) return `<img class="cart-line__img" src="${c.image_url}" alt="" loading="lazy" onerror="this.outerHTML='<div class=&quot;cart-line__img cart-line__img--placeholder&quot;>${icon}</div>'">`;
  return `<div class="cart-line__img cart-line__img--placeholder">${icon}</div>`;
}

function renderCart() {
  const itemsEl = document.getElementById('cartItems');
  const countEl = document.getElementById('cartCount');
  const totalEl = document.getElementById('cartTotal');
  const headingEl = document.getElementById('cartHeading');

  const totalQty = cart.reduce((s, c) => s + c.qty, 0);
  const totalPrice = cart.reduce((s, c) => s + c.qty * c.price, 0);
  countEl.textContent = totalQty;
  totalEl.textContent = money(totalPrice);
  headingEl.textContent = totalQty ? `My Cart · ${totalQty} item${totalQty === 1 ? '' : 's'}` : 'My Cart';
  anim(() => gsap.fromTo(countEl, { scale: 1 }, { scale: 1.4, duration: 0.18, yoyo: true, repeat: 1, ease: 'power1.inOut' }));

  if (!cart.length) {
    itemsEl.innerHTML = `<p class="cart-empty">Your cart is empty. Add something good.</p>`;
    return;
  }

  itemsEl.innerHTML = cart.map(c => `
    <div class="cart-line">
      ${cartLineImageHtml(c)}
      <div class="cart-line__info">
        <div class="cart-line__name">${c.name}</div>
        ${c.size ? `<div class="cart-line__size">${c.size}</div>` : ''}
        <div class="cart-line__price">${money(c.price * c.qty)}</div>
      </div>
      <div class="cart-line__side">
        <button class="cart-line__trash" data-remove="${c.lineId}" aria-label="Remove item">🗑</button>
        <div class="cart-line__qty">
          <button class="qty-btn" data-dec="${c.lineId}">−</button>
          <span>${c.qty}</span>
          <button class="qty-btn" data-inc="${c.lineId}">+</button>
        </div>
      </div>
    </div>
  `).join('');

  itemsEl.querySelectorAll('[data-inc]').forEach(b => b.addEventListener('click', () => changeQty(b.dataset.inc, 1)));
  itemsEl.querySelectorAll('[data-dec]').forEach(b => b.addEventListener('click', () => changeQty(b.dataset.dec, -1)));
  itemsEl.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => removeLine(b.dataset.remove)));
}

/* ============ CART DRAWER OPEN/CLOSE ============ */
const drawer = document.getElementById('cartDrawer');
const scrim = document.getElementById('drawerScrim');
function openCart() {
  document.getElementById('stepCart').hidden = false;
  document.getElementById('stepCheckout').hidden = true;
  document.getElementById('stepConfirm').hidden = true;
  drawer.classList.add('is-open'); scrim.classList.add('is-open');
}
function closeCart() { drawer.classList.remove('is-open'); scrim.classList.remove('is-open'); }

document.getElementById('cartBtn').addEventListener('click', openCart);
document.getElementById('navCart').addEventListener('click', openCart);
document.getElementById('closeCart').addEventListener('click', closeCart);
scrim.addEventListener('click', () => { closeCart(); closeOrders(); });

/* ============ CHECKOUT FLOW ============ */
const stepCart = document.getElementById('stepCart');
const stepCheckout = document.getElementById('stepCheckout');
const stepConfirm = document.getElementById('stepConfirm');
const addressField = document.getElementById('addressField');
const checkoutForm = document.getElementById('checkoutForm');

function showStep(step) {
  stepCart.hidden = step !== 'cart';
  stepCheckout.hidden = step !== 'checkout';
  stepConfirm.hidden = step !== 'confirm';
}

document.getElementById('checkoutBtn').addEventListener('click', () => {
  if (!cart.length) return;
  document.getElementById('checkoutTotal').textContent = document.getElementById('cartTotal').textContent;
  if (currentProfile) {
    document.getElementById('custName').value = currentProfile.name || '';
    document.getElementById('custPhone').value = currentProfile.phone || '';
    document.getElementById('custAddress').value = currentProfile.default_address || '';
  }
  showStep('checkout');
});
document.getElementById('backToCart').addEventListener('click', () => showStep('cart'));
document.getElementById('closeCheckout').addEventListener('click', closeCart);
document.getElementById('closeConfirm').addEventListener('click', () => { showStep('cart'); closeCart(); });

document.querySelectorAll('input[name="fulfil"]').forEach(r => {
  r.addEventListener('change', () => {
    const isDelivery = document.querySelector('input[name="fulfil"]:checked').value === 'delivery';
    addressField.style.display = isDelivery ? '' : 'none';
    document.getElementById('custAddress').required = isDelivery;
  });
});

checkoutForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const total = cart.reduce((s, c) => s + c.qty * c.price, 0);
  const customer = {
    name: document.getElementById('custName').value.trim(),
    phone: document.getElementById('custPhone').value.trim(),
    fulfilment: document.querySelector('input[name="fulfil"]:checked').value,
    address: document.getElementById('custAddress').value.trim(),
    notes: document.getElementById('custNotes').value.trim()
  };

  const submitBtn = document.getElementById('placeOrderBtn');
  submitBtn.disabled = true; submitBtn.textContent = 'Placing order…';

  const { data, error } = await placeOrder(cart, total, customer);

  submitBtn.disabled = false; submitBtn.textContent = 'Place order';

  if (error) {
    alert('Something went wrong placing your order: ' + (error.message || JSON.stringify(error)));
    return;
  }

  const order = {
    id: data.id,
    items: cart.map(c => ({ name: c.name, size: c.size, qty: c.qty, price: c.price })),
    total,
    customer,
    createdAt: Date.now()
  };
  saveOrderToHistory(order);
  lastOrderCustomer = customer;

  document.getElementById('confirmName').textContent = customer.name || 'there';
  document.getElementById('confirmTicket').innerHTML = `
    Order #${order.id}<br>
    ${order.items.map(i => `${i.qty}× ${i.name}${i.size ? ' (' + i.size + ')' : ''}`).join('<br>')}<br>
    ---<br>
    Total: ${money(total)}<br>
    ${customer.fulfilment === 'pickup' ? 'Pickup at Uke-Wende St, Makurdi' : 'Delivering to: ' + (customer.address || '—')}
  `;

  const waLines = [
    `New order #${order.id}`,
    ...order.items.map(i => `${i.qty}× ${i.name}${i.size ? ' (' + i.size + ')' : ''}`),
    `Total: ${money(total)}`,
    `Name: ${customer.name || '—'}`,
    `Phone: ${customer.phone || '—'}`,
    customer.fulfilment === 'pickup' ? 'Pickup at store' : `Deliver to: ${customer.address || '—'}`,
  ];
  if (customer.notes) waLines.push(`Notes: ${customer.notes}`);
  document.getElementById('whatsappOrderBtn').href =
    `https://wa.me/2347087662962?text=${encodeURIComponent(waLines.join('\n'))}`;

  // Only nudge guests — logged-in customers already have their details saved.
  document.getElementById('savePrompt').hidden = !!currentUser;

  cart = [];
  saveCart(); renderCart();
  checkoutForm.reset();
  showStep('confirm');
});

document.getElementById('trackOrderBtn').addEventListener('click', () => {
  closeCart();
  openOrders();
});

/* ============ ORDER HISTORY & TRACKING ============ */
function loadOrderHistory() { return JSON.parse(localStorage.getItem('scoops_orders') || '[]'); }
function saveOrderToHistory(order) {
  const orders = loadOrderHistory();
  orders.unshift(order);
  localStorage.setItem('scoops_orders', JSON.stringify(orders));
}

const STATUS_STEPS = ['pending', 'preparing', 'out_for_delivery', 'delivered'];
const STATUS_LABELS = { pending: 'Order received', preparing: 'Preparing', out_for_delivery: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled' };

// Simulated progression based on time elapsed — used only for local/offline orders
// (no Supabase, or not logged in). Logged-in orders use the real `status` column instead,
// which staff update from admin.html.
function computeStatus(order) {
  const minutes = (Date.now() - order.createdAt) / 60000;
  if (minutes < 4) return 'pending';
  if (minutes < 14) return 'preparing';
  if (minutes < 30) return 'out_for_delivery';
  return 'delivered';
}

function orderCardHtml(id, items, total, status, createdAt) {
  const stepIndex = STATUS_STEPS.indexOf(status);
  const time = new Date(createdAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
  return `
    <div class="order-card">
      <div class="order-card__top">
        <span class="order-card__id">#${id}</span>
        <span class="order-card__time">${time}</span>
      </div>
      <div class="order-card__items">${items.map(i => `${i.qty}× ${i.name}${i.size ? ' (' + i.size + ')' : ''}`).join(', ')}</div>
      <div class="order-card__total">${money(total)}</div>
      <span class="status-pill" data-status="${status}">${STATUS_LABELS[status] || status}</span>
      ${status !== 'cancelled' ? `
        <div class="status-track">
          ${STATUS_STEPS.map((s, i) => `<span class="status-track__seg ${i <= stepIndex ? 'is-filled' : ''}"></span>`).join('')}
        </div>` : ''}
    </div>
  `;
}

async function renderOrderHistory() {
  const list = document.getElementById('ordersList');
  list.innerHTML = `<p class="cart-empty">Loading your orders…</p>`;

  // Logged in + Supabase connected: real orders with real staff-set status.
  if (currentUser && supabase) {
    const remote = await fetchMyOrders(currentUser.id);
    if (remote && remote.length) {
      list.innerHTML = remote.map(o =>
        orderCardHtml(o.id, o.items, o.total, o.status, o.created_at)
      ).join('');
      return;
    }
    if (remote && !remote.length) {
      list.innerHTML = `<p class="cart-empty">No orders yet. Once you check out, they'll show up here.</p>`;
      return;
    }
    // fall through to local on fetch error
  }

  // Fallback: local device history with simulated status
  const orders = loadOrderHistory();
  if (!orders.length) {
    list.innerHTML = `<p class="cart-empty">No orders yet. Once you check out, they'll show up here.</p>`;
    return;
  }
  list.innerHTML = orders.map(o => orderCardHtml(o.id, o.items, o.total, computeStatus(o), o.createdAt)).join('');
}

const ordersDrawer = document.getElementById('ordersDrawer');
function openOrders() {
  renderOrderHistory();
  ordersDrawer.classList.add('is-open');
  scrim.classList.add('is-open');
}
function closeOrders() { ordersDrawer.classList.remove('is-open'); scrim.classList.remove('is-open'); }

document.getElementById('navOrders').addEventListener('click', openOrders);
document.getElementById('closeOrders').addEventListener('click', closeOrders);

/* ============ SOFT SIGNUP PROMPT (post-checkout, guests only) ============ */
document.getElementById('skipPrompt').addEventListener('click', () => {
  document.getElementById('savePrompt').hidden = true;
});

document.getElementById('savePromptForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('promptError');
  errEl.hidden = true;

  if (!supabase) {
    errEl.hidden = false;
    errEl.textContent = 'Connect Supabase first — see supabase-client.js.';
    return;
  }

  const email = document.getElementById('promptEmail').value.trim();
  const password = document.getElementById('promptPassword').value;
  const { data, error } = await signUp(email, password);

  if (error) {
    errEl.hidden = false;
    errEl.textContent = error.message || 'Something went wrong.';
    return;
  }

  currentUser = data.user;
  if (currentUser && lastOrderCustomer) {
    const { data: profile } = await upsertProfile(currentUser.id, {
      email: currentUser.email,
      name: lastOrderCustomer.name,
      phone: lastOrderCustomer.phone,
      default_address: lastOrderCustomer.address
    });
    currentProfile = profile;
  }

  const prompt = document.getElementById('savePrompt');
  prompt.innerHTML = `<p class="save-prompt__title">You're all set ✓</p><p class="save-prompt__sub">Your details are saved for next time.</p>`;
});

/* ============ BOTTOM NAV ============ */
document.querySelectorAll('.bottom-nav__item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.bottom-nav__item').forEach(i => i.classList.remove('is-active'));
    item.classList.add('is-active');
  });
});

/* ============ INIT ============ */
async function init() {
  const [liveDishes, liveDeals, liveBdays] = await Promise.all([
    fetchDishes(), fetchDeals(), fetchBirthdayPackages()
  ]);

  dishes = liveDishes ?? DEMO_DISHES;
  deals = liveDeals ?? DEMO_DEALS;
  bdayPackages = liveBdays ?? DEMO_BIRTHDAYS;

  if (supabase) {
    currentUser = await getCurrentUser();
    if (currentUser) currentProfile = await fetchProfile(currentUser.id);
  }

  renderHeroCarousel();
  renderDeals();
  renderDishes(dishes);
  renderTopChoices();
  renderBirthdays();
  renderCart();
}

init();
