import axios from 'axios';
import ora from 'ora';
import chalk from 'chalk';
import moment from 'moment-timezone';
import dotenv from 'dotenv';

// Muat variabel lingkungan dari file .env
dotenv.config();

// Ambil token dan ID dari environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Fungsi timestamp lokal (agar file ini independen)
function getTimestamp() {
  return moment().tz('Asia/Jakarta').format('D/M/YYYY, HH:mm:ss');
}

// Fungsi untuk escape karakter MarkdownV2
const escapeMd = (text) => {
    if (typeof text !== 'string' && typeof text !== 'number') {
        return 'N/A';
    }
    return text.toString().replace(/[_*[\]()~`>#+-=|{}.!]/g, '\\$&');
}


/**
 * Mengirimkan laporan data akun ke Telegram.
 * @param {Array<Object>} reportData - Array objek berisi { name, address, xp }.
 * @param {number} successCount - Jumlah akun yang sukses penuh.
 * @param {number} failCount - Jumlah akun yang gagal/parsial.
 */
async function sendTelegramReport(reportData, successCount, failCount) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log(chalk.yellow(' ┊ ⚠️ Token atau Chat ID Telegram belum diatur di .env. Melewati pengiriman laporan.'));
    return;
  }

  if (!reportData) {
      reportData = []; // Pastikan reportData adalah array
  }

  let message = `📊 *Laporan Enso Bot - ${escapeMd(getTimestamp())}*\n\n`;
  message += `Ringkasan: ✅ ${successCount} sukses, ❌ ${failCount} gagal/parsial\n`;
  message += `------------------------------------\n`;

  if (reportData.length === 0 && failCount > 0) {
      message += `Tidak ada data akun yang berhasil diproses sepenuhnya.\n`;
  } else if (reportData.length === 0) {
      message += `Tidak ada data akun untuk dilaporkan.\n`;
  } else {
      reportData.forEach((info, index) => {
          const name = escapeMd(info.name);
          const address = escapeMd(info.address);
          const xp = escapeMd(info.xp);

          message += `*Akun ${index + 1} (${info.status || 'N/A'})*\n`;
          message += `  - Nama: \`${name}\`\n`;
          message += `  - Alamat: \`${address.slice(0, 8)}\\.\\.\\.${address.slice(-6)}\`\n`; // Perhatikan escape titik
          message += `  - XP: \`${xp}\`\n\n`;
      });
  }

  message += `------------------------------------\n`;
  message += `Laporan Selesai\\.`;

  const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const spinner = ora({ text: chalk.cyan(' ┊ → Mengirim laporan ke Telegram...'), prefixText: '', spinner: 'bouncingBar' }).start();

  try {
    // Potong pesan jika terlalu panjang (batas Telegram 4096)
    const MAX_LENGTH = 4096;
    if (message.length > MAX_LENGTH) {
        message = message.substring(0, MAX_LENGTH - 20) + '\n\n\\[Pesan dipotong\\]';
        console.log(chalk.yellow(' ┊ ⚠️ Pesan terlalu panjang, dipotong untuk Telegram.'));
    }

    await axios.post(telegramApiUrl, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'MarkdownV2',
    });
    spinner.succeed(chalk.green(' ┊ ✓ Laporan berhasil dikirim ke Telegram!'));
  } catch (err) {
    const errorMsg = err.response ? JSON.stringify(err.response.data) : err.message;
    spinner.fail(chalk.red(` ┊ ✗ Gagal mengirim laporan ke Telegram: ${errorMsg}`));
  }
}

// Ekspor fungsi agar bisa digunakan di file lain
export { sendTelegramReport };
