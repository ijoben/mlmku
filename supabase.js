// supabase.js
const SUPABASE_URL = 'https://dbfwcsuptitytlposubo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiZndjc3VwdGl0eXRscG9zdWJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NTgyMjMsImV4cCI6MjEwMTQzNDIyM30.TGAANDziz0olPdPIwAgtfiOPzfqxGVIfvNoLFhOsGQY';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ========== AUTH ==========
async function signUp(email, password, metadata = {}) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: metadata }
  });
  if (error) throw error;
  return data;
}

async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
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

// ========== USER PROFILE ==========
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

async function getUserByEmail(email) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function updateUserProfile(data) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  const { error } = await supabase.from('users').update(data).eq('id', session.user.id);
  if (error) throw error;
}

// ========== CRUD GENERIC ==========
async function getTable(table, select = '*', filter = null, order = null) {
  let query = supabase.from(table).select(select);
  if (filter) Object.keys(filter).forEach(k => query = query.eq(k, filter[k]));
  if (order) query = query.order(order.by, { ascending: order.ascending });
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

// ========== FUNGSI KHUSUS ==========
async function getProducts() { return await getTable('products', '*', null, { by: 'id', ascending: true }); }
async function saveProduct(p) { return await upsertRow('products', p); }
async function deleteProduct(id) { await deleteRow('products', id); }

async function getOrders() { return await getTable('orders', '*', null, { by: 'created_at', ascending: false }); }
async function saveOrder(o) { return await upsertRow('orders', o); }
async function deleteOrder(id) { await deleteRow('orders', id); }

async function getTransactions() { return await getTable('transactions', '*', null, { by: 'date', ascending: false }); }
async function saveTransaction(t) { return await upsertRow('transactions', t); }
async function deleteTransaction(id) { await deleteRow('transactions', id); }

async function getBankInfo() { return await getTable('bank_info', '*'); }
async function saveBankInfo(b) { return await upsertRow('bank_info', b); }
async function deleteBankInfo(id) { await deleteRow('bank_info', id); }

async function getSlides() { return await getTable('slides', '*'); }
async function saveSlide(s) { return await upsertRow('slides', s); }
async function deleteSlide(id) { await deleteRow('slides', id); }

async function getFaqs() { return await getTable('faq', '*'); }
async function saveFaq(f) { return await upsertRow('faq', f); }
async function deleteFaq(id) { await deleteRow('faq', id); }

async function getFeatures() { return await getTable('features', '*'); }
async function saveFeature(f) { return await upsertRow('features', f); }
async function deleteFeature(id) { await deleteRow('features', id); }

async function getAbout() { const d = await getTable('about', '*'); return d.length ? d[0] : { id: 1, title: '', content: '' }; }
async function saveAbout(a) { return await upsertRow('about', a); }

async function getFooter() { const d = await getTable('footer', '*'); return d.length ? d[0] : { id: 1, brand: '', description: '', copyright: '', social: {} }; }
async function saveFooter(f) { return await upsertRow('footer', f); }

async function getSettings() {
  const rows = await getTable('settings');
  const settings = {};
  rows.forEach(r => settings[r.key] = r.value);
  return settings;
}
async function saveSettings(settings) {
  const promises = Object.keys(settings).map(key => upsertRow('settings', { key, value: settings[key] }));
  await Promise.all(promises);
}

// ========== EXPOSE KE GLOBAL ==========
window.supabase = supabase;
window.signUp = signUp;
window.signIn = signIn;
window.signOut = signOut;
window.getCurrentUser = getCurrentUser;
window.getSession = getSession;
window.getUserProfile = getUserProfile;
window.getUserByEmail = getUserByEmail;
window.updateUserProfile = updateUserProfile;
window.getProducts = getProducts;
window.saveProduct = saveProduct;
window.deleteProduct = deleteProduct;
window.getOrders = getOrders;
window.saveOrder = saveOrder;
window.deleteOrder = deleteOrder;
window.getTransactions = getTransactions;
window.saveTransaction = saveTransaction;
window.deleteTransaction = deleteTransaction;
window.getBankInfo = getBankInfo;
window.saveBankInfo = saveBankInfo;
window.deleteBankInfo = deleteBankInfo;
window.getSlides = getSlides;
window.saveSlide = saveSlide;
window.deleteSlide = deleteSlide;
window.getFaqs = getFaqs;
window.saveFaq = saveFaq;
window.deleteFaq = deleteFaq;
window.getFeatures = getFeatures;
window.saveFeature = saveFeature;
window.deleteFeature = deleteFeature;
window.getAbout = getAbout;
window.saveAbout = saveAbout;
window.getFooter = getFooter;
window.saveFooter = saveFooter;
window.getSettings = getSettings;
window.saveSettings = saveSettings;
window.getTable = getTable;
window.upsertRow = upsertRow;
window.deleteRow = deleteRow;
