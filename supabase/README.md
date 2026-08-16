# Supabase — Keamanan & Bonus Server-Side

Dokumen ini berisi langkah mengamankan project untuk produksi. **Tidak ada satu pun
langkah di sini yang menghapus member** — semua hanya mengatur izin (RLS) dan
membayar bonus lewat fungsi server-side.

## ⚠️ Sebelum mulai: BACKUP
1. Supabase Dashboard → **Database → Backups** → aktifkan **PITR** (paid) atau
   jadwalkan backup harian.
2. Ekspor manual tabel `users`, `transactions`, `orders` (CSV) sebagai cadangan.

---

## Langkah 1 — Aktifkan RLS (izin database)
Buka dashboard Supabase Anda (project: `dbfwcsuptitytlposubo`) →
**SQL Editor** → tempel isi file **`supabase/rls-policies.sql`** → **Run**.
Efek: member hanya bisa mengubah datanya sendiri; admin bisa mengubah semua;
yang lain hanya bisa membaca. Tidak menghapus data apa pun.

---

## Langkah 2 — Deploy Edge Function bonus (TANPA command line)

> **Apa gunanya?** Saat ini logika "siapa dapat bonus berapa" dijalankan di browser
> member — artinya member yang jago IT bisa memalsukan bonus. Langkah ini
> memindahkan mesin bonus itu ke server Supabase sehingga tidak bisa dipalsukan.

Lakukan 2× (dua fungsi), semuanya lewat klik-klik di dashboard:

1. Buka dashboard Supabase → pilih project → menu kiri **Edge Functions**.
2. Klik **"Deploy a new function"** → pilih **"Via Editor"**.
3. Isi **Nama** (wajib persis):
   - fungsi pertama: **`distribute-bonus`**
   - fungsi kedua (ulangi langkah 1–4): **`backfill-bonus`**
4. **Hapus** kode template, lalu **tempel** isi file:
   - `supabase/functions/distribute-bonus/index.ts` → untuk fungsi `distribute-bonus`
   - `supabase/functions/backfill-bonus/index.ts` → untuk fungsi `backfill-bonus`
5. Klik **"Deploy function"** (tunggu 10–30 detik sampai muncul sukses).

> **Sudah diisi otomatis:** URL di `supabase.js` sudah di-set ke
> `https://dbfwcsuptitytlposubo.supabase.co/functions/v1/distribute-bonus`.
> Begitu fungsi pertama ter-deploy, aplikasi langsung memakainya. Kalau fungsi
> belum ter-deploy, aplikasi tetap jalan dengan mode lama (aman, hanya log
> peringatan).

Setelah deploy, tes cepat (opsional): buka halaman fungsi di dashboard → tombol
**Test** → method **POST** → body `{"orderId": "<ID_ORDER>"}` → Send. Akan
kembali `{"success": true}` jika berhasil.

---

## Langkah 3 — Proteksi saldo (opsional tapi sangat disarankan)
Jalankan di SQL Editor: `supabase/wallet-guard.sql`

Trigger ini mengunci kolom saldo/bonus supaya **member biasa tidak bisa**
mengubahnya (misal lewat console browser), tetapi tetap mengizinkan:
- **admin** (agar panel admin tetap bisa proses deposit/withdraw/verifikasi), dan
- **service_role** (Edge Function `distribute-bonus` / `backfill-bonus`).

> ⚠️ Jika Anda sudah pernah menjalankan **versi lama** file ini (yang memblokir
> SEMUA non-service_role), panel admin akan gagal mengubah saldo saat proses
> deposit/withdraw/verifikasi. Solusinya: jalankan **ulang** file `wallet-guard.sql`
> versi terbaru — aman (idempotent) dan langsung memperbaiki panel admin.

---

## Perbaiki data binary tree (opsional, jika pohon jaringan tampak aneh)
Jalankan di SQL Editor: `supabase/fix-binary-tree.sql`

Menulis ulang `left_id`/`right_id` dari relasi `sponsor_id` + `position`
(sumber kebenaran). File ini berisi: **PREVIEW** (read-only, lihat dulu),
**TERAPKAN** (hanya UPDATE 2 kolom), dan **VERIFIKASI**. Tidak ada DELETE.

## Backfill member lama
Halaman `backfill-bonus.html` (di situs Anda) sudah bisa dipakai: jalankan
**Audit** (read-only) lalu **Terapkan** — hanya bisa oleh admin yang login.
Hasilnya sama dengan fungsi `backfill-bonus` di atas.

## Rollback
- Backfill bersifat aditif: untuk membatalkan, hapus transaksi `bonus_pasangan`/
  `bonus_sponsor` bertanda "(backfill)" lalu kurangi saldo sesuai jumlahnya, dan
  reset `left_count`/`right_count`/`paid_pairs` (jalankan ulang audit untuk
  angka pastinya).
- Cara paling aman: pulihkan dari backup (bagian "Sebelum mulai").
