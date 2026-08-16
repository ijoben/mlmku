-- ============================================================
-- LANGKAH 3 — Guard Kolom Saldo & Bonus
-- ============================================================
-- Versi ini mengizinkan:
--   - service_role (Edge Function) — jalur utama pembayaran bonus
--   - admin (role='admin') — proses deposit/withdraw/verifikasi di panel admin
-- dan MEMBLOKIR member biasa: member tidak bisa mengubah saldo/bonus
-- miliknya sendiri (mis. lewat console browser) ataupun milik orang lain.
--
-- CATATAN: file ini aman dijalankan ulang (idempotent: DROP TRIGGER IF
-- EXISTS + CREATE OR REPLACE FUNCTION). Jika Anda sudah menjalankan versi
-- lama yang "kaku" (blokir semua non-service_role), jalankan ulang versi
-- ini agar panel admin kembali berfungsi untuk deposit/withdraw/verifikasi.
--
-- File ini TIDAK menghapus data member mana pun.
-- ============================================================

CREATE OR REPLACE FUNCTION public.guard_wallet_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role'
     AND NOT public.is_admin()
     AND (
       NEW.wallet IS DISTINCT FROM OLD.wallet OR
       NEW.bonus_sponsor IS DISTINCT FROM OLD.bonus_sponsor OR
       NEW.bonus_binary IS DISTINCT FROM OLD.bonus_binary OR
       NEW.bonus_pasangan IS DISTINCT FROM OLD.bonus_pasangan OR
       NEW.bonus_reward IS DISTINCT FROM OLD.bonus_reward OR
       NEW.bonus_ro IS DISTINCT FROM OLD.bonus_ro OR
       NEW.left_count IS DISTINCT FROM OLD.left_count OR
       NEW.right_count IS DISTINCT FROM OLD.right_count OR
       NEW.paid_pairs IS DISTINCT FROM OLD.paid_pairs
     )
  THEN
    RAISE EXCEPTION 'Kolom saldo/bonus hanya dapat diubah oleh admin atau server (service_role).';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_wallet_columns ON public.users;
CREATE TRIGGER trg_guard_wallet_columns
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_wallet_columns();
