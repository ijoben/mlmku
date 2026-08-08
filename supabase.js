// supabase.js - VERSI PALING SEDERHANA
console.log('🔵 supabase.js mulai dieksekusi...');

const SUPABASE_URL = 'https://dbfwcsuptitytlposubo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiZndjc3VwdGl0eXRscG9zdWJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NTgyMjMsImV4cCI6MjEwMTQzNDIyM30.TGAANDziz0olPdPIwAgtfiOPzfqxGVIfvNoLFhOsGQY';

// Buat client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('🔵 Supabase client created:', !!supabaseClient);

// ============================================
// FUNGSI GET PRODUCTS (PALING SEDERHANA)
// ============================================
window.getProducts = async function() {
  console.log('🔵 getProducts dipanggil...');
  const { data, error } = await supabaseClient.from('products').select('*');
  if (error) {
    console.error('🔴 Error getProducts:', error);
    throw error;
  }
  console.log('✅ getProducts berhasil:', data.length, 'items');
  return data;
};

// ============================================
// FUNGSI GET SETTINGS
// ============================================
window.getSettings = async function() {
  console.log('🔵 getSettings dipanggil...');
  const { data, error } = await supabaseClient.from('settings').select('*');
  if (error) {
    console.error('🔴 Error getSettings:', error);
    throw error;
  }
  const settings = {};
  data.forEach(r => settings[r.key] = r.value);
  console.log('✅ getSettings berhasil:', Object.keys(settings).length, 'keys');
  return settings;
};

// ============================================
// FUNGSI GET SESSION
// ============================================
window.getSession = async function() {
  console.log('🔵 getSession dipanggil...');
  const { data: { session }, error } = await supabaseClient.auth.getSession();
  if (error) {
    console.error('🔴 Error getSession:', error);
    throw error;
  }
  console.log('✅ getSession berhasil:', !!session);
  return session;
};

// ============================================
// FUNGSI GET SLIDES
// ============================================
window.getSlides = async function() {
  console.log('🔵 getSlides dipanggil...');
  const { data, error } = await supabaseClient.from('slides').select('*');
  if (error) {
    console.error('🔴 Error getSlides:', error);
    throw error;
  }
  console.log('✅ getSlides berhasil:', data.length, 'items');
  return data;
};

// ============================================
// FUNGSI LAINNYA (MINIMAL)
// ============================================
window.getFaqs = async function() {
  const { data, error } = await supabaseClient.from('faq').select('*');
  if (error) throw error;
  return data;
};

window.getFeatures = async function() {
  const { data, error } = await supabaseClient.from('features').select('*');
  if (error) throw error;
  return data;
};

window.getAbout = async function() {
  const { data, error } = await supabaseClient.from('about').select('*');
  if (error) throw error;
  return data.length ? data[0] : { id: 1, title: '', content: '' };
};

window.getFooter = async function() {
  const { data, error } = await supabaseClient.from('footer').select('*');
  if (error) throw error;
  return data.length ? data[0] : { id: 1, brand: '', description: '', copyright: '', social: {} };
};

window.getBankInfo = async function() {
  const { data, error } = await supabaseClient.from('bank_info').select('*');
  if (error) throw error;
  return data;
};

window.getOrders = async function() {
  const { data, error } = await supabaseClient.from('orders').select('*');
  if (error) throw error;
  return data;
};

window.getTransactions = async function() {
  const { data, error } = await supabaseClient.from('transactions').select('*');
  if (error) throw error;
  return data;
};

window.getTable = async function(table, select = '*') {
  const { data, error } = await supabaseClient.from(table).select(select);
  if (error) throw error;
  return data;
};

// ============================================
// FUNGSI AUTH (MINIMAL)
// ============================================
window.signIn = async function(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
};

window.signOut = async function() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
};

window.signUp = async function(email, password, metadata = {}) {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: { data: metadata }
  });
  if (error) throw error;
  return data;
};

window.getUserProfile = async function() {
  const session = await window.getSession();
  if (!session) return null;
  const { data, error } = await supabaseClient
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

// ============================================
// LOG KONFIRMASI
// ============================================
console.log('✅ supabase.js selesai dieksekusi!');
console.log('✅ window.getProducts:', typeof window.getProducts);
console.log('✅ window.getSession:', typeof window.getSession);
console.log('✅ window.getSettings:', typeof window.getSettings);
console.log('✅ window.getSlides:', typeof window.getSlides);
console.log('✅ window.getFaqs:', typeof window.getFaqs);
console.log('✅ window.getFeatures:', typeof window.getFeatures);
console.log('✅ window.getAbout:', typeof window.getAbout);
console.log('✅ window.getFooter:', typeof window.getFooter);
