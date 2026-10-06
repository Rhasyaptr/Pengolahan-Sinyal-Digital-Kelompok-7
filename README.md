D-Clean: DCT Signal Engine (Kelompok 7, Pengolahan Sinyal Digital)
Aplikasi web interaktif untuk DCT-II / IDCT ortonormal (N = 256), pemangkasan koefisien (K), dan analisis MSE, SNR, serta kompaksi energi.

Cara menjalankan
Unduh seluruh folder (index.html, style.css, app.js, folder lib/).
Buka index.html di browser (Chrome/Edge/Firefox). Tidak perlu server atau instalasi.
Online: Chart.js dimuat otomatis dari CDN. Offline: letakkan chart.umd.min.js (Chart.js v4.4.1) di folder lib/.
Demo publik: https://pspkelompok7.netlify.app

Cara mengulang hasil pengujian di laporan
Mode Sintesis, bentuk Sinus, Frekuensi utama 5 Hz, superposisi 10 Hz, Seed noise = 7, lalu atur Amplitudo noise (0,5 / 2 / 5) dan K. Seed yang sama menghasilkan noise yang sama, sehingga angka MSE dan SNR identik. Matikan tombol "Noise hidup" (noise acak tanpa seed).

Struktur berkas
index.html kerangka halaman dan pemuat Chart.js
style.css tampilan
app.js logika: DCT/IDCT, filter K, metrik, audio, grafik, eksperimen sapuan K, demo
