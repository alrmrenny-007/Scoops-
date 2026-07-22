// ============================================================
// SUPABASE CLIENT — Scoops Chops & Drinks × Mr. Jollof
// ============================================================
// 1. Create a project at https://supabase.com
// 2. Run schema.sql (included in this project) in the SQL Editor
// 3. Paste your Project URL and anon public key below
//    (Project Settings → API)
// ============================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://gnurqfxxwsuvyavvglpr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdudXJxZnh4d3N1dnlhdnZnbHByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NzEyNTAsImV4cCI6MjA5OTU0NzI1MH0.bsAelXMsnSzqRvLBy3cEEHLyFPFgOO0NFEsuJP5vSms';

export const supabase =
  SUPABASE_URL.startsWith('http')
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null; // null until you add real credentials — app falls back to demo data

// ---------- DATA ACCESS ----------

export async function fetchDishes(categorySlug = null) {
  if (!supabase) return null;
  let query = supabase.from('dishes').select('*').order('category');
  if (categorySlug && categorySlug !== 'all') query = query.eq('category', categorySlug);
  const { data, error } = await query;
  if (error) { console.error('fetchDishes:', error.message); return null; }
  // 'desc' is a reserved SQL keyword, so the column is named 'description' in the
  // database — translate it here so the rest of the app can keep using `d.desc`.
  return data.map(d => ({ ...d, desc: d.description }));
}

export async function fetchDeals() {
  if (!supabase) return null;
  const { data, error } = await supabase.from('deals').select('*');
  if (error) { console.error('fetchDeals:', error.message); return null; }
  return data;
}

export async function fetchDeliveryZones() {
  if (!supabase) return null;
  const { data, error } = await supabase.from('delivery_zones').select('*').order('fee');
  if (error) { console.error('fetchDeliveryZones:', error.message); return null; }
  return data;
}

export async function createDeliveryZone(zone) {
  if (!supabase) return { error: 'Supabase not configured yet.' };
  const { data, error } = await supabase.from('delivery_zones').insert({ name: zone.name, fee: zone.fee }).select().single();
  return { data, error };
}

export async function updateDeliveryZone(zoneId, zone) {
  if (!supabase) return { error: 'Supabase not configured yet.' };
  const { data, error } = await supabase.from('delivery_zones').update({ name: zone.name, fee: zone.fee }).eq('id', zoneId).select().single();
  return { data, error };
}

export async function deleteDeliveryZone(zoneId) {
  if (!supabase) return { error: 'Supabase not configured yet.' };
  const { error } = await supabase.from('delivery_zones').delete().eq('id', zoneId);
  return { error };
}

export async function fetchBirthdayPackages() {
  if (!supabase) return null;
  const { data, error } = await supabase.from('birthday_packages').select('*').order('cost');
  if (error) { console.error('fetchBirthdayPackages:', error.message); return null; }
  return data;
}

export async function placeOrder(cartItems, total, customer = {}) {
  // No Supabase configured yet: fall back to a local-only order so checkout
  // still works end-to-end. Once you add credentials above, this branch
  // stops running and orders are written to the real `orders` table.
  if (!supabase) {
    return {
      data: {
        id: 'LOC-' + Math.floor(1000 + Math.random() * 9000),
        local: true
      },
      error: null
    };
  }

  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('orders').insert({
    user_id: user?.id ?? null,
    items: cartItems,
    total,
    status: 'pending',
    customer_name: customer.name ?? null,
    phone: customer.phone ?? null,
    delivery_type: customer.fulfilment ?? null,
    address: customer.address ?? null,
    notes: customer.notes ?? null,
    payment_method: customer.paymentMethod ?? 'onsite',
    payment_status: customer.paymentMethod === 'online' ? 'pending' : 'unpaid',
    payment_ref: customer.paymentRef ?? null,
    delivery_fee: customer.deliveryFee ?? 0,
    delivery_zone: customer.deliveryZone ?? null
  }).select().single();
  return { data, error };
}

export async function verifyFlutterwavePayment(transactionId, orderId, expectedAmount) {
  if (!supabase) return { error: 'Supabase not configured yet.' };
  const { data, error } = await supabase.functions.invoke('verify-payment', {
    body: { transaction_id: transactionId, order_id: orderId, expected_amount: expectedAmount }
  });
  return { data, error };
}

export async function signUp(email, password) {
  if (!supabase) return { error: 'Supabase not configured yet.' };
  return supabase.auth.signUp({ email, password });
}

export async function signIn(email, password) {
  if (!supabase) return { error: 'Supabase not configured yet.' };
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  if (!supabase) return { error: null };
  return supabase.auth.signOut();
}

export async function getCurrentUser() {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ---------- PROFILE ----------

export async function fetchProfile(userId) {
  if (!supabase) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) { console.error('fetchProfile:', error.message); return null; }
  return data;
}

export async function upsertProfile(userId, profile) {
  if (!supabase) return { error: 'Supabase not configured yet.' };
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...profile })
    .select()
    .single();
  return { data, error };
}

// ---------- CUSTOMER ORDER HISTORY ----------

export async function fetchMyOrders(userId) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchMyOrders:', error.message); return null; }
  return data;
}

// ---------- STAFF / ADMIN ----------
// These only succeed for users whose profiles.is_staff = true (enforced by RLS in schema.sql).

export async function fetchAllOrders() {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchAllOrders:', error.message); return null; }
  return data;
}

export async function updateOrderStatus(orderId, status) {
  if (!supabase) return { error: 'Supabase not configured yet.' };
  const { data, error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId)
    .select()
    .single();
  return { data, error };
}

export async function toggleDishAvailability(dishId, isAvailable) {
  if (!supabase) return { error: 'Supabase not configured yet.' };
  const { data, error } = await supabase
    .from('dishes')
    .update({ is_available: isAvailable })
    .eq('id', dishId)
    .select()
    .single();
  return { data, error };
}

export async function updateDishImage(dishId, imageUrl) {
  if (!supabase) return { error: 'Supabase not configured yet.' };
  const { data, error } = await supabase
    .from('dishes')
    .update({ image_url: imageUrl || null })
    .eq('id', dishId)
    .select()
    .single();
  return { data, error };
}

export async function savePushSubscription(userId, subscription) {
  if (!supabase) return { error: 'Supabase not configured yet.' };
  const { data, error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth_key: subscription.keys.auth
    }, { onConflict: 'endpoint' })
    .select()
    .single();
  return { data, error };
}

// dish = { name, category, desc, price, sizes } — `desc` is translated to the
// `description` column here since 'desc' is a reserved SQL keyword.
export async function createDish(dish) {
  if (!supabase) return { error: 'Supabase not configured yet.' };
  const { data, error } = await supabase.from('dishes').insert({
    name: dish.name,
    category: dish.category,
    description: dish.desc ?? null,
    price: dish.price ?? null,
    sizes: dish.sizes ?? null,
    is_available: true,
    ingredients: dish.ingredients ?? null,
    prep_time: dish.prep_time ?? null,
    instructions: dish.instructions ?? null,
    calories: dish.calories ?? null
  }).select().single();
  return { data, error };
}

export async function updateDish(dishId, dish) {
  if (!supabase) return { error: 'Supabase not configured yet.' };
  const { data, error } = await supabase.from('dishes').update({
    name: dish.name,
    category: dish.category,
    description: dish.desc ?? null,
    price: dish.price ?? null,
    sizes: dish.sizes ?? null,
    ingredients: dish.ingredients ?? null,
    prep_time: dish.prep_time ?? null,
    instructions: dish.instructions ?? null,
    calories: dish.calories ?? null
  }).eq('id', dishId).select().single();
  return { data, error };
}

export async function deleteDish(dishId) {
  if (!supabase) return { error: 'Supabase not configured yet.' };
  const { error } = await supabase.from('dishes').delete().eq('id', dishId);
  return { error };
}

export async function deleteOrder(orderId) {
  if (!supabase) return { error: 'Supabase not configured yet.' };
  const { error } = await supabase.from('orders').delete().eq('id', orderId);
  return { error };
}

// Bulk "start fresh" action — wipes every order marked delivered, so sales
// totals reset to zero after a period's been reconciled. This is irreversible.
export async function clearDeliveredOrders() {
  if (!supabase) return { error: 'Supabase not configured yet.' };
  const { error } = await supabase.from('orders').delete().eq('status', 'delivered');
  return { error };
}

export async function fetchAllProfiles() {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchAllProfiles:', error.message); return null; }
  return data;
}
