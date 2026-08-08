// supabase.js - FULL LENGKAP
console.log('🔵 supabase.js mulai dieksekusi...');

var SUPABASE_URL = 'https://dbfwcsuptitytlposubo.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiZndjc3VwdGl0eXRscG9zdWJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NTgyMjMsImV4cCI6MjEwMTQzNDIyM30.TGAANDziz0olPdPIwAgtfiOPzfqxGVIfvNoLFhOsGQY';

// Buat client
var supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('🔵 Supabase client created:', !!supabaseClient);

// ============================================================
// EXPOSE SUPABASE CLIENT KE WINDOW (PENTING!)
// ============================================================
window.supabase = supabaseClient;

// ============================================================
// AUTH FUNCTIONS
// ============================================================

window.signUp = async function(email, password, metadata = {}) {
  console.log('🔵 signUp dipanggil untuk:', email);
  var { data, error } = await supabaseClient.auth.signUp({
    email: email,
    password: password,
    options: {
      data: metadata,
      emailRedirectTo: 'https://hedtro.com/confirm-email.html'
    }
  });
  if (error) {
    console.error('🔴 signUp error:', error);
    throw error;
  }
  console.log('✅ signUp berhasil:', data);
  return data;
};

window.signIn = async function(email, password) {
  console.log('🔵 signIn dipanggil untuk:', email);
  var { data, error } = await supabaseClient.auth.signInWithPassword({
    email: email,
    password: password
  });
  if (error) {
    console.error('🔴 signIn error:', error);
    throw error;
  }
  console.log('✅ signIn berhasil:', data.user.email);
  return data;
};

window.signOut = async function() {
  console.log('🔵 signOut dipanggil');
  var { error } = await supabaseClient.auth.signOut();
  if (error) {
    console.error('🔴 signOut error:', error);
    throw error;
  }
  console.log('✅ signOut berhasil');
};

window.getSession = async function() {
  console.log('🔵 getSession dipanggil');
  var { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    console.error('🔴 getSession error:', error);
    throw error;
  }
  console.log('✅ getSession berhasil:', !!data.session);
  return data.session;
};

window.getCurrentUser = async function() {
  console.log('🔵 getCurrentUser dipanggil');
  var { data: { user }, error } = await supabaseClient.auth.getUser();
  if (error) {
    console.error('🔴 getCurrentUser error:', error);
    throw error;
  }
  console.log('✅ getCurrentUser berhasil:', !!user);
  return user;
};

// ============================================================
// USER PROFILE FUNCTIONS
// ============================================================

window.getUserProfile = async function() {
  console.log('🔵 getUserProfile dipanggil');
  try {
    var session = await window.getSession();
    if (!session) {
      console.log('⚠️ Tidak ada session');
      return null;
    }
    var { data, error } = await supabaseClient
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single();
    if (error && error.code !== 'PGRST116') {
      console.error('🔴 getUserProfile error:', error);
      throw error;
    }
    console.log('✅ getUserProfile berhasil:', !!data);
    return data;
  } catch (e) {
    console.error('🔴 getUserProfile exception:', e);
    throw e;
  }
};

window.getUserByEmail = async function(email) {
  console.log('🔵 getUserByEmail dipanggil untuk:', email);
  var { data, error } = await supabaseClient
    .from('users')
    .select('*')
    .eq('email', email)
    .single();
  if (error && error.code !== 'PGRST116') {
    console.error('🔴 getUserByEmail error:', error);
    throw error;
  }
  console.log('✅ getUserByEmail berhasil:', !!data);
  return data;
};

window.updateUserProfile = async function(data) {
  console.log('🔵 updateUserProfile dipanggil');
  try {
    var session = await window.getSession();
    if (!session) throw new Error('Unauthorized');
    var { error } = await supabaseClient
      .from('users')
      .update(data)
      .eq('id', session.user.id);
    if (error) {
      console.error('🔴 updateUserProfile error:', error);
      throw error;
    }
    console.log('✅ updateUserProfile berhasil');
  } catch (e) {
    console.error('🔴 updateUserProfile exception:', e);
    throw e;
  }
};

// ============================================================
// CRUD GENERIC FUNCTIONS
// ============================================================

window.getTable = async function(table, select, filter, order) {
  select = select || '*';
  console.log('🔵 getTable dipanggil untuk:', table);
  var query = supabaseClient.from(table).select(select);
  if (filter) {
    Object.keys(filter).forEach(function(k) {
      query = query.eq(k, filter[k]);
    });
  }
  if (order) {
    query = query.order(order.by, { ascending: order.ascending });
  }
  var { data, error } = await query;
  if (error) {
    console.error('🔴 getTable error:', error);
    throw error;
  }
  console.log('✅ getTable berhasil:', data.length, 'items');
  return data;
};

window.upsertRow = async function(table, data) {
  console.log('🔵 upsertRow dipanggil untuk:', table);
  var { data: result, error } = await supabaseClient
    .from(table)
    .upsert(data)
    .select();
  if (error) {
    console.error('🔴 upsertRow error:', error);
    throw error;
  }
  console.log('✅ upsertRow berhasil');
  return result[0];
};

window.deleteRow = async function(table, id) {
  console.log('🔵 deleteRow dipanggil untuk:', table, id);
  var { error } = await supabaseClient
    .from(table)
    .delete()
    .eq('id', id);
  if (error) {
    console.error('🔴 deleteRow error:', error);
    throw error;
  }
  console.log('✅ deleteRow berhasil');
};

// ============================================================
// FUNGSI KHUSUS UNTUK APLIKASI
// ============================================================

// Products
window.getProducts = async function() {
  return await window.getTable('products', '*', null, { by: 'id', ascending: true });
};
window.saveProduct = async function(p) { 
  return await window.upsertRow('products', p); 
};
window.deleteProduct = async function(id) { 
  await window.deleteRow('products', id); 
};

// Orders
window.getOrders = async function() {
  return await window.getTable('orders', '*', null, { by: 'created_at', ascending: false });
};
window.saveOrder = async function(o) { 
  return await window.upsertRow('orders', o); 
};
window.deleteOrder = async function(id) { 
  await window.deleteRow('orders', id); 
};

// Transactions
window.getTransactions = async function() {
  return await window.getTable('transactions', '*', null, { by: 'date', ascending: false });
};
window.saveTransaction = async function(t) { 
  return await window.upsertRow('transactions', t); 
};
window.deleteTransaction = async function(id) { 
  await window.deleteRow('transactions', id); 
};

// Bank Info
window.getBankInfo = async function() {
  return await window.getTable('bank_info', '*');
};
window.saveBankInfo = async function(b) { 
  return await window.upsertRow('bank_info', b); 
};
window.deleteBankInfo = async function(id) { 
  await window.deleteRow('bank_info', id); 
};

// Slides
window.getSlides = async function() {
  return await window.getTable('slides', '*');
};
window.saveSlide = async function(s) { 
  return await window.upsertRow('slides', s); 
};
window.deleteSlide = async function(id) { 
  await window.deleteRow('slides', id); 
};

// FAQ
window.getFaqs = async function() {
  return await window.getTable('faq', '*');
};
window.saveFaq = async function(f) { 
  return await window.upsertRow('faq', f); 
};
window.deleteFaq = async function(id) { 
  await window.deleteRow('faq', id); 
};

// Features
window.getFeatures = async function() {
  return await window.getTable('features', '*');
};
window.saveFeature = async function(f) { 
  return await window.upsertRow('features', f); 
};
window.deleteFeature = async function(id) { 
  await window.deleteRow('features', id); 
};

// About
window.getAbout = async function() {
  var d = await window.getTable('about', '*');
  return d.length ? d[0] : { id: 1, title: '', content: '' };
};
window.saveAbout = async function(a) { 
  return await window.upsertRow('about', a); 
};

// Footer
window.getFooter = async function() {
  var d = await window.getTable('footer', '*');
  return d.length ? d[0] : { id: 1, brand: '', description: '', copyright: '', social: {} };
};
window.saveFooter = async function(f) { 
  return await window.upsertRow('footer', f); 
};

// Settings
window.getSettings = async function() {
  var rows = await window.getTable('settings');
  var settings = {};
  rows.forEach(function(r) { settings[r.key] = r.value; });
  return settings;
};
window.saveSettings = async function(settings) {
  var promises = Object.keys(settings).map(function(key) {
    return window.upsertRow('settings', { key: key, value: settings[key] });
  });
  await Promise.all(promises);
};

// ============================================================
// LOG KONFIRMASI - PASTIKAN SEMUA FUNGSI TERSEDIA
// ============================================================
console.log('✅ supabase.js selesai dieksekusi!');
console.log('✅ window.supabase:', typeof window.supabase);
console.log('✅ window.getProducts:', typeof window.getProducts);
console.log('✅ window.getSession:', typeof window.getSession);
console.log('✅ window.getSettings:', typeof window.getSettings);
console.log('✅ window.getSlides:', typeof window.getSlides);
console.log('✅ window.getFaqs:', typeof window.getFaqs);
console.log('✅ window.getFeatures:', typeof window.getFeatures);
console.log('✅ window.getAbout:', typeof window.getAbout);
console.log('✅ window.getFooter:', typeof window.getFooter);
console.log('✅ window.signIn:', typeof window.signIn);
console.log('✅ window.signUp:', typeof window.signUp);
console.log('✅ window.signOut:', typeof window.signOut);
console.log('✅ window.getUserProfile:', typeof window.getUserProfile);
console.log('✅ window.updateUserProfile:', typeof window.updateUserProfile);
console.log('✅ window.getTable:', typeof window.getTable);
console.log('✅ window.upsertRow:', typeof window.upsertRow);
console.log('✅ window.deleteRow:', typeof window.deleteRow);
