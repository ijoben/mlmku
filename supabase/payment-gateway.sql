-- ============================================================
-- Payment Gateway (gaya Tripay) — tabel & kebijakan akses
--
-- Cara pakai: Buka Supabase Dashboard → SQL Editor →
-- tempel isi file ini → Run. Aman dijalankan ulang (idempotent).
--
-- Tabel `payment_transactions` menyimpan setiap pembayaran yang
-- dibuat lewat Edge Function `payment-gateway`:
--   - mode sandbox : kode VA / QRIS / instruksi dibuat sendiri
--   - mode tripay   : referensi transaksi asli dari API Tripay
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference    text UNIQUE NOT NULL,            -- ref unik milik kita (mis. HDT-XXXX)
  order_id     text NOT NULL,                   -- id order (orders.id / first_order.id)
  user_id      text NOT NULL,                   -- id user pemesan
  channel      text NOT NULL,                   -- kode kanal (BCAVA, QRIS, OVO, ...)
  channel_name text,                            -- nama tampilan kanal
  amount       numeric NOT NULL DEFAULT 0,      -- total yang harus dibayar (sudah termasuk fee/unique)
  status       text NOT NULL DEFAULT 'pending', -- pending | paid | expired | failed
  pay_code     text,                            -- nomor VA / kode bayar / barcode
  qr_string    text,                            -- payload QRIS (EMV) bila kanal QRIS
  instructions jsonb,                           -- langkah-langkah pembayaran per kanal
  provider     text NOT NULL DEFAULT 'sandbox', -- sandbox | tripay
  tripay_ref   text,                            -- nomor transaksi dari Tripay (bila live)
  unique_code  text,                            -- kode unik 3 digit (opsional)
  expired_at   timestamptz,                     -- batas waktu bayar
  paid_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_tx_order ON public.payment_transactions (order_id);
CREATE INDEX IF NOT EXISTS idx_payment_tx_user  ON public.payment_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_payment_tx_status ON public.payment_transactions (status);

-- ============================================================
-- RLS
-- Member hanya bisa MELIHAT pembayaran miliknya & MEMBUAT baris
-- baru (data tidak sensitif; baris dibuat lewat Edge Function
-- dengan service_role). Update/delete hanya admin + service_role.
-- ============================================================
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_tx_select_own" ON public.payment_transactions;
CREATE POLICY "payment_tx_select_own" ON public.payment_transactions
  FOR SELECT USING (auth.uid()::text = user_id OR public.is_admin());

DROP POLICY IF EXISTS "payment_tx_insert_own" ON public.payment_transactions;
CREATE POLICY "payment_tx_insert_own" ON public.payment_transactions
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "payment_tx_update_admin" ON public.payment_transactions;
CREATE POLICY "payment_tx_update_admin" ON public.payment_transactions
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "payment_tx_delete_admin" ON public.payment_transactions;
CREATE POLICY "payment_tx_delete_admin" ON public.payment_transactions
  FOR DELETE USING (public.is_admin());

-- ============================================================
-- Setting default gateway: mode (sandbox | live) & aktif/nonaktif
-- ============================================================
INSERT INTO public.settings (key, value)
SELECT 'payment_gateway_mode', 'sandbox'
WHERE NOT EXISTS (SELECT 1 FROM public.settings WHERE key = 'payment_gateway_mode');

INSERT INTO public.settings (key, value)
SELECT 'payment_gateway_enabled', '1'
WHERE NOT EXISTS (SELECT 1 FROM public.settings WHERE key = 'payment_gateway_enabled');
