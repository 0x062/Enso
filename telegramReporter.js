import axios from 'axios';
import ora from 'ora';
import chalk from 'chalk';
import moment from 'moment-timezone';
import dotenv from 'dotenv';

// Muat variabel lingkungan dari file .env
dotenv.config();
console.log(chalk.magenta('DEBUG: Memasuki fungsi sendTelegramReport...')); // Tetap simpan ini untuk tes

// Ambil token dan ID dari environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Fungsi timestamp lokal
function getTimestamp() {
  return moment().tz('Asia/Jakarta').format('D/M/YYYY, HH:mm:ss');
}

// Fungsi BARU untuk escape karakter HTML dasar
const escapeHtml = (text) => {
    if (typeof text !== 'string' && typeof text !== 'number') {
        return 'N/A';
    }
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
    };
    return text.toString().replace(/[&<>]/g, (m) => map[m]);
};


/**
 * Mengirimkan laporan data akun ke Telegram.
 * @param {Array<Object>} reportData - Array objek berisi { name, address, xp, status }.
 * @param {number} successCount - Jumlah akun yang sukses penuh.
 * @param {number} failCount - Jumlah akun yang gagal/parsial.
 */
async function sendTelegramReport(reportData, successCount, failCount) {
  console.log(chalk.magenta('DEBUG: Memasuki fungsi sendTelegramReport...')); // <-- Log Awal

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log(chalk.yellow(' ┊ ⚠️ Token atau Chat ID Telegram belum diatur di .env. Melewati pengiriman laporan.'));
    return;
  }

  if (!reportData) {
      reportData = [];
  }

  // --- Buat Pesan Menggunakan Format HTML ---
  let message = `📊 <b>Laporan Enso Bot - ${escapeHtml(getTimestamp())}</b>\n\n`;
  message += `Ringkasan: ✅ ${successCount} sukses, ❌ ${failCount} gagal/parsial\n`;
  message += `------------------------------------\n`;

  if (reportData.length === 0) {
      message += `Tidak ada data akun untuk dilaporkan.\n`;
  } else {
      reportData.forEach((info, index) => {
          const name = escapeHtml(info.name);
          const address = escapeHtml(info.address);
          const xp = escapeHtml(info.xp);
          const status = escapeHtml(info.status || 'N/A');

          message += `<b>Akun ${index + 1} (${status})</b>\n`;
          message += `  - Nama: <code>${name}</code>\n`;
          message += `  - Alamat: <code>${address.slice(0, 8)}...${address.slice(-6)}</code>\n`;
          message += `  - XP: <code>${xp}</code>\n\n`;
      });
  }

  message += `------------------------------------\n`;
  message += `Laporan Selesai.`;

  const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const spinner = ora({ text: chalk.cyan(' ┊ → Mengirim laporan ke Telegram...'), prefixText: '', spinner: 'bouncingBar' }).start();

  try {
    const MAX_LENGTH = 4096;
    if (message.length > MAX_LENGTH) {
        message = message.substring(0, MAX_LENGTH - 20) + '\n\n<i>[Pesan dipotong]</i>';
        console.log(chalk.yellow(' ┊ ⚠️ Pesan terlalu panjang, dipotong untuk Telegram.'));
    }

    await axios.post(telegramApiUrl, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
+     parse_mode: 'HTML', // <-- GANTI KE HTML
    });
    spinner.succeed(chalk.green(' ┊ ✓ Laporan berhasil dikirim ke Telegram!'));
  } catch (err) {
    const errorMsg = err.response ? JSON.stringify(err.response.data) : err.message;
    spinner.fail(chalk.red(` ┊ ✗ Gagal mengirim laporan ke Telegram: ${errorMsg}`));
  }
}

// Ekspor fungsi agar bisa digunakan di file lain
export { sendTelegramReport };
