import fs from 'fs/promises';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { ethers } from 'ethers';
import randomUseragent from 'random-useragent';
import ora from 'ora';
import chalk from 'chalk';
import moment from 'moment-timezone';
import figlet from 'figlet'; // Opsional, bisa dihapus jika tidak mau banner

// --- Fungsi Inti (Sebagian besar tidak berubah, kecuali logging & error) ---

function getTimestamp() {
  return moment().tz('Asia/Jakarta').format('D/M/YYYY, HH:mm:ss');
}

// Opsional: Tetap tampilkan banner di log
function displayBanner() {
  const width = process.stdout.columns || 80;
  const banner = figlet.textSync('\n NT EXHAUST', { font: "ANSI Shadow", horizontalLayout: 'Speed' });
  banner.split('\n').forEach(line => {
    console.log(chalk.blue(line.padStart(line.length + Math.floor((width - line.length) / 2))));
  });
  console.log(chalk.green(' '.repeat((width - 28) / 2) + 'ENSO AUTO BOT (CRON MODE) !!'));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Modifikasi: Buat noType = true jadi default atau paksa
async function typeText(text, color, noType = true) { // Defaultkan ke true
  const maxLength = 80;
  const displayText = text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
  if (noType) {
    console.log(color(` ┊ │ ${displayText}`)); // Langsung cetak
    return;
  }
  // Bagian 'typing' ini tidak akan pernah berjalan jika noType = true (default)
  const totalTime = 200;
  const sleepTime = displayText.length > 0 ? totalTime / displayText.length : 1;
  console.log(color(' ┊ ┌── Response Chat API ──'));
  process.stdout.write(color(' ┊ │ '));
  for (const char of displayText) {
    process.stdout.write(char);
    await sleep(sleepTime);
  }
  process.stdout.write('\n');
  console.log(color(' ┊ └──'));
}

function createProgressBar(current, total) {
  const barLength = 30;
  const filled = Math.round((current / total) * barLength);
  return `[${'█'.repeat(filled)}${' '.repeat(barLength - filled)} ${current}/${total}]`;
}

function displayHeader(text, color) {
  console.log(color(text));
}

function isValidPrivateKey(pk) {
  return /^0x[a-fA-F0-9]{64}$|^[a-fA-F0-9]{64}$/.test(pk);
}

function isValidUUID(uuid) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
}

// --- Fungsi API (Tetap sama, tapi error harus melempar agar bisa ditangkap di main) ---
// (Semua fungsi async seperti getPublicIP, getNonce, signMessage, verify, dll.
//  tetap sama, karena mereka sudah cukup baik dalam menangani retry dan
//  melempar error jika gagal total, yang akan ditangkap oleh `main`)
// ... (Salin semua fungsi API dari skrip asli Anda ke sini) ...
// Contoh:
async function getPublicIP(proxy = null) {
  const spinner = ora({ text: chalk.cyan(' ┊ → Mendapatkan IP...'), prefixText: '', spinner: 'bouncingBar' }).start();
  try {
    let config = {};
    if (proxy) {
      config.httpAgent = new HttpsProxyAgent(proxy);
      config.httpsAgent = new HttpsProxyAgent(proxy);
    }
    const response = await axios.get('https://api.ipify.org?format=json', config);
    spinner.succeed(chalk.green(` ┊ ✓ IP: ${response.data.ip}${proxy ? ` (Proxy: ${proxy})` : ''}`));
    await sleep(100);
    return response.data.ip;
  } catch (err) {
    spinner.fail(chalk.red(' ┊ ✗ Gagal mendapatkan IP'));
    throw err; // Pastikan melempar error agar bisa ditangkap
  }
}
// --- [!!!] PASTIKAN ANDA MENYALIN SEMUA FUNGSI ASLI ANDA KE SINI [!!!] ---
// getNonce, signMessage, verify, getAccountInfo, getUserInfo, performChat,
// generateProjectSlug, createDefiDex, getCampaigns, completeCampaign,
// getProtocols, completeProtocol

// --- Fungsi Proses Utama (Tetap sama) ---
// ... (Salin fungsi processAccounts dari skrip asli Anda ke sini) ...
// --- [!!!] PASTIKAN ANDA MENYALIN FUNGSI `processAccounts` KE SINI [!!!] ---
async function processAccounts(accounts, messages, accountProxies, noType) {
  // ... (Isi fungsi sama persis seperti sebelumnya) ...
  // Pastikan error di dalam sini (jika tidak tertangani) akan melempar
  // atau jika Anda ingin satu akun gagal tidak menghentikan semua,
  // tangani di dalam loop tapi catat kegagalannya.
  // Saat ini, jika ada error yang tidak tertangani di sini, akan
  // ditangkap oleh 'main'.
  const INTERACTIONS = 5;
  const DEFIDEX_LIMIT = 5;
  let successCount = 0;
  let failCount = 0;
  let failedChats = 0;
  let successfulDexes = 0;
  let failedDexes = 0;
  let successfulCampaigns = 0;
  let failedCampaigns = 0;
  let successfulProtocols = 0;
  let failedProtocols = 0;

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const proxy = accountProxies[i];
    const shortAddress = `${account.address.slice(0, 8)}...${account.address.slice(-6)}`;

    displayHeader(`═════[ Akun ${i + 1}/${accounts.length} @ ${getTimestamp()} ]═════`, chalk.blue);

    const ip = await getPublicIP(proxy);

    let accountSuccess = true;
    let partialFailure = false;

    try {
        const nonce = await getNonce(proxy);
        const { message, signature } = await signMessage(account.privateKey, nonce, account.address);
        const { token } = await verify(message, signature, account.address, proxy);
        const accountInfo = await getAccountInfo(token, account.address, proxy);

        console.log(chalk.magentaBright(' ┊ ┌── Proses Chat ──'));
        for (let j = 0; j < INTERACTIONS; j++) {
            console.log(chalk.yellow(` ┊ ├─ Chat ${createProgressBar(j + 1, INTERACTIONS)} ──`));
            const query = messages[Math.floor(Math.random() * messages.length)];
            console.log(chalk.white(` ┊ │ Pesan: ${query}`));
            const response = await performChat(token, query, account.address, messages, proxy);
            if (response.startsWith('Gagal')) {
                failedChats++;
                partialFailure = true;
            }
            await typeText(response, response.startsWith('Gagal') ? chalk.red : chalk.green, noType);
            await sleep(1000);
            console.log(chalk.yellow(' ┊ └──'));
            await sleep(3000);
        }
        console.log(chalk.yellow(' ┊ └──'));

        console.log(chalk.magentaBright(' ┊ ┌── Proses DeFiDex ──'));
        for (let j = 0; j < DEFIDEX_LIMIT; j++) {
            console.log(chalk.yellow(` ┊ ├─ DeFiDex ${createProgressBar(j + 1, DEFIDEX_LIMIT)} ──`));
            const projectSlug = generateProjectSlug();
            console.log(chalk.white(` ┊ │ Project Slug: ${projectSlug}`));
            const success = await createDefiDex(projectSlug, account.address, account.zealyUserId, proxy);
            if (success) {
                successfulDexes++;
            } else {
                failedDexes++;
                partialFailure = true;
                if (!success && j === 0) break;
            }
            await sleep(1000);
        }
        console.log(chalk.yellow(' ┊ └──'));

        console.log(chalk.magentaBright(' ┊ ┌── Proses Completing Campaigns ──'));
        const campaigns = await getCampaigns(account.zealyUserId, proxy);
        if (campaigns.length === 0) {
            console.log(chalk.yellow(' ┊ │ Tidak dapat mengambil daftar campaign karena error server'));
            console.log(chalk.yellow(' ┊ └──'));
        } else {
            const pendingCampaigns = campaigns.filter(c => !c.visited && !c.pointsAwarded);
            if (pendingCampaigns.length === 0) {
                console.log(chalk.green(' ┊ │ Semua campaign sudah selesai!'));
                console.log(chalk.yellow(' ┊ └──'));
            } else {
                console.log(chalk.white(` ┊ │ ${pendingCampaigns.length} campaign belum dikerjakan ditemukan`));
                const spinner = ora({ text: chalk.cyan(` ┊ │ Memproses campaign: 0/${pendingCampaigns.length}...`), prefixText: '', spinner: 'bouncingBar' }).start();
                for (let j = 0; j < pendingCampaigns.length; j++) {
                    const campaign = pendingCampaigns[j];
                    const success = await completeCampaign(account.address, campaign.id, campaign.name, account.zealyUserId, proxy, 0, spinner);
                    if (success) {
                        successfulCampaigns++;
                    } else {
                        failedCampaigns++;
                        partialFailure = true;
                    }
                    spinner.text = chalk.cyan(` ┊ │ Memproses campaign: ${j + 1}/${pendingCampaigns.length}...`);
                    await sleep(1000);
                }
                spinner.succeed(chalk.green(` ┊ ✓ ${successfulCampaigns} dari ${pendingCampaigns.length} campaign selesai`));
                console.log(chalk.yellow(' ┊ └──'));
            }
        }

        console.log(chalk.magentaBright(' ┊ ┌── Proses Completing Protocols ──'));
        const protocols = await getProtocols(account.zealyUserId, proxy);
        if (protocols.length === 0) {
            console.log(chalk.yellow(' ┊ │ Tidak dapat mengambil daftar protocols karena error server'));
            console.log(chalk.yellow(' ┊ └──'));
        } else {
            const pendingProtocols = protocols.filter(p => !p.visited && !p.pointsAwarded);
            if (pendingProtocols.length === 0) {
                console.log(chalk.green(' ┊ │ Semua protocols sudah selesai!'));
                console.log(chalk.yellow(' ┊ └──'));
            } else {
                console.log(chalk.white(` ┊ │ ${pendingProtocols.length} protocols belum dikerjakan ditemukan`));
                const spinner = ora({ text: chalk.cyan(` ┊ │ Memproses protocols: 0/${pendingProtocols.length}...`), prefixText: '', spinner: 'bouncingBar' }).start();
                for (let j = 0; j < pendingProtocols.length; j++) {
                    const protocol = pendingProtocols[j];
                    const success = await completeProtocol(account.address, protocol.id, protocol.name, account.zealyUserId, proxy, 0, spinner);
                    if (success) {
                        successfulProtocols++;
                    } else {
                        failedProtocols++;
                        partialFailure = true;
                    }
                    spinner.text = chalk.cyan(` ┊ │ Memproses protocols: ${j + 1}/${pendingProtocols.length}...`);
                    await sleep(1000);
                }
                spinner.succeed(chalk.green(` ┊ ✓ ${successfulProtocols} dari ${pendingProtocols.length} protocols selesai`));
                console.log(chalk.yellow(' ┊ └──'));
            }
        }

        const userInfo = await getUserInfo(account.zealyUserId, proxy);
        console.log(chalk.yellow(' ┊ ┌── Ringkasan User ──'));
        console.log(chalk.white(` ┊ │ Username: ${userInfo.name}`));
        console.log(chalk.white(` ┊ │ User Address: ${userInfo.connectedWallet}`));
        console.log(chalk.white(` ┊ │ Total XP: ${userInfo.xp}`));
        console.log(chalk.yellow(' ┊ └──'));

    } catch (err) {
        console.log(chalk.red(` ┊ ✗ Error pada Akun ${shortAddress}: ${err.message}`));
        accountSuccess = false;
        failCount++;
        // Kita tidak 'throw' di sini agar loop bisa lanjut ke akun berikutnya
        // Tapi kita tandai sebagai gagal.
    }

    if (accountSuccess && !partialFailure) {
        successCount++;
    } else {
        // Jika sukses tapi ada kegagalan parsial, atau gagal total
        failCount++;
    }
    console.log(chalk.gray(' ┊ ══════════════════════════════════════'));
  }

  displayHeader(`═════[ Selesai @ ${getTimestamp()} ]═════`, chalk.blue);
  console.log(chalk.gray(` ┊ ✅ ${successCount} akun sukses penuh, ❌ ${failCount} akun gagal/parsial`));
  if (failedChats > 0) console.log(chalk.yellow(` ┊ ⚠️ ${failedChats} chat gagal`));
  if (failedDexes > 0) console.log(chalk.yellow(` ┊ ⚠️ ${failedDexes} DeFiDex gagal`));
  if (failedCampaigns > 0) console.log(chalk.yellow(` ┊ ⚠️ ${failedCampaigns} campaign gagal`));
  if (failedProtocols > 0) console.log(chalk.yellow(` ┊ ⚠️ ${failedProtocols} protocols gagal`));

  // Jika ada kegagalan sama sekali, kita bisa melempar error agar 'main' tahu
  if (failCount > 0) {
      throw new Error(`${failCount} akun mengalami kegagalan.`);
  }
}


// --- Fungsi Main (Dirombak Total) ---

async function main() {
  console.log(chalk.blue(`\n--- [${getTimestamp()}] Memulai Eksekusi CRON Job Enso ---`));
  displayBanner(); // Tampilkan banner di log

  const noType = true; // Selalu non-aktifkan efek mengetik untuk cron
  let accounts = [];
  let messages = [];
  let proxies = [];
  let accountProxies = [];

  try {
    // 1. Baca Akun (Wajib)
    try {
      const accountsData = await fs.readFile('accounts.txt', 'utf8');
      const lines = accountsData.split('\n').filter(line => line.trim() !== '');
      for (let i = 0; i < lines.length; i++) {
        const [privateKey, zealyUserId] = lines[i].split(',').map(item => item.trim());
        if (!privateKey || !zealyUserId) throw new Error(`Baris ${i + 1} di accounts.txt tidak lengkap.`);
        if (!isValidPrivateKey(privateKey)) throw new Error(`PK tidak valid di baris ${i + 1}.`);
        if (!isValidUUID(zealyUserId)) throw new Error(`UUID tidak valid di baris ${i + 1}.`);
        const wallet = new ethers.Wallet(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`);
        accounts.push({ address: wallet.address, privateKey, zealyUserId });
      }
      if (accounts.length === 0) throw new Error('Tidak ada akun valid ditemukan di accounts.txt.');
      console.log(chalk.green(` ┊ ✓ ${accounts.length} akun berhasil dimuat.`));
    } catch (err) {
      throw new Error(`Gagal membaca/memproses accounts.txt: ${err.message}`);
    }

    // 2. Baca Pesan (Wajib)
    try {
      const msgData = await fs.readFile('pesan.txt', 'utf8');
      messages = msgData.split('\n').filter(line => line.trim() !== '');
      if (messages.length === 0) throw new Error('Tidak ada pesan ditemukan di pesan.txt.');
      console.log(chalk.green(` ┊ ✓ ${messages.length} pesan berhasil dimuat.`));
    } catch (err) {
      throw new Error(`Gagal membaca/memproses pesan.txt: ${err.message}`);
    }

    // 3. Baca Proxy (Opsional)
    try {
      const proxyData = await fs.readFile('proxy.txt', 'utf8');
      proxies = proxyData.split('\n').filter(line => line.trim() !== '');
      if (proxies.length > 0) {
        console.log(chalk.green(` ┊ ✓ ${proxies.length} proxy berhasil dimuat. Proxy akan digunakan.`));
      } else {
        console.log(chalk.yellow(' ┊ ⚠️ File proxy.txt kosong. Berjalan tanpa proxy.'));
      }
    } catch (err) {
      console.log(chalk.yellow(' ┊ ⚠️ File proxy.txt tidak ditemukan. Berjalan tanpa proxy.'));
    }

    // 4. Petakan Proxy ke Akun
    accountProxies = accounts.map((_, index) => {
      return proxies.length > 0 ? proxies[index % proxies.length] : null;
    });

    // 5. Jalankan Proses Utama
    await processAccounts(accounts, messages, accountProxies, noType);

    // 6. Jika semua berjalan lancar sampai sini
    console.log(chalk.green(`--- [${getTimestamp()}] Eksekusi CRON Job Enso Berhasil ---`));
    process.exit(0); // Keluar dengan kode sukses

  } catch (err) {
    // Tangkap SEMUA error yang tidak tertangani dari langkah-langkah di atas
    console.error(chalk.red(`\n--- [${getTimestamp()}] !!! Eksekusi CRON Job Gagal Total !!! ---`));
    console.error(chalk.red(` ┊ ✗ Error: ${err.message}`));
    console.error(err.stack); // Cetak stack trace untuk debug
    process.exit(1); // Keluar dengan kode error
  }
}

// Langsung panggil fungsi main
main();
