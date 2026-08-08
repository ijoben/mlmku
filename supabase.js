// supabase.js - FULL LENGKAP DENGAN STORAGE
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
// STORAGE FUNCTIONS (Upload & Delete Gambar)
// ============================================================

// Upload file ke Supabase Storage
window.uploadFile = async function(file, folder = 'products') {
  console.log('🔵 uploadFile dipanggil:', file.name);
  
  try {
    // Generate nama file unik
    var fileExt = file.name.split('.').pop();
    var fileName = Date.now() + '-' + Math.random().toString(36).substring(2, 7) + '.' + fileExt;
    var filePath = folder + '/' + fileName;
    
    // Upload ke Supabase Storage
    var { data, error } = await supabaseClient
      .storage
      .from('hedtro-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });
    
    if (error) {
      console.error('🔴 Upload error:', error);
      throw error;
    }
    
    // Dapatkan URL publik
    var { data: publicUrlData } = supabaseClient
      .storage
      .from('hedtro-images')
      .getPublicUrl(filePath);
    
    console.log('✅ Upload berhasil:', publicUrlData.publicUrl);
    return publicUrlData.publicUrl;
    
  } catch (error) {
    console.error('❌ Upload error:', error);
    throw error;
  }
};

// Hapus file dari Storage
window.deleteFile = async function(fileUrl) {
  console.log('🔵 deleteFile dipanggil:', fileUrl);
  
  try {
    // Extract path dari URL
    var urlParts = fileUrl.split('/');
    var filePath = urlParts.slice(urlParts.indexOf('hedtro-images') + 1).join('/');
    
    if (!filePath) {
      console.log('⚠️ Tidak ada file path');
      return;
    }
    
    var { error } = await supabaseClient
      .storage
      .from('hedtro-images')
      .remove([filePath]);
    
    if (error) {
      console.error('🔴 Delete error:', error);
      // Jangan throw, biarkan lanjut
    }
    console.log('✅ Delete berhasil:', filePath);
    
  } catch (error) {
    console.error('❌ Delete error:', error);
    // Jangan throw, karena file mungkin sudah tidak ada
  }
};

// Upload gambar dengan kompresi otomatis
window.uploadImage = async function(file, folder = 'products', maxSize = 2 * 1024 * 1024) {
  console.log('🔵 uploadImage dipanggil:', file.name);
  
  try {
    // Cek ukuran file
    if (file.size > maxSize) {
      console.log('🔄 Kompres gambar...');
      var compressed = await window.compressImageFile(file, 800, 0.7);
      return await window.uploadFile(compressed, folder);
    }
    
    return await window.uploadFile(file, folder);
  } catch (error) {
    console.error('❌ uploadImage error:', error);
    throw error;
  }
};

// Kompres file gambar sebelum upload
window.compressImageFile = function(file, maxWidth, quality) {
  maxWidth = maxWidth || 800;
  quality = quality || 0.7;
  
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        var canvas = document.createElement('canvas');
        var width = img.width;
        var height = img.height;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(function(blob) {
          var compressedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          resolve(compressedFile);
        }, 'image/jpeg', quality);
      };
      img.onerror = function() {
        reject(new Error('Gagal mengompres gambar'));
      };
      img.src = e.target.result;
    };
    reader.onerror = function() {
      reject(new Error('Gagal membaca file'));
    };
    reader.readAsDataURL(file);
  });
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
console.log('✅ window.uploadFile:', typeof window.uploadFile);
console.log('✅ window.deleteFile:', typeof window.deleteFile);
console.log('✅ window.uploadImage:', typeof window.uploadImage);
console.log('✅ window.compressImageFile:', typeof window.compressImageFile);
