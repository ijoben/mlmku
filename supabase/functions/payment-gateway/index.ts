// @ts-nocheck
// ============================================================
// Edge Function: payment-gateway
// Payment gateway gaya Tripay untuk HEDTRO:
//   - Sandbox (default) : kanal VA / QRIS / E-Wallet / Retail
//     dibuat & disimulasikan sendiri, tanpa akun merchant.
//   - Live (Tripay)     : transaksi asli via API Tripay begitu
//     API key diisi di environment secrets.
//
// Action (POST /payment-gateway):
//   { action:'channels' }                     -> daftar kanal pembayaran
//   { action:'create', orderId, channel }     -> buat pembayaran utk order
//   { action:'status', reference }            -> cek status pembayaran
//   { action:'simulate', reference }          -> (sandbox) tandai lunas
//   { action:'webhook', ...Tripay payload }   -> callback resmi Tripay
//   { action:'config' }                       -> mode & status konfigurasi
//   { action:'list' }                         -> (admin) daftar pembayaran
//
// Environment secrets yang dibutuhkan (Supabase → Edge Functions → Secrets):
//   TRIPAY_API_KEY       -> kunci API merchant Tripay
//   TRIPAY_PRIVATE_KEY   -> kunci privat (utk tanda tangan)
//   TRIPAY_MERCHANT_CODE -> kode merchant
//   TRIPAY_API_BASE      -> https://tripay.co.id/api  (atau /api-sandbox utk tes)
//   PAYMENT_INTERNAL_KEY -> string rahasia acak, SAMA dengan env
//                           PAYMENT_INTERNAL_KEY di fungsi distribute-bonus
// Deploy:
//   supabase functions deploy payment-gateway
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TRIPAY_API_KEY = Deno.env.get("TRIPAY_API_KEY") || "";
const TRIPAY_PRIVATE_KEY = Deno.env.get("TRIPAY_PRIVATE_KEY") || "";
const TRIPAY_MERCHANT_CODE = Deno.env.get("TRIPAY_MERCHANT_CODE") || "";
const TRIPAY_API_BASE = Deno.env.get("TRIPAY_API_BASE") || "https://tripay.co.id/api";
const PAYMENT_INTERNAL_KEY = Deno.env.get("PAYMENT_INTERNAL_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-key",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const tripayConfigured = !!(TRIPAY_API_KEY && TRIPAY_PRIVATE_KEY && TRIPAY_MERCHANT_CODE);

// ---------- Kanal sandbox (gaya Tripay) ----------
const SANDBOX_CHANNELS = [
  { code: "BCAVA",     name: "Virtual Account BCA",     group: "va",     fee_fixed: 4000, fee_percent: 0, icon: "fa-university", desc: "ATM / m-Banking / iBanking BCA" },
  { code: "BNIVA",     name: "Virtual Account BNI",     group: "va",     fee_fixed: 4000, fee_percent: 0, icon: "fa-university", desc: "ATM / m-Banking / iBanking BNI" },
  { code: "BRIVA",     name: "Virtual Account BRI",     group: "va",     fee_fixed: 4000, fee_percent: 0, icon: "fa-university", desc: "ATM / BRImo / iBanking BRI" },
  { code: "MANDIRIVA", name: "Virtual Account Mandiri", group: "va",     fee_fixed: 4000, fee_percent: 0, icon: "fa-university", desc: "ATM / Livin' / internet banking" },
  { code: "PERMATAVA", name: "Virtual Account Permata", group: "va",     fee_fixed: 4000, fee_percent: 0, icon: "fa-university", desc: "ATM / mobile banking Permata" },
  { code: "QRIS",      name: "QRIS (Semua Aplikasi)",   group: "qris",   fee_fixed: 0,    fee_percent: 0.7, icon: "fa-qrcode", desc: "GoPay, OVO, DANA, ShopeePay, dll" },
  { code: "OVO",       name: "OVO",                     group: "ewallet", fee_fixed: 0,   fee_percent: 2, icon: "fa-wallet", desc: "Bayar lewat aplikasi OVO" },
  { code: "GOPAY",     name: "GoPay",                   group: "ewallet", fee_fixed: 0,   fee_percent: 2, icon: "fa-wallet", desc: "Bayar lewat aplikasi Gojek" },
  { code: "DANA",      name: "DANA",                    group: "ewallet", fee_fixed: 0,   fee_percent: 2, icon: "fa-wallet", desc: "Bayar lewat aplikasi DANA" },
  { code: "SHOPEEPAY", name: "ShopeePay",               group: "ewallet", fee_fixed: 0,   fee_percent: 2, icon: "fa-wallet", desc: "Bayar lewat aplikasi Shopee" },
  { code: "LINKAJA",   name: "LinkAja",                 group: "ewallet", fee_fixed: 0,   fee_percent: 2, icon: "fa-wallet", desc: "Bayar lewat aplikasi LinkAja" },
  { code: "ALFAMART",  name: "Alfamart",                group: "retail", fee_fixed: 2500, fee_percent: 0, icon: "fa-store", desc: "Bayar di kasir Alfamart terdekat" },
  { code: "INDOMARET", name: "Indomaret",               group: "retail", fee_fixed: 2500, fee_percent: 0, icon: "fa-store", desc: "Bayar di kasir Indomaret terdekat" },
];

// Prefiks VA sandbox per bank
const VA_PREFIX = { BCAVA: "880", BNIVA: "881", BRIVA: "882", MANDIRIVA: "883", PERMATAVA: "886" };

function randDigits(len) {
  let s = "";
  for (let i = 0; i < len; i++) s += Math.floor(Math.random() * 10);
  return s;
}

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function makeReference() {
  return "HDT" + Date.now().toString(36).toUpperCase() + randDigits(4);
}

// ---------- QRIS payload (EMVCo) untuk sandbox ----------
function emvLen(s) { const n = String(s).length; return n < 10 ? "0" + n : String(n); }

function crc16CCITT(payload) {
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function buildQrisPayload(merchantPan, amount, reference, merchantName, city) {
  const txnAmt = Number(amount).toFixed(2);
  const acctInfo = "00" + emvLen("ID.CO.QRIS.WWW") + "ID.CO.QRIS.WWW" + "01" + emvLen(merchantPan) + merchantPan;
  const additional = "01" + emvLen(reference) + reference;
  const body =
    "000201" +
    "010212" +
    "26" + emvLen(acctInfo) + acctInfo +
    "5204" + "5311" +
    "5303" + "360" +
    "54" + emvLen(txnAmt) + txnAmt +
    "5802" + "ID" +
    "59" + emvLen(merchantName) + merchantName +
    "60" + emvLen(city) + city +
    "62" + emvLen(additional) + additional +
    "6304";
  return body + crc16CCITT(body);
}

// ---------- Instruksi pembayaran per kanal (sandbox) ----------
function buildInstructions(channel, payCode, amount, uniqueCode, expiredAt, extra) {
  const fmt = (n) => "Rp " + Number(n).toLocaleString("id-ID");
  const bankMap = {
    BCAVA: { bank: "BCA", step: ["Buka aplikasi BCA mobile / iBanking / ATM BCA", "Pilih menu Transfer → Virtual Account / BCA Virtual Account", `Masukkan nomor Virtual Account: <b>${payCode}</b>`, `Masukkan nominal <b>${fmt(amount)}</b> (pastikan TEPAT)`, "Klik kirim & ikuti instruksi hingga selesai"] },
    BNIVA: { bank: "BNI", step: ["Buka aplikasi BNI mobile / ATM BNI", "Pilih menu Transfer → Virtual Account / Rekening Virtual", `Masukkan nomor Virtual Account: <b>${payCode}</b>`, `Masukkan nominal <b>${fmt(amount)}</b>`, "Konfirmasi & selesaikan transaksi"] },
    BRIVA: { bank: "BRI", step: ["Buka aplikasi BRImo / ATM BRI", "Pilih menu Bayar / Transfer → BRIVA (Virtual Account)", `Masukkan nomor Virtual Account: <b>${payCode}</b>`, `Masukkan nominal <b>${fmt(amount)}</b>`, "Konfirmasi & selesaikan transaksi"] },
    MANDIRIVA: { bank: "Mandiri", step: ["Buka aplikasi Livin' by Mandiri / ATM Mandiri", "Pilih menu Transfer → Virtual Account", `Masukkan nomor Virtual Account: <b>${payCode}</b>`, `Masukkan nominal <b>${fmt(amount)}</b>`, "Konfirmasi & selesaikan transaksi"] },
    PERMATAVA: { bank: "Permata", step: ["Buka aplikasi Permata Mobile X / ATM Permata", "Pilih menu Transfer → Virtual Account", `Masukkan nomor Virtual Account: <b>${payCode}</b>`, `Masukkan nominal <b>${fmt(amount)}</b>`, "Konfirmasi & selesaikan transaksi"] },
  };
  if (bankMap[channel]) {
    return {
      type: "va",
      title: "Bayar via Virtual Account " + bankMap[channel].bank,
      bank: bankMap[channel].bank,
      vaNumber: payCode,
      amount,
      steps: bankMap[channel].step,
      note: `Pembayaran otomatis terverifikasi. Pembayaran berlaku sampai ${expiredAt}.`,
    };
  }
  if (channel === "QRIS") {
    return {
      type: "qris",
      title: "Scan QRIS dengan aplikasi apa pun",
      amount,
      uniqueCode,
      steps: [
        "Buka aplikasi pembayaran apa pun (GoPay, OVO, DANA, ShopeePay, LinkAja, m-Banking, dll)",
        "Pilih menu Scan / QRIS lalu pindai kode QR di bawah",
        `Periksa nominal <b>${fmt(amount)}</b> (sudah termasuk kode unik ${uniqueCode})`,
        "Masukkan PIN & konfirmasi pembayaran",
      ],
      note: `Pembayaran otomatis terverifikasi. Berlaku sampai ${expiredAt}.`,
    };
  }
  const ewalletNames = { OVO: "OVO", GOPAY: "GoPay", DANA: "DANA", SHOPEEPAY: "ShopeePay", LINKAJA: "LinkAja" };
  if (ewalletNames[channel]) {
    const app = ewalletNames[channel];
    return {
      type: "ewallet",
      title: "Bayar via " + app,
      app,
      payCode,
      amount,
      uniqueCode,
      steps: [
        `Buka aplikasi ${app}`,
        `Pilih menu Bayar / Transfer ke nomor ${app} / Scan`,
        `Masukkan kode pembayaran: <b>${payCode}</b>`,
        `Periksa nominal <b>${fmt(amount)}</b> (termasuk kode unik ${uniqueCode})`,
        "Masukkan PIN & konfirmasi",
      ],
      note: `Pembayaran otomatis terverifikasi. Berlaku sampai ${expiredAt}.`,
    };
  }
  const retailNames = { ALFAMART: "Alfamart", INDOMARET: "Indomaret" };
  if (retailNames[channel]) {
    return {
      type: "retail",
      title: "Bayar di " + retailNames[channel],
      store: retailNames[channel],
      payCode,
      amount,
      uniqueCode,
      steps: [
        "Datang ke gerai " + retailNames[channel] + " terdekat",
        `Sampaikan kode pembayaran: <b>${payCode}</b> ke kasir`,
        `Bayar sejumlah <b>${fmt(amount)}</b> (termasuk kode unik ${uniqueCode})`,
        "Simpan struk sebagai bukti",
      ],
      note: `Pembayaran otomatis terverifikasi. Berlaku sampai ${expiredAt}.`,
    };
  }
  return {
    type: "other",
    title: "Instruksi Pembayaran",
    amount,
    steps: [`Lakukan pembayaran sebesar ${fmt(amount)} dengan kode <b>${payCode}</b>.`],
  };
}

// ---------- Helper DB (service role) ----------
function db() {
  return createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function getUserById(client, id) {
  if (!id) return null;
  const { data } = await client.from("users").select("*").eq("id", String(id));
  return data && data.length > 0 ? data[0] : null;
}

async function getMode(client) {
  try {
    const { data } = await client.from("settings").select("key,value").eq("key", "payment_gateway_mode");
    if (data && data.length > 0 && String(data[0].value).toLowerCase() === "live") {
      return tripayConfigured ? "live" : "sandbox";
    }
  } catch (e) { /* abaikan */ }
  return "sandbox";
}

async function getEnabled(client) {
  try {
    const { data } = await client.from("settings").select("key,value").eq("key", "payment_gateway_enabled");
    if (data && data.length > 0) {
      const v = String(data[0].value);
      return v !== "0" && v.toLowerCase() !== "false" && v.toLowerCase() !== "off";
    }
  } catch (e) { /* default aktif */ }
  return true;
}

async function loadOrder(client, orderId) {
  const { data: rows } = await client.from("orders").select("*").eq("id", String(orderId));
  if (rows && rows.length > 0) return rows[0];
  // Fallback ke users.first_order / purchase_history
  const { data: users } = await client.from("users").select("id, first_order, purchase_history");
  for (const u of users || []) {
    if (u.first_order && String(u.first_order.id) === String(orderId)) {
      return { ...u.first_order, user_id: u.id };
    }
    if (u.purchase_history && u.purchase_history.length) {
      const found = u.purchase_history.find((p) => String(p.id) === String(orderId));
      if (found) return { ...found, user_id: u.id, total: found.price || found.amount || 0, items: [{ name: found.productName || "Produk" }] };
    }
  }
  return null;
}

function orderItems(order) {
  const items = Array.isArray(order.items) && order.items.length
    ? order.items
    : [{ name: order.productName || (order.type === "first_order" ? "Paket First Order" : "Produk"), price: order.total, qty: 1 }];
  return items.map((it, i) => ({
    sku: it.product_id ? String(it.product_id) : "SKU-" + (i + 1),
    name: it.name || "Produk",
    price: parseInt(Math.round(Number(it.price) || 0)),
    quantity: parseInt(it.qty || 1),
  }));
}

// ---------- Tripay API ----------
async function tripay(path, options = {}) {
  const res = await fetch(TRIPAY_API_BASE + path, {
    method: options.method || "GET",
    headers: {
      "Authorization": "Bearer " + TRIPAY_API_KEY,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function tripaySignature(merchantRef) {
  // SHA256(merchantCode + privateKey + merchantRef)
  const msg = TRIPAY_MERCHANT_CODE + TRIPAY_PRIVATE_KEY + merchantRef;
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(msg))
    .then((buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join(""));
}

function hmacSha256Hex(key, msg) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    .then((k) => crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg)))
    .then((sig) => Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join(""));
}

async function createTripayPayment(order, channel) {
  const reference = makeReference();
  const signature = await tripaySignature(reference);
  const amount = parseInt(Math.round(Number(order.total) || 0));
  const expiryMinutes = channel.group === "qris" ? 120 : 1440;

  const body = {
    method: channel.code,
    merchant_ref: reference,
    amount,
    customer_name: (order.user_name || "Member").slice(0, 20),
    customer_email: order.customer_email || "member@hedtro.com",
    customer_phone: order.customer_phone || "081234567890",
    order_items: orderItems(order),
    callback_url: `${SUPABASE_URL}/functions/v1/payment-gateway`,
    return_url: order.return_url || "",
    expiry_time: expiryMinutes,
    signature,
  };

  const { ok, data, status } = await tripay("/transaction/create", { method: "POST", body });
  if (!ok) {
    const msg = (data && data.message) || (data && data.error) || ("HTTP " + status);
    throw new Error("Tripay: " + msg);
  }
  const t = data.data || data;
  return {
    reference,
    tripayRef: t.reference,
    payCode: t.pay_code || t.qr_string || "",
    qrString: t.qr_string || null,
    payUrl: t.checkout_url || t.pay_url || null,
    expiredAt: t.expired_time ? new Date(t.expired_time * 1000).toISOString() : null,
  };
}

async function createSandboxPayment(order, channel) {
  const reference = makeReference();
  const uniqueCode = randInt(100, 999);
  const base = Number(order.total) || 0;
  const feeFixed = Number(channel.fee_fixed) || 0;
  const feePct = Number(channel.fee_percent) || 0;
  let amount = base + feeFixed + Math.round((base * feePct) / 100);

  let payCode = "", qrString = null;
  const group = channel.group;

  if (group === "va") {
    const prefix = VA_PREFIX[channel.code] || "880";
    amount = base + feeFixed; // VA: tanpa kode unik, nominal pas
    payCode = prefix + randDigits(11);
  } else if (group === "qris") {
    amount = base + uniqueCode; // QRIS statis: nominal lewat kode unik
    const merchantPan = "93600" + randDigits(11);
    qrString = buildQrisPayload(merchantPan, amount, reference, "HEDTRO", "Jakarta");
    payCode = reference;
  } else if (group === "ewallet") {
    amount = base + feeFixed + Math.round((base * feePct) / 100) + uniqueCode;
    payCode = "08" + randDigits(9);
  } else { // retail
    amount = base + feeFixed + uniqueCode;
    payCode = randDigits(14);
  }

  const expiredAt = new Date(Date.now() + (group === "qris" ? 2 : 24) * 3600 * 1000);
  const expiredAtStr = expiredAt.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const instructions = buildInstructions(channel.code, payCode, amount, uniqueCode, expiredAtStr, { reference });

  return { reference, tripayRef: null, payCode, qrString, instructions, expiredAt: expiredAt.toISOString(), amount, uniqueCode: String(uniqueCode), payUrl: null };
}

// ---------- Finalize: tandai lunas & cairkan bonus ----------
// Idempotent penuh: aman dipanggil berulang (status/polling/webhook/simulasi).
// PENTING urutannya: bonus dicairkan DULU (distribute-bonus juga meng-set order
// jadi 'processing' + verified) — kalau order sudah 'processing' duluan, fungsi
// distribute-bonus menganggap first_order sudah diproses & bonus tidak cair.
async function finalizePayment(client, row, order) {
  const alreadyPaid = row.status === "paid";
  if (!alreadyPaid) {
    await client.from("payment_transactions").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", row.id);
  }

  // Sudah lunas & order sudah diproses → tidak ada yang perlu dilakukan lagi.
  const orderDone = order && ["processing", "completed", "shipped", "paid", "success", "verified"].indexOf(String(order.status || "").toLowerCase()) !== -1;
  if (alreadyPaid && orderDone) {
    return { success: true, alreadyPaid: true };
  }

  // Bonus dibagikan oleh fungsi distribute-bonus (server-side, idempotent).
  // Tanpa PAYMENT_INTERNAL_KEY order TIDAK di-set processing otomatis —
  // diserahkan ke admin agar bonus tidak pernah hilang (sinkronisasi
  // first_order/purchase_history dilakukan distribute-bonus).
  let bonusResult = null;
  let bonusOk = !!PAYMENT_INTERNAL_KEY;
  if (PAYMENT_INTERNAL_KEY) {
    try {
      const bonusUrl = `${SUPABASE_URL}/functions/v1/distribute-bonus`;
      const res = await fetch(bonusUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-key": PAYMENT_INTERNAL_KEY },
        body: JSON.stringify({ orderId: String(row.order_id) }),
      });
      bonusResult = await res.json().catch(() => ({}));
      if (bonusResult && bonusResult.error) bonusOk = false;
    } catch (e) {
      console.warn("distribute-bonus call warning:", e && e.message);
      bonusResult = { error: "bonus function gagal: " + (e && e.message) };
      bonusOk = false;
    }
  }

  // Update order hanya bila bonus berhasil (atau internal key tak diisi tapi order
  // sudah terproses). Kalau bonus gagal, order dibiarkan 'pending' agar admin masih
  // bisa memproses lewat alur lama (tanpa kehilangan bonus).
  if (bonusOk || orderDone) {
    try {
      const patch = { status: "processing", payment_channel: row.channel, payment_reference: row.reference, paid_at: new Date().toISOString() };
      await client.from("orders").update(patch).eq("id", String(order.id || row.order_id));
    } catch (e) { console.warn("update orders warning:", e && e.message); }
  }

  // Update baris transactions (RO/deposit dibuat client dengan id = orderId)
  try {
    await client.from("transactions").update({ status: "success", proof_uploaded: true, paymentMethod: row.channel_name || row.channel, paid_at: new Date().toISOString() }).eq("id", String(row.order_id));
  } catch (e) { /* opsional */ }

  return { success: true, bonusResult, alreadyPaid };
}

// ---------- Main ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const action = (url.searchParams.get("action") || "").toLowerCase();

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE) return json({ error: "Server belum dikonfigurasi (env)" }, 500);
    const client = db();
    const body = await req.json().catch(() => ({}));
    const requestedAction = body.action || action;

    // ---------- Webhook Tripay (tanpa auth user; verifikasi signature) ----------
    if (requestedAction === "webhook") {
      if (!TRIPAY_PRIVATE_KEY) return json({ error: "Tripay private key belum dikonfigurasi" }, 500);
      const p = body;
      const merchantRef = p.merchant_ref || p.merchantRef || "";
      const amount = String(p.amount || "");
      const expected = await hmacSha256Hex(TRIPAY_PRIVATE_KEY, TRIPAY_MERCHANT_CODE + merchantRef + amount);
      const given = String(p.signature || "").toLowerCase();
      if (!given || given !== expected.toLowerCase()) {
        return json({ error: "Signature tidak valid" }, 401);
      }
      const { data: rows } = await client.from("payment_transactions").select("*").eq("reference", merchantRef);
      if (!rows || rows.length === 0) return json({ error: "Pembayaran tidak ditemukan" }, 404);
      const row = rows[0];
      const statusCode = String(p.status_code || "");
      if (statusCode === "1" || p.status === "PAID") {
        const order = await loadOrder(client, row.order_id);
        if (order) await finalizePayment(client, row, order);
      } else if (statusCode === "2") {
        await client.from("payment_transactions").update({ status: "expired" }).eq("id", row.id);
      }
      return json({ success: true });
    }

    // ---------- Auth user ----------
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);
    const anonClient = createClient(SUPABASE_URL, token || "");
    const { data: { user } } = await anonClient.auth.getUser(token);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const caller = await getUserById(client, user.id);
    const isAdmin = !!(caller && caller.role === "admin");

    const mode = await getMode(client);
    const enabled = await getEnabled(client);

    // ---------- config ----------
    if (requestedAction === "config") {
      return json({ mode, enabled, tripayConfigured, sandbox: mode === "sandbox" });
    }

    // ---------- channels ----------
    if (requestedAction === "channels") {
      if (!enabled) return json({ mode, enabled: false, channels: [] });
      if (mode === "live" && TRIPAY_API_KEY) {
        const { ok, data } = await tripay("/merchant/payment-channel");
        if (ok && Array.isArray(data.data)) {
          return json({ mode, channels: data.data.map((c) => ({ code: c.code, name: c.name, group: c.group, fee_fixed: c.fee_fixed, fee_percent: c.fee_percent, icon: c.icon || "fa-credit-card", desc: c.description || "" })) });
        }
        return json({ mode, channels: [], error: (data && data.message) || "Gagal ambil kanal dari Tripay" });
      }
      return json({ mode, channels: SANDBOX_CHANNELS });
    }

    // ---------- create ----------
    if (requestedAction === "create") {
      if (!enabled) return json({ error: "Payment gateway sedang dinonaktifkan oleh admin" }, 403);
      const orderId = body.orderId;
      const channelCode = body.channel;
      if (!orderId || !channelCode) return json({ error: "orderId & channel wajib" }, 400);

      const order = await loadOrder(client, orderId);
      if (!order) return json({ error: "Pesanan tidak ditemukan" }, 404);
      if (!isAdmin && String(order.user_id) !== String(user.id)) return json({ error: "Forbidden" }, 403);

      const alreadyPaid = order.status === "processing" || order.status === "completed" || order.status === "shipped" || order.status === "paid";
      if (alreadyPaid) return json({ error: "Pesanan ini sudah dibayar / diproses" }, 409);

      // Kembalikan pembayaran yang masih aktif bila sudah pernah dibuat
      const { data: existing } = await client.from("payment_transactions").select("*").eq("order_id", String(orderId));
      const active = (existing || []).find((r) => r.status === "pending" || r.status === "paid");
      if (active) {
        return json({ payment: active, existing: true, mode, amount: Number(active.amount) });
      }

      let channel = null;
      if (mode === "live" && TRIPAY_API_KEY) {
        const { ok, data } = await tripay("/merchant/payment-channel");
        if (ok && Array.isArray(data.data)) {
          channel = data.data.find((c) => String(c.code).toUpperCase() === String(channelCode).toUpperCase());
        }
      }
      if (!channel) channel = SANDBOX_CHANNELS.find((c) => String(c.code).toUpperCase() === String(channelCode).toUpperCase());
      if (!channel) return json({ error: "Kanal pembayaran tidak dikenal: " + channelCode }, 400);

      let payment;
      if (mode === "live" && tripayConfigured) {
        payment = await createTripayPayment(order, channel);
        await client.from("payment_transactions").insert({
          reference: payment.reference,
          order_id: String(orderId),
          user_id: String(order.user_id),
          channel: channel.code,
          channel_name: channel.name,
          amount: Number(order.total) || 0,
          status: "pending",
          pay_code: payment.payCode,
          qr_string: payment.qrString,
          instructions: buildInstructions(channel.code, payment.payCode, Number(order.total) || 0, "", "", {}),
          provider: "tripay",
          tripay_ref: payment.tripayRef,
          expired_at: payment.expiredAt ? new Date(payment.expiredAt) : null,
        });
      } else {
        payment = await createSandboxPayment(order, channel);
        await client.from("payment_transactions").insert({
          reference: payment.reference,
          order_id: String(orderId),
          user_id: String(order.user_id),
          channel: channel.code,
          channel_name: channel.name,
          amount: payment.amount,
          status: "pending",
          pay_code: payment.payCode,
          qr_string: payment.qrString,
          instructions: payment.instructions,
          provider: "sandbox",
          tripay_ref: null,
          unique_code: payment.uniqueCode,
          expired_at: new Date(payment.expiredAt),
        });
      }

      return json({ payment, mode, existing: false });
    }

    // ---------- find (pembayaran aktif untuk sebuah order) ----------
    if (requestedAction === "find") {
      const orderId = body.orderId;
      if (!orderId) return json({ error: "orderId wajib" }, 400);
      const order = await loadOrder(client, orderId);
      if (!order) return json({ error: "Pesanan tidak ditemukan" }, 404);
      if (!isAdmin && String(order.user_id) !== String(user.id)) return json({ error: "Forbidden" }, 403);
      const { data: rows } = await client.from("payment_transactions").select("*").eq("order_id", String(orderId)).order("created_at", { ascending: false });
      const active = (rows || []).find((r) => r.status === "pending" || r.status === "paid");
      return json({ payment: active || null });
    }

    // ---------- status ----------
    if (requestedAction === "status") {
      const reference = body.reference;
      if (!reference) return json({ error: "reference wajib" }, 400);
      const { data: rows } = await client.from("payment_transactions").select("*").eq("reference", String(reference));
      if (!rows || rows.length === 0) return json({ error: "Pembayaran tidak ditemukan" }, 404);
      const row = rows[0];
      if (!isAdmin && String(row.user_id) !== String(user.id)) return json({ error: "Forbidden" }, 403);

      let status = row.status;

      // Live: cek ke Tripay
      if (row.provider === "tripay" && mode === "live" && TRIPAY_API_KEY && row.tripay_ref) {
        const { ok, data } = await tripay("/transaction/detail?reference=" + encodeURIComponent(row.tripay_ref));
        if (ok && data.data) {
          const ts = data.data.status;
          if (ts === "PAID") status = "paid";
          else if (ts === "EXPIRED") status = "expired";
          else if (ts === "FAILED") status = "failed";
          if (status !== row.status) {
            await client.from("payment_transactions").update({ status }).eq("id", row.id);
          }
        }
      } else if (row.provider === "sandbox") {
        if (status === "pending" && row.expired_at && new Date(row.expired_at).getTime() < Date.now()) {
          status = "expired";
          await client.from("payment_transactions").update({ status }).eq("id", row.id);
        }
      }

      let order = null;
      if (status === "paid") {
        order = await loadOrder(client, row.order_id);
        const result = await finalizePayment(client, row, order);
        return json({ status: "paid", payment: { ...row, status: "paid" }, order: order ? { id: order.id, type: order.type, total: order.total } : null, finalize: result });
      }
      return json({ status, payment: row, order: order ? { id: order.id, type: order.type, total: order.total } : null });
    }

    // ---------- simulate (sandbox) ----------
    if (requestedAction === "simulate") {
      if (mode !== "sandbox") return json({ error: "Simulasi hanya tersedia di mode sandbox" }, 400);
      const reference = body.reference;
      if (!reference) return json({ error: "reference wajib" }, 400);
      const { data: rows } = await client.from("payment_transactions").select("*").eq("reference", String(reference));
      if (!rows || rows.length === 0) return json({ error: "Pembayaran tidak ditemukan" }, 404);
      const row = rows[0];
      if (!isAdmin && String(row.user_id) !== String(user.id)) return json({ error: "Forbidden" }, 403);
      if (row.status === "paid") return json({ status: "paid", alreadyPaid: true });
      const order = await loadOrder(client, row.order_id);
      const result = await finalizePayment(client, row, order);
      return json({ status: "paid", finalize: result });
    }

    // ---------- list (admin) ----------
    if (requestedAction === "list") {
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
      const { data, error } = await client.from("payment_transactions").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) return json({ error: error.message }, 500);
      return json({ payments: data || [] });
    }

    return json({ error: "Action tidak dikenal: " + requestedAction }, 400);
  } catch (e) {
    console.error("payment-gateway error:", e);
    return json({ error: e && e.message ? e.message : "Internal error" }, 500);
  }
});
