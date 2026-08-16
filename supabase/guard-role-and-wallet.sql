-- ============================================================
-- LANGKAH 4 — Pengaman tambahan: kolom role & saldo saat INSERT
-- ============================================================
-- Tujuan: menutup celah keamanan dari RLS yang berbasis BARIS (bukan kolom).
-- Dengan RLS lama, seorang member bisa mengubah kolom role miliknya sendiri
-- menjadi 'admin' lewat API (PATCH /users?id=<id sendiri> {"role":"admin"}).
-- Setelah itu public.is_admin() bernilai true sehingga SEMUA gerbang admin
-- (panel admin, tool backfill, dsb.) bisa di-bypass.
--
-- Script ini menambahkan trigger yang memastikan:
--   1. Hanya admin / service_role yang boleh membuat/ubah role 'admin'.
--   2. Akun baru (non-admin) tidak boleh dibuat dengan saldo/bonus awal bukan nol.
--
-- Keamanan: idempotent (DROP TRIGGER IF EXISTS + CREATE OR REPLACE FUNCTION),
-- TIDAK menghapus/mengubah data member. Jalankan di SQL Editor, berurutan
-- setelah rls-policies.sql & wallet-guard.sql.
-- ============================================================

CREATE OR REPLACE FUNCTION public.guard_role_and_wallet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role (server) dan admin (yang sudah berstatus admin) dipercaya
  IF auth.role() = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Akun baru non-admin tidak boleh berperan admin
    IF NEW.role = 'admin' THEN
      RAISE EXCEPTION 'Tidak diizinkan membuat akun dengan peran admin.';
    END IF;
    -- dan tidak boleh mulai dengan saldo/bonus bukan nol
    IF COALESCE(NEW.wallet, 0) <> 0
       OR COALESCE(NEW.bonus_sponsor, 0) <> 0
       OR COALESCE(NEW.bonus_binary, 0) <> 0
       OR COALESCE(NEW.bonus_pasangan, 0) <> 0
       OR COALESCE(NEW.bonus_reward, 0) <> 0
       OR COALESCE(NEW.bonus_ro, 0) <> 0 THEN
      RAISE EXCEPTION 'Saldo/bonus awal harus 0.';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Hanya admin yang boleh mengubah peran (role).';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_role_and_wallet ON public.users;
CREATE TRIGGER trg_guard_role_and_wallet
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_role_and_wallet();
