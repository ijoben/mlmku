// supabase.js - FULL LENGKAP DENGAN STORAGE & BONUS
console.log('🔵 supabase.js mulai dieksekusi...');

var SUPABASE_URL = 'https://dbfwcsuptitytlposubo.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiZndjc3VwdGl0eXRscG9zdWJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NTgyMjMsImV4cCI6MjEwMTQzNDIyM30.TGAANDziz0olPdPIwAgtfiOPzfqxGVIfvNoLFhOsGQY';

// Buat client
var supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('🔵 Supabase client created:', !!supabaseClient);

// ============================================================
// EXPOSE SUPABASE CLIENT KE WINDOW
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
    if (!session) return null;
    var { data, error } = await supabaseClient
      .from('users')
      .select('*')
      .eq('id', session.user.id);
    if (error) {
      console.error('🔴 getUserProfile error:', error);
      return null;
    }
    return (data && data.length > 0) ? data[0] : null;
  } catch (e) {
    console.error('🔴 getUserProfile exception:', e);
    return null;
  }
};

window.getUserById = async function(id) {
  if (!id) return null;
  console.log('🔵 getUserById dipanggil untuk:', id);
  var { data, error } = await supabaseClient
    .from('users')
    .select('*')
    .eq('id', id);
  if (error) {
    console.error('🔴 getUserById error:', error);
    return null;
  }
  return (data && data.length > 0) ? data[0] : null;
};

window.getUserByEmail = async function(email) {
  if (!email) return null;
  console.log('🔵 getUserByEmail dipanggil untuk:', email);
  var { data, error } = await supabaseClient
    .from('users')
    .select('*')
    .eq('email', email);
  if (error) {
    console.error('🔴 getUserByEmail error:', error);
    return null;
  }
  return (data && data.length > 0) ? data[0] : null;
};

window.getUserByUsername = async function(username) {
  console.log('🔵 getUserByUsername dipanggil untuk:', username);
  if (!username) return null;
  var { data } = await supabaseClient
    .from('users')
    .select('*')
    .eq('username', username);
  if (data && data.length > 0) return data[0];
  
  var { data: dataById } = await supabaseClient
    .from('users')
    .select('*')
    .eq('id', username);
  return (dataById && dataById.length > 0) ? dataById[0] : null;
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
  var payload = { ...data };
  var { data: result, error } = await supabaseClient
    .from(table)
    .upsert(payload)
    .select();
  if (error) {
    if (error.message && error.message.includes('Could not find the') && error.message.includes('column')) {
      console.warn('⚠️ Column missing in schema, stripping unknown column and retrying upsert:', error.message);
      var match = error.message.match(/Could not find the '([^']+)' column/);
      if (match && match[1]) {
        delete payload[match[1]];
        var retry = await supabaseClient
          .from(table)
          .upsert(payload)
          .select();
        if (!retry.error) {
          console.log('✅ upsertRow retry berhasil');
          return retry.data ? retry.data[0] : payload;
        }
      }
    }
    console.error('🔴 upsertRow error:', error);
    throw error;
  }
  console.log('✅ upsertRow berhasil');
  return result ? result[0] : payload;
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

window.uploadFile = async function(file, folder = 'products') {
  console.log('🔵 uploadFile dipanggil:', file ? file.name : 'no file');
  if (!file) return null;
  
  try {
    var fileExt = (file.name && file.name.includes('.')) ? file.name.split('.').pop() : 'jpg';
    var fileName = Date.now() + '-' + Math.random().toString(36).substring(2, 7) + '.' + fileExt;
    var filePath = folder + '/' + fileName;
    
    var { data, error } = await supabaseClient
      .storage
      .from('hedtro-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });
    
    if (error) {
      console.warn('⚠️ Storage upload warning:', error.message);
      return null;
    }
    
    var { data: publicUrlData } = supabaseClient
      .storage
      .from('hedtro-images')
      .getPublicUrl(filePath);
    
    console.log('✅ Upload Storage berhasil:', publicUrlData?.publicUrl);
    return publicUrlData?.publicUrl || null;
    
  } catch (error) {
    console.warn('⚠️ Storage upload exception:', error);
    return null;
  }
};

window.deleteFile = async function(fileUrl) {
  console.log('🔵 deleteFile dipanggil:', fileUrl);
  
  try {
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
    }
    console.log('✅ Delete berhasil:', filePath);
    
  } catch (error) {
    console.error('❌ Delete error:', error);
  }
};

window.uploadImage = async function(file, folder = 'products', maxSize = 2 * 1024 * 1024) {
  console.log('🔵 uploadImage dipanggil:', file.name);
  
  try {
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
// BONUS CALCULATION FUNCTIONS (BARU!)
// ============================================================

// 1. Hitung Bonus Sponsor
window.calculateSponsorBonus = async function(userId, sponsorId, amount, settings) {
  var sponsorBonusPercent = parseFloat(settings.sponsorBonus) || 10;
  var bonusAmount = (amount * sponsorBonusPercent) / 100;
  
  if (bonusAmount <= 0 || !sponsorId || String(sponsorId) === String(userId)) return;
  
  try {
    var sponsor = await window.getUserById(sponsorId);
    if (sponsor) {
      sponsor.bonus_sponsor = (parseFloat(sponsor.bonus_sponsor) || 0) + bonusAmount;
      sponsor.wallet = (parseFloat(sponsor.wallet) || 0) + bonusAmount;
      await window.upsertRow('users', sponsor);
      console.log('✅ Bonus Sponsor Rp' + bonusAmount + ' -> Sponsor: ' + sponsor.username);
    }
  } catch (e) {
    console.error('Error calculating sponsor bonus:', e);
  }
};

// 2. Hitung Bonus Binary (10 Level Upline)
window.calculateBinaryBonus = async function(userId, amount, settings) {
  var binaryLevels = settings.binaryBonusLevels || [10, 8, 6, 5, 4, 3, 2, 1.5, 1, 0.5];
  try {
    var buyer = await window.getUserById(userId);
    if (!buyer) return;
    
    // PENTING: Bonus Binary diberikan ke UPLINE DI ATAS buyer, BUKAN ke buyer itu sendiri!
    var currentUserId = buyer.sponsor_id || buyer.upline_id;
    var level = 0;
    
    while (currentUserId && level < 10) {
      var upline = await window.getUserById(currentUserId);
      if (!upline || String(upline.id) === String(userId)) break;
      
      var bonusPercent = parseFloat(binaryLevels[level]) || 0;
      var bonusAmount = (amount * bonusPercent) / 100;
      
      if (bonusAmount > 0) {
        upline.bonus_binary = (parseFloat(upline.bonus_binary) || 0) + bonusAmount;
        upline.wallet = (parseFloat(upline.wallet) || 0) + bonusAmount;
        await window.upsertRow('users', upline);
        console.log('✅ Bonus Binary Rp' + bonusAmount + ' (' + bonusPercent + '%) -> Upline L' + (level+1) + ': ' + upline.username);
      }
      
      currentUserId = upline.sponsor_id || upline.upline_id;
      level++;
    }
  } catch (e) {
    console.error('Error calculating binary bonus:', e);
  }
};

// 3. Hitung Bonus Reward (5 Level Upline)
window.calculateRewardBonus = async function(userId, amount, settings) {
  var rewardLevels = settings.rewardBonusLevels || [5, 4, 3, 2, 1];
  try {
    var buyer = await window.getUserById(userId);
    if (!buyer) return;
    
    // PENTING: Bonus Reward diberikan ke UPLINE DI ATAS buyer, BUKAN ke buyer itu sendiri!
    var currentUserId = buyer.sponsor_id || buyer.upline_id;
    var level = 0;
    
    while (currentUserId && level < 5) {
      var upline = await window.getUserById(currentUserId);
      if (!upline || String(upline.id) === String(userId)) break;
      
      var bonusPercent = parseFloat(rewardLevels[level]) || 0;
      var bonusAmount = (amount * bonusPercent) / 100;
      
      if (bonusAmount > 0) {
        upline.bonus_reward = (parseFloat(upline.bonus_reward) || 0) + bonusAmount;
        upline.wallet = (parseFloat(upline.wallet) || 0) + bonusAmount;
        await window.upsertRow('users', upline);
        console.log('✅ Bonus Reward Rp' + bonusAmount + ' (' + bonusPercent + '%) -> Upline L' + (level+1) + ': ' + upline.username);
      }
      
      currentUserId = upline.sponsor_id || upline.upline_id;
      level++;
    }
  } catch (e) {
    console.error('Error calculating reward bonus:', e);
  }
};

// 4. Hitung Bonus RO (Repeat Order ke Sponsor)
window.calculateRoBonus = async function(userId, amount, settings) {
  var roBonusPercent = parseFloat(settings.roBonus) || 3;
  var bonusAmount = (amount * roBonusPercent) / 100;
  
  if (bonusAmount <= 0) return;
  
  try {
    var buyer = await window.getUserById(userId);
    if (!buyer || !buyer.sponsor_id) return;
    
    // Bonus RO diberikan kepada SPONSOR dari pembeli
    var sponsor = await window.getUserById(buyer.sponsor_id);
    if (sponsor && String(sponsor.id) !== String(userId)) {
      sponsor.bonus_ro = (parseFloat(sponsor.bonus_ro) || 0) + bonusAmount;
      sponsor.wallet = (parseFloat(sponsor.wallet) || 0) + bonusAmount;
      await window.upsertRow('users', sponsor);
      console.log('✅ Bonus RO Rp' + bonusAmount + ' -> Sponsor: ' + sponsor.username);
    }
  } catch (e) {
    console.error('Error calculating RO bonus:', e);
  }
};

// 5. Fungsi wrapper untuk hitung semua bonus (kecuali RO)
window.calculateAllBonuses = async function(userId, sponsorId, amount, settings) {
  console.log('🔵 Calculating all bonuses...');
  
  // 1. Sponsor Bonus
  await window.calculateSponsorBonus(userId, sponsorId, amount, settings);
  
  // 2. Binary Bonus (10 level)
  await window.calculateBinaryBonus(userId, amount, settings);
  
  // 3. Reward Bonus (5 level)
  await window.calculateRewardBonus(userId, amount, settings);
  
  console.log('✅ All bonuses calculated!');
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
// ORDERS HELPERS
// ============================================================
window.getOrders = async function() {
  try {
    var rows = await window.getTable('orders', '*');
    return rows || [];
  } catch (e) {
    console.warn('⚠️ getOrders warning:', e);
    return [];
  }
};

window.saveOrder = async function(order) {
  console.log('🔵 saveOrder dipanggil:', order);
  if (!order) return null;

  // 1. Try upsert to Supabase 'orders' table
  try {
    var { data, error } = await supabaseClient
      .from('orders')
      .upsert(order)
      .select();
    
    if (error) {
      console.warn('⚠️ Supabase orders table upsert error:', error.message);
    } else {
      console.log('✅ saveOrder ke Supabase orders table berhasil');
    }
  } catch (e) {
    console.warn('⚠️ saveOrder catch:', e);
  }

  // 2. Sync order into user profile in 'users' table to guarantee data persistence
  try {
    if (order.user_id) {
      var user = await window.getUserById(order.user_id);
      if (user) {
        if (order.type === 'first_order') {
          user.first_order = order;
        }
        if (!user.purchase_history) user.purchase_history = [];
        var idx = user.purchase_history.findIndex(p => String(p.id) === String(order.id));
        var purchaseRecord = {
          id: order.id,
          date: order.created_at || new Date().toISOString(),
          productName: (order.items && order.items[0]) ? order.items[0].name : (order.type === 'first_order' ? '🎯 Paket First Order' : 'Produk'),
          price: order.total || 0,
          status: order.status || 'pending',
          paymentMethod: order.paymentMethod || 'bank',
          proof_uploaded: !!order.proof_image,
          proof_image: order.proof_image || null,
          type: order.type || 'ro',
          resi: order.resi || null
        };
        if (idx >= 0) {
          user.purchase_history[idx] = purchaseRecord;
        } else {
          user.purchase_history.push(purchaseRecord);
        }
        await window.upsertRow('users', user);
        console.log('✅ saveOrder sync ke user profile berhasil');
      }
    }
  } catch (userErr) {
    console.warn('⚠️ saveOrder user sync warning:', userErr);
  }

  return order;
};

// ============================================================
// APPROVE ORDER & DISTRIBUTE BONUSES
// ============================================================
window.approveOrderAndDistributeBonuses = async function(orderId) {
  console.log('🔵 Approving order & distributing bonuses for orderId:', orderId);
  var order = null;

  // 1. Ambil data order dari tabel orders (tanpa .single() untuk mencegah PGRST116)
  try {
    var { data: ordersData } = await supabaseClient
      .from('orders')
      .select('*')
      .eq('id', orderId);
    
    if (ordersData && ordersData.length > 0) {
      order = ordersData[0];
    }
  } catch (e) {
    console.warn('⚠️ Query orders table warning:', e);
  }

  // 2. Fallback: Cari di tabel users jika order tidak ditemukan di tabel orders
  if (!order) {
    var allUsers = await window.getTable('users');
    for (var i = 0; i < (allUsers || []).length; i++) {
      var u = allUsers[i];
      if (u.first_order && String(u.first_order.id) === String(orderId)) {
        order = u.first_order;
        break;
      }
      if (u.purchase_history && u.purchase_history.length > 0) {
        var foundP = u.purchase_history.find(p => String(p.id) === String(orderId));
        if (foundP) {
          order = {
            id: foundP.id,
            user_id: u.id,
            user_name: u.fullname || u.username,
            type: foundP.type || 'ro',
            total: foundP.price || foundP.amount || 0,
            status: foundP.status || 'pending',
            proof_image: foundP.proof_image || u.proof_image || null
          };
          break;
        }
      }
    }
  }

  if (!order) {
    throw new Error('Pesanan #' + orderId + ' tidak ditemukan');
  }

  if (order.status === 'processing' || order.status === 'completed' || order.status === 'shipped') {
    return { alreadyProcessed: true };
  }

  // 3. Update status order menjadi processing di tabel orders (jika ada)
  try {
    await supabaseClient
      .from('orders')
      .update({ status: 'processing' })
      .eq('id', orderId);
  } catch (e) {
    console.warn('⚠️ Update orders status warning:', e);
  }

  // 4. Ambil data pembeli / member
  var buyer = await window.getUserById(order.user_id);
  if (!buyer) return { success: true };

  // 5. Ubah status member menjadi 'verified' & status pesanan lokal menjadi 'processing'
  buyer.status = 'verified';
  if (buyer.first_order && String(buyer.first_order.id) === String(orderId)) {
    buyer.first_order.status = 'processing';
  }
  if (buyer.purchase_history) {
    buyer.purchase_history.forEach(p => {
      if (String(p.id) === String(orderId)) p.status = 'processing';
    });
  }

  // 6. Load Pengaturan Sistem untuk persentase bonus
  var { data: settingsData } = await supabaseClient.from('settings').select('*');
  var settings = {};
  (settingsData || []).forEach(function(r) { settings[r.key] = r.value; });

  var orderAmount = parseFloat(order.total) || 0;

  // 7. Hitung & distribusikan bonus jika total order > 0
  if (orderAmount > 0) {
    if (order.type === 'first_order') {
      if (buyer.sponsor_id) {
        await window.calculateSponsorBonus(buyer.id, buyer.sponsor_id, orderAmount, settings);
      }
      await window.calculateBinaryBonus(buyer.id, orderAmount, settings);
      await window.calculateRewardBonus(buyer.id, orderAmount, settings);
    } else if (order.type === 'ro') {
      if (buyer.sponsor_id) {
        await window.calculateSponsorBonus(buyer.id, buyer.sponsor_id, orderAmount, settings);
      }
      await window.calculateBinaryBonus(buyer.id, orderAmount, settings);
      await window.calculateRewardBonus(buyer.id, orderAmount, settings);
      await window.calculateRoBonus(buyer.id, orderAmount, settings);
    }
  }

  await window.upsertRow('users', buyer);
  console.log('✅ Order approved & bonuses distributed successfully for buyer:', buyer.username);
  return { success: true };
};

// ============================================================
// BRAND LOGO & FAVICON DYNAMIC APPLICATION
// ============================================================
window.applyBrandSettings = async function() {
  try {
    var settings = {};
    if (typeof window.getTable === 'function') {
      try {
        var settingsData = await window.getTable('settings', '*');
        (settingsData || []).forEach(function(r) { settings[r.key] = r.value; });
      } catch (err) {
        console.warn('Unable to fetch settings table, fallback to localStorage', err);
      }
    }

    var brandName = settings.brandName || settings.site_name || localStorage.getItem('hedtro_brand_name') || 'HEDTRO JEANS';
    var brandLogo = settings.brandLogo || settings.site_logo || localStorage.getItem('hedtro_brand_logo') || '';
    var brandIcon = settings.brandIcon || settings.site_icon || localStorage.getItem('hedtro_brand_icon') || '';

    if (brandName) localStorage.setItem('hedtro_brand_name', brandName);
    if (brandLogo) localStorage.setItem('hedtro_brand_logo', brandLogo);
    if (brandIcon) localStorage.setItem('hedtro_brand_icon', brandIcon);

    var isImageLogo = brandLogo && (
      brandLogo.startsWith('data:image') ||
      brandLogo.startsWith('http://') ||
      brandLogo.startsWith('https://') ||
      brandLogo.startsWith('/') ||
      brandLogo.startsWith('./')
    );

    // Target all key brand logo containers across all pages
    var selectors = '#headerLogo, #navbarLogo, #brandLogo, #sidebarLogo, #sideBrandLogo, .login-card .logo h1, #loginLogoHeading, #registerLogoHeading, .logo-icon';
    var logoElements = document.querySelectorAll(selectors);

    logoElements.forEach(function(el) {
      if (!el) return;

      if (isImageLogo) {
        // Hide text logo completely when image logo is uploaded ("klw upload logo textnya hiden saja")
        var isCardHeading = (el.tagName === 'H1');
        var maxH = isCardHeading ? '48px' : '36px';
        
        el.innerHTML = '<img class="brand-logo-img" src="' + brandLogo + '" alt="' + brandName + '" style="max-height:' + maxH + '; width:auto; object-fit:contain; vertical-align:middle; display:inline-block;" />';
      } else {
        // Show icon + text if logo is a fontawesome icon string or default
        var iconClass = (brandLogo && brandLogo.startsWith('fa-')) ? brandLogo : 'fa-tshirt';
        
        if (el.classList.contains('logo-icon')) {
          el.innerHTML = '<i class="fas ' + iconClass + '"></i>';
        } else if (el.id === 'sidebarLogo' || el.id === 'sideBrandLogo' || el.classList.contains('logo-side')) {
          el.innerHTML = '<i class="fas ' + iconClass + '"></i> ' + (brandName.split(' ')[0] || 'HEDTRO');
        } else if (el.id === 'headerLogo' || el.id === 'navbarLogo' || el.id === 'brandLogo') {
          if (brandName === 'HEDTRO JEANS' || brandName === 'HEDTRO') {
            el.innerHTML = '<i class="fas ' + iconClass + '"></i> HEDTRO<span>JEANS</span>';
          } else {
            el.innerHTML = '<i class="fas ' + iconClass + '"></i> ' + brandName;
          }
        } else {
          el.innerHTML = '<i class="fas ' + iconClass + '"></i> ' + brandName;
        }
      }
    });

    // Update Favicon Link
    if (brandIcon && (brandIcon.startsWith('data:image') || brandIcon.startsWith('http://') || brandIcon.startsWith('https://') || brandIcon.startsWith('/'))) {
      var favicon = document.querySelector("link[rel*='icon']");
      if (!favicon) {
        favicon = document.createElement('link');
        favicon.rel = 'shortcut icon';
        document.getElementsByTagName('head')[0].appendChild(favicon);
      }
      favicon.href = brandIcon;
    }
  } catch (e) {
    console.warn('applyBrandSettings warning:', e);
  }
};

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(window.applyBrandSettings, 50);
} else {
  document.addEventListener('DOMContentLoaded', window.applyBrandSettings);
}

// LOG KONFIRMASI
console.log('✅ supabase.js selesai dieksekusi!');
console.log('✅ window.applyBrandSettings:', typeof window.applyBrandSettings);

// ============================================================
// GLOBAL TOP LOADING BAR & UTILITIES
// ============================================================
window.showLoadingBar = function() {
  var bar = document.getElementById('globalLoadingBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'globalLoadingBar';
    bar.style.cssText = 'position:fixed; top:0; left:0; height:3.5px; background:linear-gradient(90deg, #c9a84c, #e8d5a3, #2a4b6e, #c9a84c); z-index:999999; width:0%; transition:width 0.3s ease, opacity 0.4s ease; box-shadow:0 0 12px rgba(201,168,76,0.9); pointer-events:none; opacity:1;';
    document.body.appendChild(bar);
  }
  bar.style.opacity = '1';
  bar.style.width = '35%';
  if (window._loadingBarTimer) clearTimeout(window._loadingBarTimer);
  window._loadingBarTimer = setTimeout(function() {
    if (bar.style.width === '35%') bar.style.width = '75%';
  }, 250);
};

window.hideLoadingBar = function() {
  var bar = document.getElementById('globalLoadingBar');
  if (bar) {
    bar.style.width = '100%';
    setTimeout(function() {
      bar.style.opacity = '0';
      setTimeout(function() { bar.style.width = '0%'; }, 400);
    }, 250);
  }
};

window.getUniqueCode = function(seed) {
  var val = Math.abs(parseInt(seed) || Math.floor(Math.random() * 899) + 100);
  return (val % 899) + 100; // Returns consistent 3-digit code (100 - 998)
};

window.formatMemberId = function(user) {
  if (!user) return 'HDT-001';
  if (user.member_id) return user.member_id;
  var num = user.id ? parseInt(user.id) : 1;
  if (isNaN(num)) return 'HDT-' + String(user.username || '001').toUpperCase();
  return 'HDT-' + String(num).padStart(3, '0');
};
