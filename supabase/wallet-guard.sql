-- ============================================================
-- LANGKAH 2 — Guard Kolom Saldo & Bonus (wajib SETELAH Edge Function)
-- ============================================================
-- JANGAN jalankan file ini sebelum:
--   1. Edge Function `distribute-bonus` & `backfill-bonus` ter-deploy,
--   2. `window.HEDTRO_BONUS_FUNCTION_URL` diisi di supabase.js, dan
--   3. Semua alur admin (approve order, verifikasi, backfill) sudah
--      memakai fungsi server-side.
--
-- Setelah trigger aktif, kolom saldo/bonus HANYA bisa diubah oleh
-- service_role (dari Edge Function). Update profil lain tetap bisa
-- dilakukan user/admin di kolom non-sensitive.
-- File ini TIDAK menghapus data member mana pun.
-- ============================================================

CREATE OR REPLACE FUNCTION public.guard_wallet_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND (
    NEW.wallet IS DISTINCT FROM OLD.wallet OR
    NEW.bonus_sponsor IS DISTINCT FROM OLD.bonus_sponsor OR
    NEW.bonus_binary IS DISTINCT FROM OLD.bonus_binary OR
    NEW.bonus_pasangan IS DISTINCT FROM OLD.bonus_pasangan OR
    NEW.bonus_reward IS DISTINCT FROM OLD.bonus_reward OR
    NEW.bonus_ro IS DISTINCT FROM OLD.bonus_ro OR
    NEW.left_count IS DISTINCT FROM OLD.left_count OR
    NEW.right_count IS DISTINCT FROM OLD.right_count OR
    NEW.paid_pairs IS DISTINCT FROM OLD.paid_pairs
  ) THEN
    RAISE EXCEPTION 'Kolom saldo/bonus hanya dapat diubah server-side (service_role).';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_wallet_columns ON public.users;
CREATE TRIGGER trg_guard_wallet_columns
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_wallet_columns();
