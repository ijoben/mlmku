# Supabase — Keamanan & Bonus Server-Side

Dokumen ini berisi langkah mengamankan project untuk produksi. **Tidak ada satu pun
langkah di sini yang menghapus member** — semua hanya mengatur izin (RLS) dan
membayar bonus lewat fungsi server-side.

## ⚠️ Sebelum mulai: BACKUP
1. Supabase Dashboard → **Database → Backups** → aktifkan **PITR** (paid) atau
   jadwalkan backup harian.
2. Ekspor manual tabel `users`, `transactions`, `orders` (CSV) sebagai cadangan.

## Langkah 1 — Aktifkan RLS
Jalankan di **SQL Editor**:
```
supabase/rls-policies.sql
```
Efek: user hanya bisa menulis barisnya sendiri; admin bisa menulis baris semua
orang; settings/konten hanya admin yang bisa tulis; semua orang boleh baca
(dibutuhkan pohon binary & katalog). Tidak menghapus data apa pun.

> Catatan: setelah RLS aktif, halaman admin tetap berfungsi karena admin
> (role `admin`) lolos policy. Non-admin tidak bisa lagi mengubah saldo/bonus
> member lain dari console browser.

## Langkah 2 — Deploy Edge Function bonus
```bash
supabase login
supabase link --project-ref <project-ref>
supabase functions deploy distribute-bonus
supabase functions deploy backfill-bonus
```
Env `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` otomatis tersedia di Edge
Function (tidak perlu set manual).

Kemudian isi di `supabase.js`:
```js
window.HEDTRO_BONUS_FUNCTION_URL = 'https://<project-ref>.supabase.co/functions/v1/distribute-bonus';
```
Saat URL terisi, alur **approve order / verifikasi admin** dan **RO lunas member**
otomatis memakai fungsi server-side (service_role) — client tidak lagi mencetak
bonus sendiri. Jika URL kosong, aplikasi kembali ke logika client (mode lama).

## Langkah 3 — Proteksi saldo (opsional tapi sangat disarankan)
Hanya setelah Langkah 2 selesai & semua alur admin sudah lewat Edge Function,
jalankan di SQL Editor:
```
supabase/wallet-guard.sql
```
Trigger ini menolak perubahan `wallet`/`bonus_*`/`left_count`/`right_count`/
`paid_pairs` dari role selain `service_role`. Setelah ini, saldo HANYA bisa
berubah lewat Edge Function.

## Backfill member lama (server-side)
```bash
# Preview (read-only, tidak menulis):
curl -X POST https://<ref>.supabase.co/functions/v1/backfill-bonus \
  -H "Authorization: Bearer <ADMIN_JWT>" -H "Content-Type: application/json" \
  -d '{"dryRun": true}'

# Terapkan:
curl -X POST https://<ref>.supabase.co/functions/v1/backfill-bonus \
  -H "Authorization: Bearer <ADMIN_JWT>" -H "Content-Type: application/json" \
  -d '{"dryRun": false}'
```
Halaman `backfill-bonus.html` (versi browser) tetap bisa dipakai sebagai
alternatif untuk member yang sudah login admin; hasilnya sama dengan fungsi ini.

## Rollback
- Backfill bersifat aditif: untuk membatalkan, hapus transaksi
  `bonus_pasangan`/`bonus_sponsor` bertanda "(backfill)" dan kurangi saldo sesuai
  jumlahnya, lalu reset `left_count`/`right_count`/`paid_pairs` (jalankan ulang
  audit di `backfill-bonus.html` untuk angka pastinya).
- Sebelum semua itu: pulihkan dari backup (Langkah 0).
