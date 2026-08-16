// @ts-nocheck
// ============================================================
// Edge Function: distribute-bonus
// Approve order & distribusikan semua bonus (server-side, service_role)
// Dipanggil dari admin (approve/verifikasi) dan member (RO lunas).
//
// Deploy:
//   supabase functions deploy distribute-bonus
// Lalu isi window.HEDTRO_BONUS_FUNCTION_URL di supabase.js:
//   https://<project-ref>.supabase.co/functions/v1/distribute-bonus
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const PAYMENT_INTERNAL_KEY = Deno.env.get("PAYMENT_INTERNAL_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------- Helpers ----------
function isSameUser(a, b) {
  if (!a || !b) return false;
  const idA = typeof a === "object" ? (a.id || a.username) : a;
  const unA = typeof a === "object" ? (a.username || a.id) : a;
  const idB = typeof b === "object" ? (b.id || b.username) : b;
  const unB = typeof b === "object" ? (b.username || b.id) : b;
  const sA = String(idA || "").toLowerCase().trim();
  const sB = String(idB || "").toLowerCase().trim();
  if (!sA || !sB) return false;
  return sA === sB || sA === String(unB || "").toLowerCase().trim() ||
    String(unA || "").toLowerCase().trim() === sB ||
    String(unA || "").toLowerCase().trim() === String(unB || "").toLowerCase().trim();
}

function getSponsorBonusAmount(settings) {
  const v = parseFloat(settings && settings.sponsorBonusAmount);
  return isNaN(v) || v <= 0 ? 50000 : v;
}

function getPairingBonusAmount(settings) {
  const v = parseFloat(settings && settings.pairingBonus);
  return isNaN(v) || v <= 0 ? 25000 : v;
}

// ---------- DB helpers (service role) ----------
async function getUserById(db, id) {
  if (!id) return null;
  const { data } = await db.from("users").select("*").eq("id", id).maybeSingle();
  if (data) return data;
  const { data: byName } = await db.from("users").select("*").or(`username.eq.${id}`).maybeSingle();
  return byName || null;
}

async function getSettings(db) {
  const { data } = await db.from("settings").select("key,value");
  const s = {};
  (data || []).forEach((r) => { s[r.key] = r.value; });
  return s;
}

async function isBonusAlreadyGiven(db, userId, fromUserId, type, level) {
  const { data } = await db
    .from("transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("from_user_id", fromUserId)
    .eq("type", type)
    .eq("level", level);
  return !!(data && data.length > 0);
}

async function upsertUser(db, user) {
  const payload = { ...user };
  for (let attempt = 0; attempt < 8; attempt++) {
    const { error } = await db.from("users").upsert(payload);
    if (!error) return;
    const m = error.message && error.message.match(/Could not find the '([^']+)' column/);
    if (m && m[1]) { delete payload[m[1]]; continue; }
    throw error;
  }
}

async function insertTx(db, tx) {
  try {
    await db.from("transactions").insert(tx);
  } catch (e) {
    console.warn("insertTx warning:", e && e.message);
  }
}

function makeTx(userId, fromUser, type, amount, level, desc) {
  const id = crypto.randomUUID ? crypto.randomUUID() : ("tx_" + Date.now() + "_" + Math.floor(Math.random() * 1000));
  return {
    id,
    user_id: userId,
    from_user_id: fromUser ? fromUser.id : null,
    from_username: fromUser ? fromUser.username : null,
    from_name: fromUser ? (fromUser.fullname || fromUser.username) : null,
    type,
    amount,
    level,
    desc,
    description: desc,
    status: "success",
    date: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
}

// ---------- Bonus: Sponsor (nominal) ----------
async function calculateSponsorBonus(db, userId, sponsorId, settings) {
  const amount = getSponsorBonusAmount(settings);
  if (amount <= 0 || !sponsorId) return;
  const buyer = await getUserById(db, userId);
  const sponsor = await getUserById(db, sponsorId);
  if (!buyer || !sponsor || isSameUser(buyer, sponsor)) return;
  if (await isBonusAlreadyGiven(db, sponsor.id, buyer.id, "bonus_sponsor", 1)) return;

  sponsor.bonus_sponsor = (parseFloat(sponsor.bonus_sponsor) || 0) + amount;
  sponsor.wallet = (parseFloat(sponsor.wallet) || 0) + amount;
  const buyerName = buyer.fullname || buyer.username;
  const desc = "🎁 Bonus Sponsor Rp " + amount.toLocaleString("id-ID") + " dari pendaftaran " + buyerName + " (@" + buyer.username + ")";
  await upsertUser(db, sponsor);
  await insertTx(db, makeTx(sponsor.id, buyer, "bonus_sponsor", amount, 1, desc));
}

// ---------- Bonus: Binary 10 level ----------
async function calculateBinaryBonus(db, userId, amount, settings) {
  const levels = settings.binaryBonusLevels || [10, 8, 6, 5, 4, 3, 2, 1.5, 1, 0.5];
  const buyer = await getUserById(db, userId);
  if (!buyer) return;
  const buyerName = buyer.fullname || buyer.username;
  let currentUserId = buyer.upline_id || buyer.sponsor_id;
  let level = 0;
  const visited = new Set([String(buyer.id).toLowerCase(), String(buyer.username).toLowerCase()]);
  while (currentUserId && level < 10) {
    if (visited.has(String(currentUserId).toLowerCase())) break;
    const upline = await getUserById(db, currentUserId);
    if (!upline || isSameUser(upline, buyer)) break;
    visited.add(String(upline.id).toLowerCase());
    if (upline.username) visited.add(String(upline.username).toLowerCase());
    const pct = parseFloat(levels[level]) || 0;
    const bonus = (amount * pct) / 100;
    if (bonus > 0 && !(await isBonusAlreadyGiven(db, upline.id, buyer.id, "bonus_binary", level + 1))) {
      upline.bonus_binary = (parseFloat(upline.bonus_binary) || 0) + bonus;
      upline.wallet = (parseFloat(upline.wallet) || 0) + bonus;
      const desc = "🌳 Bonus Binary Level " + (level + 1) + " (" + pct + "%) dari " + buyerName + " (@" + buyer.username + ")";
      await upsertUser(db, upline);
      await insertTx(db, makeTx(upline.id, buyer, "bonus_binary", bonus, level + 1, desc));
    }
    currentUserId = upline.upline_id || upline.sponsor_id;
    level++;
  }
}

// ---------- Bonus: Pasangan (pairing) ----------
async function calculatePairingBonus(db, userId, settings) {
  const perPair = getPairingBonusAmount(settings);
  const buyer = await getUserById(db, userId);
  if (!buyer) return;
  const buyerName = buyer.fullname || buyer.username;
  let currentUserId = buyer.upline_id || buyer.sponsor_id;
  let side = buyer.position;
  let level = 0;
  const visited = new Set([String(buyer.id).toLowerCase(), String(buyer.username).toLowerCase()]);
  while (currentUserId && level < 50) {
    if (visited.has(String(currentUserId).toLowerCase())) break;
    const upline = await getUserById(db, currentUserId);
    if (!upline || isSameUser(upline, buyer)) break;
    visited.add(String(upline.id).toLowerCase());
    if (upline.username) visited.add(String(upline.username).toLowerCase());

    if (side === "left") upline.left_count = (parseFloat(upline.left_count) || 0) + 1;
    else if (side === "right") upline.right_count = (parseFloat(upline.right_count) || 0) + 1;

    const totalPairs = Math.min(parseFloat(upline.left_count) || 0, parseFloat(upline.right_count) || 0);
    const paid = parseFloat(upline.paid_pairs) || 0;
    const newPairs = totalPairs - paid;

    if (newPairs > 0 && !(await isBonusAlreadyGiven(db, upline.id, buyer.id, "bonus_pasangan", 1))) {
      const bonus = newPairs * perPair;
      upline.bonus_pasangan = (parseFloat(upline.bonus_pasangan) || 0) + bonus;
      upline.wallet = (parseFloat(upline.wallet) || 0) + bonus;
      upline.paid_pairs = totalPairs;
      const desc = "👥 Bonus Pasangan " + newPairs + " pasang (Rp " + perPair.toLocaleString("id-ID") + "/pasang) dari aktivasi " + buyerName + " (@" + buyer.username + ")";
      await upsertUser(db, upline);
      await insertTx(db, makeTx(upline.id, buyer, "bonus_pasangan", bonus, totalPairs, desc));
    } else if (parseFloat(upline.paid_pairs || 0) !== totalPairs) {
      upline.paid_pairs = totalPairs;
      await upsertUser(db, upline);
    }

    side = upline.position;
    currentUserId = upline.upline_id || upline.sponsor_id;
    level++;
  }
}

// ---------- Bonus: Reward 5 level ----------
async function calculateRewardBonus(db, userId, amount, settings) {
  const levels = settings.rewardBonusLevels || [5, 4, 3, 2, 1];
  const buyer = await getUserById(db, userId);
  if (!buyer) return;
  const buyerName = buyer.fullname || buyer.username;
  let currentUserId = buyer.upline_id || buyer.sponsor_id;
  let level = 0;
  const visited = new Set([String(buyer.id).toLowerCase(), String(buyer.username).toLowerCase()]);
  while (currentUserId && level < 5) {
    if (visited.has(String(currentUserId).toLowerCase())) break;
    const upline = await getUserById(db, currentUserId);
    if (!upline || isSameUser(upline, buyer)) break;
    visited.add(String(upline.id).toLowerCase());
    if (upline.username) visited.add(String(upline.username).toLowerCase());
    const pct = parseFloat(levels[level]) || 0;
    const bonus = (amount * pct) / 100;
    if (bonus > 0 && !(await isBonusAlreadyGiven(db, upline.id, buyer.id, "bonus_reward", level + 1))) {
      upline.bonus_reward = (parseFloat(upline.bonus_reward) || 0) + bonus;
      upline.wallet = (parseFloat(upline.wallet) || 0) + bonus;
      const desc = "🏆 Bonus Reward Level " + (level + 1) + " (" + pct + "%) dari " + buyerName + " (@" + buyer.username + ")";
      await upsertUser(db, upline);
      await insertTx(db, makeTx(upline.id, buyer, "bonus_reward", bonus, level + 1, desc));
    }
    currentUserId = upline.upline_id || upline.sponsor_id;
    level++;
  }
}

// ---------- Bonus: RO ----------
async function calculateRoBonus(db, userId, amount, settings) {
  const pct = parseFloat(settings.roBonus) || 3;
  const bonus = (amount * pct) / 100;
  if (bonus <= 0) return;
  const buyer = await getUserById(db, userId);
  if (!buyer || !buyer.sponsor_id || isSameUser(buyer.id, buyer.sponsor_id)) return;
  const sponsor = await getUserById(db, buyer.sponsor_id);
  if (!sponsor || isSameUser(sponsor, buyer)) return;
  if (await isBonusAlreadyGiven(db, sponsor.id, buyer.id, "ro_bonus", 1)) return;
  sponsor.bonus_ro = (parseFloat(sponsor.bonus_ro) || 0) + bonus;
  sponsor.wallet = (parseFloat(sponsor.wallet) || 0) + bonus;
  const desc = "🔄 Bonus RO (" + pct + "%) dari pembelian RO oleh " + (buyer.fullname || buyer.username) + " (@" + buyer.username + ")";
  await upsertUser(db, sponsor);
  await insertTx(db, makeTx(sponsor.id, buyer, "ro_bonus", bonus, 1, desc));
}

// ---------- Main ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE) return json({ error: "Server belum dikonfigurasi (env)" }, 500);

    // Jalur internal: dipanggil oleh fungsi payment-gateway setelah pembayaran
    // lunas (memakai header x-internal-key yang cocok dengan env).
    const internalKey = req.headers.get("x-internal-key") || "";
    const internalAuthorized = !!(internalKey && PAYMENT_INTERNAL_KEY && internalKey === PAYMENT_INTERNAL_KEY);

    // Cek caller via JWT
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    let user = null;
    if (!internalAuthorized) {
      if (!token) return json({ error: "Unauthorized" }, 401);
      const anonClient = createClient(SUPABASE_URL, SUPABASE_URL && SERVICE_ROLE ? token : "");
      const { data: { user: u } } = await anonClient.auth.getUser(token);
      if (!u) return json({ error: "Unauthorized" }, 401);
      user = u;
    }

    const db = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const orderId = body.orderId;
    if (!orderId) return json({ error: "orderId wajib" }, 400);

    // Ambil order
    let order = null;
    const { data: orderRows } = await db.from("orders").select("*").eq("id", String(orderId));
    if (orderRows && orderRows.length > 0) order = orderRows[0];

    // Fallback: cari di users.first_order
    if (!order) {
      const { data: users } = await db.from("users").select("id, first_order, purchase_history");
      for (const u of users || []) {
        if (u.first_order && String(u.first_order.id) === String(orderId)) {
          order = { ...u.first_order, user_id: u.id };
          break;
        }
      }
    }
    if (!order) return json({ error: "Pesanan tidak ditemukan" }, 404);

    // Otorisasi: admin boleh approve apa pun; user hanya untuk order miliknya (RO lunas);
    // panggilan internal (payment gateway) dianggap terpercaya.
    const caller = internalAuthorized ? null : await getUserById(db, user.id);
    const isAdmin = !!(caller && caller.role === "admin");
    if (!internalAuthorized && !isAdmin && !isSameUser(user.id, order.user_id)) {
      return json({ error: "Forbidden" }, 403);
    }

    // first_order 'processing' = bonus sudah dibayar; RO 'processing' (lunas dari saldo)
    // masih perlu bonus dibagikan (guard isBonusAlreadyGiven mencegah double-pay).
    const alreadyDone = order.status === "completed" || order.status === "shipped" ||
      (order.status === "processing" && String(order.type || "") !== "ro");
    if (alreadyDone) {
      return json({ alreadyProcessed: true, orderId: String(orderId) });
    }

    const buyer = await getUserById(db, order.user_id);
    if (!buyer) return json({ error: "Buyer tidak ditemukan" }, 404);

    const settings = await getSettings(db);
    const orderAmount = parseFloat(order.total) || 0;

    const isFirst = String(order.type || "") === "first_order";
    const isRo = String(order.type || "") === "ro";

    if (isFirst) buyer.status = "verified";

    if (orderAmount > 0) {
      if (isFirst) {
        if (buyer.sponsor_id) await calculateSponsorBonus(db, buyer.id, buyer.sponsor_id, settings);
        await calculateBinaryBonus(db, buyer.id, orderAmount, settings);
        await calculatePairingBonus(db, buyer.id, settings);
        await calculateRewardBonus(db, buyer.id, orderAmount, settings);
      } else if (isRo) {
        await calculateBinaryBonus(db, buyer.id, orderAmount, settings);
        await calculateRewardBonus(db, buyer.id, orderAmount, settings);
        await calculateRoBonus(db, buyer.id, orderAmount, settings);
      }
    }

    // Sinkronkan status order di JSONB users (first_order / purchase_history /
    // transactions) agar tampilan dashboard member selalu akurat — termasuk
    // pesanan yang dilunasi otomatis lewat payment gateway.
    const syncOrderId = String(order.id || orderId);
    if (buyer.first_order && String(buyer.first_order.id) === syncOrderId) {
      buyer.first_order.status = "processing";
    }
    if (Array.isArray(buyer.purchase_history)) {
      buyer.purchase_history.forEach((p) => {
        if (p && String(p.id) === syncOrderId) p.status = "processing";
      });
    }
    if (Array.isArray(buyer.transactions)) {
      buyer.transactions.forEach((t) => {
        if (t && String(t.id) === syncOrderId) {
          t.status = "success";
          t.proof_uploaded = true;
        }
      });
    }

    await upsertUser(db, buyer);
    try {
      await db.from("orders").update({ status: "processing" }).eq("id", String(orderId));
    } catch (e) { console.warn("update order status warning:", e && e.message); }

    return json({ success: true, orderId: String(orderId), type: order.type || "order" });
  } catch (e) {
    console.error("distribute-bonus error:", e);
    return json({ error: e && e.message ? e.message : "Internal error" }, 500);
  }
});
