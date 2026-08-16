-- ============================================================
-- PERBAIKAN DATA BINARY TREE (left_id / right_id)
-- ============================================================
-- Kolom left_id / right_id di tabel users berisi nilai lama yang rusak
-- (referensi ke diri sendiri atau ke sponsor, bukan ke anak sebenarnya).
-- Script ini menulis ulang keduanya dari relasi yang benar:
--   sponsor_id + position  (sumber kebenaran yang dipakai mesin bonus,
--   tool backfill, menu Downline, dan pohon jaringan).
--
-- AMAN: hanya UPDATE 2 kolom (left_id, right_id).
-- TIDAK ada DELETE / TRUNCATE — tidak ada member yang dihapus.
--
-- Cara pakai di Supabase SQL Editor:
--   1. Jalankan bagian "1. PREVIEW" dulu (read-only) dan periksa hasilnya.
--   2. Jalankan bagian "2. TERAPKAN" (2 statement UPDATE).
--   3. Jalankan bagian "3. VERIFIKASI" untuk memastikan hasilnya.
-- ============================================================


-- ============================================================
-- 1. PREVIEW (READ-ONLY) — apa yang AKAN diterapkan
--    Kolom "lama" = nilai saat ini, kolom "baru" = nilai hasil perbaikan.
-- ============================================================
SELECT
  p.username AS induk,
  (SELECT c.username FROM public.users c
     WHERE c.sponsor_id = p.id AND c.id <> p.id
       AND LOWER(TRIM(c.position)) IN ('left','l','kiri','1')
     ORDER BY c.registered_at ASC, c.id ASC
     LIMIT 1) AS kiri_baru,
  (SELECT c.username FROM public.users c
     WHERE c.sponsor_id = p.id AND c.id <> p.id
       AND LOWER(TRIM(c.position)) IN ('right','r','kanan','2')
     ORDER BY c.registered_at ASC, c.id ASC
     LIMIT 1) AS kanan_baru,
  (SELECT c.username FROM public.users c WHERE c.id = p.left_id)  AS kiri_lama,
  (SELECT c.username FROM public.users c WHERE c.id = p.right_id) AS kanan_lama
FROM public.users p
WHERE p.left_id IS NOT NULL
   OR p.right_id IS NOT NULL
   OR EXISTS (
        SELECT 1 FROM public.users c
        WHERE c.sponsor_id = p.id AND c.id <> p.id
          AND LOWER(TRIM(c.position)) IN ('left','l','kiri','1','right','r','kanan','2')
      )
ORDER BY p.username;


-- ============================================================
-- 2. TERAPKAN
-- ============================================================

-- 2a. Kosongkan semua nilai lama yang rusak.
UPDATE public.users
SET left_id = NULL, right_id = NULL;

-- 2b. Isi ulang dari sponsor_id + position.
--     Jika ada lebih dari satu anak di sisi yang sama, yang paling awal
--     mendaftar (registered_at) yang menempati slot; sisanya tidak dicatat
--     di left_id/right_id (tetap terlihat di pohon via sponsor_id + position).
UPDATE public.users AS p
SET
  left_id = (
    SELECT c.id FROM public.users c
    WHERE c.sponsor_id = p.id AND c.id <> p.id
      AND LOWER(TRIM(c.position)) IN ('left','l','kiri','1')
    ORDER BY c.registered_at ASC, c.id ASC
    LIMIT 1
  ),
  right_id = (
    SELECT c.id FROM public.users c
    WHERE c.sponsor_id = p.id AND c.id <> p.id
      AND LOWER(TRIM(c.position)) IN ('right','r','kanan','2')
    ORDER BY c.registered_at ASC, c.id ASC
    LIMIT 1
  )
WHERE EXISTS (
  SELECT 1 FROM public.users c
  WHERE c.sponsor_id = p.id AND c.id <> p.id
    AND LOWER(TRIM(c.position)) IN ('left','l','kiri','1','right','r','kanan','2')
);


-- ============================================================
-- 3. VERIFIKASI — pastikan hasilnya konsisten
--    (kiri/kanan harus menunjuk ke anak yang benar; tidak ada
--     referensi ke diri sendiri atau ke sponsor lagi)
-- ============================================================
SELECT
  p.username AS induk,
  lc.username AS kiri,
  rc.username AS kanan,
  (p.left_id = p.id)  AS kiri_salah_diri_sendiri,
  (p.right_id = p.id) AS kanan_salah_diri_sendiri
FROM public.users p
LEFT JOIN public.users lc ON lc.id = p.left_id
LEFT JOIN public.users rc ON rc.id = p.right_id
WHERE p.left_id IS NOT NULL OR p.right_id IS NOT NULL
ORDER BY p.username;
