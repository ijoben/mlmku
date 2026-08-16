-- ============================================================
-- RLS (Row Level Security) — HEDTRO JEANS / mlmku
-- ============================================================
-- PENTING:
-- 1. BACKUP DULU sebelum menjalankan apa pun:
--    Supabase Dashboard -> Database -> Backups (aktifkan PITR) ,
--    atau jalankan `pg_dump` / ekspor CSV tabel users, transactions, orders.
-- 2. File ini TIDAK menghapus / memodifikasi data member mana pun.
--    Hanya membuat fungsi, policy, dan mengaktifkan RLS.
-- 3. Jalankan di Supabase Dashboard -> SQL Editor (bagian "Safe update" mati).
-- 4. Setelah file ini, LANGKAH 2 (wallet-guard.sql) hanya dijalankan
--    SETELAH Edge Function bonus ter-deploy & URL-nya diisi di supabase.js.
-- ============================================================

-- ---------- Helper: cek apakah user adalah admin ----------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- ============================================================
-- USERS
--   SELECT  : semua role boleh baca (pohon binary butuh daftar member)
--   INSERT  : baris sendiri (registrasi) atau admin
--   UPDATE  : baris sendiri (profil) atau admin
--   DELETE  : admin saja
--   CATATAN : celah "user mengubah wallet sendiri" ditutup di
--             LANGKAH 2 (wallet-guard.sql) setelah migrasi Edge Function.
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_all" ON public.users;
CREATE POLICY "users_select_all" ON public.users
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "users_insert_self_or_admin" ON public.users;
CREATE POLICY "users_insert_self_or_admin" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "users_update_self_or_admin" ON public.users;
CREATE POLICY "users_update_self_or_admin" ON public.users
  FOR UPDATE USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "users_delete_admin" ON public.users;
CREATE POLICY "users_delete_admin" ON public.users
  FOR DELETE USING (public.is_admin());

-- ============================================================
-- TRANSACTIONS
--   SELECT : baris sendiri atau admin
--   INSERT : baris sendiri (deposit/withdraw/RO) atau admin (bonus)
--   UPDATE : baris sendiri atau admin
--   DELETE : baris sendiri (pembersihan self-bonus) atau admin
-- ============================================================
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tx_select_own_or_admin" ON public.transactions;
CREATE POLICY "tx_select_own_or_admin" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "tx_insert_own_or_admin" ON public.transactions;
CREATE POLICY "tx_insert_own_or_admin" ON public.transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "tx_update_own_or_admin" ON public.transactions;
CREATE POLICY "tx_update_own_or_admin" ON public.transactions
  FOR UPDATE USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "tx_delete_own_or_admin" ON public.transactions;
CREATE POLICY "tx_delete_own_or_admin" ON public.transactions
  FOR DELETE USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================
-- ORDERS
--   SELECT : baris sendiri atau admin
--   INSERT : baris sendiri (buat order) atau admin
--   UPDATE : baris sendiri (upload bukti) atau admin
--   DELETE : admin saja
-- ============================================================
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_select_own_or_admin" ON public.orders;
CREATE POLICY "orders_select_own_or_admin" ON public.orders
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "orders_insert_own_or_admin" ON public.orders;
CREATE POLICY "orders_insert_own_or_admin" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "orders_update_own_or_admin" ON public.orders;
CREATE POLICY "orders_update_own_or_admin" ON public.orders
  FOR UPDATE USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "orders_delete_admin" ON public.orders;
CREATE POLICY "orders_delete_admin" ON public.orders
  FOR DELETE USING (public.is_admin());

-- ============================================================
-- SETTINGS (kunci sistem)
--   SELECT : semua boleh baca
--   TULIS  : admin saja
-- ============================================================
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_select_all" ON public.settings;
CREATE POLICY "settings_select_all" ON public.settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "settings_insert_admin" ON public.settings;
CREATE POLICY "settings_insert_admin" ON public.settings
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "settings_update_admin" ON public.settings;
CREATE POLICY "settings_update_admin" ON public.settings
  FOR UPDATE USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "settings_delete_admin" ON public.settings;
CREATE POLICY "settings_delete_admin" ON public.settings
  FOR DELETE USING (public.is_admin());

-- ============================================================
-- KONTEN PUBLIK (baca semua, tulis admin)
-- products, slides, faq, features, about, footer, bank_info
-- ============================================================
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['products','slides','faq','features','about','footer','bank_info']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'content_select_all_' || tbl, tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (true);',
                   'content_select_all_' || tbl, tbl);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'content_insert_admin_' || tbl, tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (public.is_admin());',
                   'content_insert_admin_' || tbl, tbl);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'content_update_admin_' || tbl, tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());',
                   'content_update_admin_' || tbl, tbl);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'content_delete_admin_' || tbl, tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE USING (public.is_admin());',
                   'content_delete_admin_' || tbl, tbl);
  END LOOP;
END $$;

-- ============================================================
-- SELESAI — LANGKAH 2: supabase/wallet-guard.sql
-- (hanya setelah Edge Function bonus aktif)
-- ============================================================
