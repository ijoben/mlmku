// supabase.js
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- AUTH (NATIVE SUPABASE) ----------
async function signUp(email, password, metadata = {}) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username: metadata.username || email.split('@')[0],
        fullname: metadata.fullname || '',
        role: 'user'
      }
    }
  });
  if (error) throw error;
  return data;
}

async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  if (error) throw error;
  return data;
}

async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

// ---------- CRUD DENGAN RLS (otomatis pakai token user) ----------
async function getTable(table, select = '*', filter = null) {
  let query = supabase.from(table).select(select);
  if (filter) {
    Object.keys(filter).forEach(key => query = query.eq(key, filter[key]));
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function upsertRow(table, data) {
  const { data: result, error } = await supabase.from(table).upsert(data).select();
  if (error) throw error;
  return result[0];
}

async function deleteRow(table, id) {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}

// ----- Fungsi Khusus Users (menggunakan RLS) -----
async function getUserProfile() {
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function updateUserProfile(data) {
  const session = await getSession();
  if (!session) throw new Error('Not authenticated');
  const { error } = await supabase
    .from('users')
    .update(data)
    .eq('id', session.user.id);
  if (error) throw error;
}

// ----- Fungsi lain (Products, Orders, dll) tetap sama, tapi RLS otomatis jalan -----
async function getProducts() { return await getTable('products'); }
async function getOrders() { return await getTable('orders'); }
// ... dan seterusnya

// Export ke global
window.supabase = supabase;
window.signUp = signUp;
window.signIn = signIn;
window.signOut = signOut;
window.getCurrentUser = getCurrentUser;
window.getSession = getSession;
window.getUserProfile = getUserProfile;
window.updateUserProfile = updateUserProfile;
window.getProducts = getProducts;
window.getOrders = getOrders;
// ... export semua fungsi
