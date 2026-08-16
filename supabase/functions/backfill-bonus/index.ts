// @ts-nocheck
// ============================================================
// Edge Function: backfill-bonus
// Audit & backfill Bonus Sponsor (Rp 50.000) + Bonus Pasangan (Rp 25.000/pasang)
// untuk member verified yang ada sebelum perbaikan sistem.
// - dryRun=true  : hanya menghitung & melaporkan (read-only)
// - dryRun=false : menulis bonus + transaksi + counter kaki
// Hanya boleh dipanggil oleh user ber-role admin.
// Tidak menghapus/memodifikasi data member selain bonus & counter kaki.
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isSelf(a, b) { return !!(a && b && String(a).toLowerCase() === String(b).toLowerCase()); }
function getSponsorBonusAmount(s) { const v = parseFloat(s && s.sponsorBonusAmount); return isNaN(v) || v <= 0 ? 50000 : v; }
function getPairingBonusAmount(s) { const v = parseFloat(s && s.pairingBonus); return isNaN(v) || v <= 0 ? 25000 : v; }

function computeAudit(users, txs, sponsorAmt, pairAmt) {
  const uMap = new Map();
  users.forEach((u) => uMap.set(String(u.id), u));

  function orderDate(u) {
    const fo = u.first_order;
    return new Date((fo && (fo.created_at || fo.date)) || u.created_at || u.registered_at || 0).getTime();
  }

  const verified = users.filter((u) => u.status === "verified" && u.role !== "admin");
  const sorted = verified.slice().sort((a, b) => orderDate(a) - orderDate(b));

  const paidSponsor = new Map();
  const paidPair = new Map();
  txs.forEach((t) => {
    const amt = parseFloat(t.amount) || 0;
    if ((t.type === "bonus_sponsor" || t.type === "sponsor") && t.user_id && t.from_user_id) {
      const k = String(t.user_id) + "|" + String(t.from_user_id);
      paidSponsor.set(k, (paidSponsor.get(k) || 0) + amt);
    } else if (t.type === "bonus_pasangan") {
      paidPair.set(String(t.user_id), (paidPair.get(String(t.user_id)) || 0) + amt);
    }
  });

  users.forEach((u) => { u._left = 0; u._right = 0; });

  let missingPosBuyers = 0;
  let missingPosAncestors = 0;
  let noParent = 0;
  let selfSponsor = 0;

  const pairCounter = new Map();
  users.forEach((u) => pairCounter.set(String(u.id), Math.floor((paidPair.get(String(u.id)) || 0) / pairAmt)));

  const pairEvents = [];
  const pairFinal = new Map();

  sorted.forEach((buyer) => {
    let cur = buyer.upline_id || buyer.sponsor_id;
    if (!cur) { noParent++; return; }
    let side = buyer.position;
    if (side !== "left" && side !== "right") { side = "left"; missingPosBuyers++; }
    let hops = 0;
    const seen = new Set([String(buyer.id)]);
    while (cur && hops < 50) {
      const up = uMap.get(String(cur));
      if (!up || seen.has(String(cur))) break;
      seen.add(String(cur));
      if (side === "right") up._right++; else up._left++;
      const pairs = Math.min(up._left, up._right);
      const accounted = pairCounter.get(String(up.id)) || 0;
      if (pairs > accounted) {
        pairCounter.set(String(up.id), pairs);
        pairEvents.push({ up, buyer, pairs: pairs - accounted, totalPairs: pairs });
      }
      side = up.position;
      if (side !== "left" && side !== "right") {
        side = "left";
        if (up.upline_id || up.sponsor_id) missingPosAncestors++;
      }
      cur = up.upline_id || up.sponsor_id;
      hops++;
    }
  });
  users.forEach((u) => pairFinal.set(String(u.id), Math.min(u._left || 0, u._right || 0)));

  const sponsorRows = [];
  let totalSponsorDelta = 0;
  verified.forEach((buyer) => {
    if (!buyer.sponsor_id || isSelf(buyer.id, buyer.sponsor_id)) { selfSponsor++; return; }
    const sponsor = uMap.get(String(buyer.sponsor_id));
    if (!sponsor) return;
    const key = String(sponsor.id) + "|" + String(buyer.id);
    const paid = paidSponsor.get(key) || 0;
    const delta = Math.max(0, sponsorAmt - paid);
    if (delta > 0) {
      totalSponsorDelta += delta;
      sponsorRows.push({ sponsorId: sponsor.id, sponsorUser: sponsor.username, buyerId: buyer.id, buyerUser: buyer.username, expected: sponsorAmt, paid, delta });
    }
  });

  const pairByUser = new Map();
  pairEvents.forEach((ev) => {
    const uid = String(ev.up.id);
    if (!pairByUser.has(uid)) pairByUser.set(uid, { up: ev.up, pairs: 0 });
    pairByUser.get(uid).pairs += ev.pairs;
  });
  const pairRows = [];
  let totalPairDelta = 0;
  pairByUser.forEach((row) => {
    const finalPairs = pairFinal.get(String(row.up.id)) || 0;
    const expected = finalPairs * pairAmt;
    const paid = paidPair.get(String(row.up.id)) || 0;
    const delta = Math.max(0, expected - paid);
    if (delta > 0) {
      totalPairDelta += delta;
      pairRows.push({ upId: row.up.id, upUser: row.up.username, left: row.up._left || 0, right: row.up._right || 0, finalPairs, expected, paid, delta });
    }
  });

  return {
    sponsorAmt, pairAmt,
    verifiedCount: verified.length,
    pendingCount: users.filter((u) => u.status !== "verified").length,
    missingPosBuyers, missingPosAncestors, noParent, selfSponsor,
    sponsorRows, pairRows, pairEvents,
    totalSponsorDelta, totalPairDelta,
    totalDelta: totalSponsorDelta + totalPairDelta,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE) return json({ error: "Server belum dikonfigurasi (env)" }, 500);

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const anonClient = createClient(SUPABASE_URL, token);
    const { data: { user } } = await anonClient.auth.getUser(token);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const db = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Hanya admin
    const caller = await db.from("users").select("*").eq("id", user.id).maybeSingle();
    if (!caller.data || caller.data.role !== "admin") {
      return json({ error: "Forbidden: hanya admin" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun !== false;

    const { data: users } = await db.from("users").select("*");
    const { data: txs } = await db.from("transactions").select("*");
    const settings = await getSettings(db);

    const a = computeAudit(users || [], txs || [], getSponsorBonusAmount(settings), getPairingBonusAmount(settings));

    // Cek penanda backfill yang sudah selesai
    const { data: runRows } = await db.from("settings").select("value").eq("key", "backfillBonusRun").maybeSingle();
    const alreadyRun = !!(runRows && runRows.value);

    if (dryRun || a.totalDelta <= 0) {
      return json({ dryRun: true, alreadyRun, ...a, message: "Audit selesai — tidak ada data yang ditulis." });
    }

    // ===== APPLY =====
    const upd = new Map();
    const getUpd = (u) => {
      if (!upd.has(String(u.id))) upd.set(String(u.id), { ...u });
      return upd.get(String(u.id));
    };

    const txList = [];
    const makeTx = (userId, fromId, fromUsername, type, amount, level, desc) => {
      const id = crypto.randomUUID ? crypto.randomUUID() : ("tx_" + Date.now() + "_" + Math.floor(Math.random() * 1000));
      txList.push({ id, user_id: userId, from_user_id: fromId, from_username: fromUsername, from_name: fromUsername, type, amount, level, desc, description: desc, status: "success", date: new Date().toISOString(), created_at: new Date().toISOString() });
    };

    a.sponsorRows.forEach((r) => {
      const s = getUpd(users.find((u) => String(u.id) === String(r.sponsorId)));
      s.bonus_sponsor = (parseFloat(s.bonus_sponsor) || 0) + r.delta;
      s.wallet = (parseFloat(s.wallet) || 0) + r.delta;
      makeTx(s.id, r.buyerId, r.buyerUser, "bonus_sponsor", r.delta, 1,
        "🎁 Bonus Sponsor Rp " + a.sponsorAmt.toLocaleString("id-ID") + " (backfill) dari pendaftaran @" + r.buyerUser);
    });

    const pairCounter = new Map();
    (users || []).forEach((u) => {
      let paid = 0;
      (txs || []).forEach((t) => {
        if (t.type === "bonus_pasangan" && String(t.user_id) === String(u.id)) paid += parseFloat(t.amount) || 0;
      });
      pairCounter.set(String(u.id), Math.floor(paid / a.pairAmt));
    });

    a.pairEvents.forEach((ev) => {
      const u = getUpd(users.find((x) => String(x.id) === String(ev.up.id)));
      const accounted = pairCounter.get(String(u.id)) || 0;
      if (ev.totalPairs <= accounted) return;
      const np = ev.totalPairs - accounted;
      pairCounter.set(String(u.id), ev.totalPairs);
      const amt = np * a.pairAmt;
      u.bonus_pasangan = (parseFloat(u.bonus_pasangan) || 0) + amt;
      u.wallet = (parseFloat(u.wallet) || 0) + amt;
      makeTx(u.id, ev.buyer.id, ev.buyer.username, "bonus_pasangan", amt, ev.totalPairs,
        "👥 Bonus Pasangan " + np + " pasang (Rp " + a.pairAmt.toLocaleString("id-ID") + "/pasang, backfill) dari aktivasi @" + ev.buyer.username);
    });

    (users || []).forEach((u) => {
      const uu = getUpd(u);
      uu.left_count = u._left || 0;
      uu.right_count = u._right || 0;
      uu.paid_pairs = Math.min(u._left || 0, u._right || 0);
    });

    for (const entry of upd.values()) {
      const payload = { ...entry };
      for (let attempt = 0; attempt < 8; attempt++) {
        const { error } = await db.from("users").upsert(payload);
        if (!error) break;
        const m = error.message && error.message.match(/Could not find the '([^']+)' column/);
        if (m && m[1]) { delete payload[m[1]]; continue; }
        throw error;
      }
    }
    for (const t of txList) {
      try { await db.from("transactions").insert(t); } catch (e) { console.warn("tx insert warning:", e && e.message); }
    }
    const runRec = { runAt: new Date().toISOString(), sponsorAmount: a.sponsorAmt, pairingAmount: a.pairAmt, sponsorTx: a.sponsorRows.length, pairingTx: a.pairEvents.length, totalPaid: a.totalDelta };
    await db.from("settings").upsert({ key: "backfillBonusRun", value: JSON.stringify(runRec) });

    return json({ dryRun: false, ...a, written: txList.length, message: "Backfill selesai." });
  } catch (e) {
    console.error("backfill-bonus error:", e);
    return json({ error: e && e.message ? e.message : "Internal error" }, 500);
  }
});

async function getSettings(db) {
  const { data } = await db.from("settings").select("key,value");
  const s = {};
  (data || []).forEach((r) => { s[r.key] = r.value; });
  return s;
}
