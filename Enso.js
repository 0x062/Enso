import fs from 'fs/promises';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { ethers } from 'ethers';
import randomUseragent from 'random-useragent';
import ora from 'ora';
import chalk from 'chalk';
import moment from 'moment-timezone';
import figlet from 'figlet';
import { sendTelegramReport } from './telegramReporter.js'; // Pastikan file ini ada dan benar

// --- Fungsi Utilitas & Tampilan ---

function getTimestamp() {
  return moment().tz('Asia/Jakarta').format('D/M/YYYY, HH:mm:ss');
}

function displayBanner() {
  const width = process.stdout.columns || 80;
  const banner = figlet.textSync('\n NT EXHAUST', { font: "ANSI Shadow", horizontalLayout: 'Speed' });
  banner.split('\n').forEach(line => {
    console.log(chalk.blue(line.padStart(line.length + Math.floor((width - line.length) / 2))));
  });
  // Mengubah banner untuk mencerminkan fokus script yang baru
  console.log(chalk.green(' '.repeat((width - 38) / 2) + 'ENSO SPEEDRUN BOT (CRON MODE) !!'));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function typeText(text, color, noType = true) { // Fungsi ini mungkin tidak banyak digunakan lagi, tapi tidak apa-apa jika tetap ada
  const maxLength = 80;
  const displayText = text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
  if (noType) {
    console.log(color(` ┊ │ ${displayText}`));
    return;
  }
  const totalTime = 200;
  const sleepTime = displayText.length > 0 ? totalTime / displayText.length : 1;
  console.log(color(' ┊ ┌── Response ──')); // Mengganti nama dari "Response Chat API"
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

// --- Fungsi API & Interaksi (Fokus pada speedrun.enso.build) ---

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
    throw err; // Sebaiknya lemparkan error agar bisa ditangani jika krusial
  }
}

async function getUserInfo(zealyUserId, proxy = null, retryCount = 0) { // Ini adalah versi untuk speedrun.enso.build
  const maxRetries = 3;
  const spinner = ora({ text: chalk.cyan(` ┊ → Mengambil info user (Zealy ID: ${zealyUserId.slice(0, 8)}...)${retryCount > 0 ? ` (Retry ke-${retryCount}/${maxRetries})` : ''}...`), prefixText: '', spinner: 'bouncingBar' }).start();
  try {
    let config = {
      headers: {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'en-US,en;q=0.7', // Sesuaikan jika perlu
        'content-type': 'application/json',
        'priority': 'u=1, i',
        'sec-ch-ua': randomUseragent.getRandom(),
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"', // Bisa disesuaikan
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'sec-gpc': '1', // Sesuaikan jika perlu
        'Referer': 'https://speedrun.enso.build/campaign', // Penting
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    };
    if (proxy) {
      config.httpAgent = new HttpsProxyAgent(proxy);
      config.httpsAgent = new HttpsProxyAgent(proxy);
    }
    const response = await axios.get(`https://speedrun.enso.build/api/zealy/user/${zealyUserId}`, config);
    spinner.succeed(chalk.green(` ┊ ✓ Info user diterima: ${response.data.name || 'Tidak ada nama'}`));
    await sleep(100);
    return {
      name: response.data.name || 'Unknown',
      connectedWallet: response.data.connectedWallet || 'Unknown',
      xp: response.data.xp || 0,
    };
  } catch (err) {
    const errorMsg = err.response ? `HTTP ${err.response.status}` : err.message;
    if (retryCount < maxRetries - 1) {
      spinner.text = chalk.cyan(` ┊ → Mengambil info user (Zealy ID: ${zealyUserId.slice(0, 8)}...) (Retry ke-${retryCount + 1}/${maxRetries})...`);
      await sleep(5000); // Delay sebelum retry
      return getUserInfo(zealyUserId, proxy, retryCount + 1);
    }
    spinner.fail(chalk.red(` ┊ ✗ Gagal mengambil info user: ${errorMsg}`));
    // Kembalikan nilai default agar tidak crash, tapi tandai sebagai error di pemanggil jika perlu
    return { name: 'Error', connectedWallet: 'Error', xp: 0, error: true };
  }
}

function generateProjectSlug() {
    const words = [
        'lucky', 'star', 'nova', 'cool', 'hoki', 'prime', 'sky', 'neo', 'blaze', 'tech',
        'moon', 'pulse', 'vibe', 'spark', 'glow', 'ace', 'zen', 'flash', 'bolt', 'wave',
        'fire', 'storm', 'dream', 'edge', 'flow', 'peak', 'rush', 'light', 'force', 'dash',
        'glint', 'surge', 'breeze', 'shade', 'frost', 'flame', 'core', 'drift', 'bloom', 'quest',
        'wind', 'tide', 'dawn', 'dusk', 'mist', 'cloud', 'ridge', 'vale', 'forge', 'link',
        'beam', 'spire', 'gleam', 'twist', 'loop', 'arc', 'vault', 'crux', 'nexus', 'orbit',
        'zest', 'chill', 'haze', 'glory', 'swift', 'bold', 'vivid', 'pure', 'clear', 'bright',
        'epic', 'grand', 'royal', 'noble', 'wild', 'free', 'soar', 'rise', 'shine', 'grow',
        'vapor', 'trail', 'echo', 'pulse', 'swing', 'shift', 'turn', 'blend', 'forge', 'craft',
        'seek', 'hunt', 'roam', 'drift', 'sail', 'climb', 'reach', 'touch', 'spark', 'ignite'
    ];
    const word1 = words[Math.floor(Math.random() * words.length)];
    const word2 = words[Math.floor(Math.random() * words.length)];
    const number = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${word1}-${word2}-${number}.widget`;
}

async function createDefiDex(projectSlug, address, zealyUserId, proxy = null, retryCount = 0) {
    const maxRetries = 3; // Jumlah retry bisa disesuaikan
    const spinner = ora({ text: chalk.cyan(` ┊ → Membuat DeFiDex: ${projectSlug}${retryCount > 0 ? ` (Retry ke-${retryCount}/${maxRetries})` : ''}...`), prefixText: '', spinner: 'bouncingBar' }).start();
    try {
        let config = {
            headers: { /* Header sama seperti di script asli */
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'en-US,en;q=0.7',
                'content-type': 'application/json',
                'priority': 'u=1, i',
                'sec-ch-ua': randomUseragent.getRandom(),
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'sec-gpc': '1',
                'Referer': 'https://speedrun.enso.build/create/de-fi/shortcuts-widget',
                'Referrer-Policy': 'strict-origin-when-cross-origin',
            },
        };
        if (proxy) {
            config.httpAgent = new HttpsProxyAgent(proxy);
            config.httpsAgent = new HttpsProxyAgent(proxy);
        }
        const payload = {
            userId: address,
            projectSlug,
            zealyUserId,
            projectType: 'shortcuts-widget',
        };
        const response = await axios.post('https://speedrun.enso.build/api/track-project-creation', payload, config);
        if (response.data.success) {
            spinner.succeed(chalk.green(` ┊ ✓ DeFiDex dibuat: ${projectSlug}`));
            await sleep(100);
            return true;
        } else if (response.data.code === 3) { // Batas harian
            spinner.stop(); // Hentikan spinner sebelum log
            console.log(chalk.yellow(` ┊ ⚠️ Batas harian DeFiDex tercapai: ${response.data.message}`));
            await sleep(100);
            return false; // Jangan retry jika batas harian
        } else {
            throw new Error(response.data.message || 'Gagal membuat DeFiDex dengan status tidak sukses');
        }
    } catch (err) {
        const errorMsg = err.response ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data || err.response.statusText || {})}` : err.message;
        // Jangan retry jika code === 3 (batas harian)
        if (err.response && err.response.data && err.response.data.code === 3) {
            spinner.stop();
            console.log(chalk.yellow(` ┊ ⚠️ Batas harian DeFiDex tercapai (dari catch): ${err.response.data.message}`));
            await sleep(100);
            return false;
        }
        if (retryCount < maxRetries - 1) {
            spinner.text = chalk.cyan(` ┊ → Membuat DeFiDex: ${projectSlug} (Retry ke-${retryCount + 1}/${maxRetries})...`);
            await sleep(5000);
            return createDefiDex(projectSlug, address, zealyUserId, proxy, retryCount + 1);
        }
        if (err.response && err.response.data) {
            console.log(chalk.gray(` ┊ ℹ️ Detail error server (DeFiDex): ${JSON.stringify(err.response.data)}`));
        }
        spinner.fail(chalk.red(` ┊ ✗ Gagal membuat DeFiDex setelah ${maxRetries} percobaan: ${errorMsg}`));
        await sleep(100);
        return false;
    }
}

async function getCampaigns(zealyUserId, proxy = null, retryCount = 0) {
    const maxRetries = 3;
    const limit = 10;
    let allCampaigns = [];
    let page = 1;
    const spinner = ora({ text: chalk.cyan(` ┊ → Mengambil daftar campaign (Halaman ${page})${retryCount > 0 ? ` (Retry ke-${retryCount}/${maxRetries})` : ''}...`), prefixText: '', spinner: 'bouncingBar' }).start();
    try {
        let config = { headers: { /* Header sama seperti di script asli */
            'accept': 'application/json, text/plain, */*',
            'accept-language': 'en-US,en;q=0.7',
            'content-type': 'application/json',
            'priority': 'u=1, i',
            'sec-ch-ua': randomUseragent.getRandom(),
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'sec-gpc': '1',
            'Referer': 'https://speedrun.enso.build/campaign',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
        }};
        if (proxy) {
            config.httpAgent = new HttpsProxyAgent(proxy);
            config.httpsAgent = new HttpsProxyAgent(proxy);
        }
        while (true) {
            const response = await axios.get(`https://speedrun.enso.build/api/get-campaigns?page=${page}&limit=${limit}&zealyUserId=${zealyUserId}`, config);
            const { campaigns, total } = response.data;
            if (!campaigns || typeof total === 'undefined') throw new Error("Respons API campaign tidak valid (data tidak lengkap)");
            allCampaigns = allCampaigns.concat(campaigns);
            spinner.text = chalk.cyan(` ┊ → Mengambil daftar campaign (Halaman ${page}/${Math.ceil(total / limit)})...`);
            if (page * limit >= total || campaigns.length === 0) break; // Tambah cek campaigns.length === 0 untuk cegah loop tak terbatas jika API aneh
            page++;
            await sleep(2000); // Jeda antar halaman
        }
        spinner.succeed(chalk.green(` ┊ ✓ ${allCampaigns.length} campaign ditemukan`));
        await sleep(100);
        return allCampaigns;
    } catch (err) {
        const errorMsg = err.response ? `HTTP ${err.response.status}` : err.message;
        if (retryCount < maxRetries - 1) {
            spinner.text = chalk.cyan(` ┊ → Mengambil daftar campaign (Retry ke-${retryCount + 1}/${maxRetries})...`);
            await sleep(5000);
            return getCampaigns(zealyUserId, proxy, retryCount + 1);
        }
        spinner.fail(chalk.red(` ┊ ✗ Gagal mengambil daftar campaign: ${errorMsg}`));
        await sleep(100);
        return []; // Kembalikan array kosong jika gagal total
    } finally {
        if(spinner.isSpinning) spinner.stop();
    }
}

async function completeCampaign(address, campaignId, campaignName, zealyUserId, proxy = null, retryCount = 0, spinner = null) {
    const maxRetries = 3;
    // Jika tidak ada spinner global, buat spinner lokal sementara
    const localSpinner = !spinner;
    if (localSpinner) spinner = ora({ text: chalk.cyan(` ┊ → Menyelesaikan campaign ${campaignName}...`), prefixText: '', spinner: 'bouncingBar' }).start();
    else spinner.text = chalk.cyan(` ┊ → Menyelesaikan campaign ${campaignName} (ID: ${campaignId.slice(0,6)}...)...`);

    try {
        let config = { headers: { /* Header sama */
            'accept': 'application/json, text/plain, */*',
            'accept-language': 'en-US,en;q=0.7',
            'content-type': 'application/json',
            'priority': 'u=1, i',
            'sec-ch-ua': randomUseragent.getRandom(),
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'sec-gpc': '1',
            'Referer': 'https://speedrun.enso.build/campaign',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
        }};
        if (proxy) {
            config.httpAgent = new HttpsProxyAgent(proxy);
            config.httpsAgent = new HttpsProxyAgent(proxy);
        }
        const payload = { userId: address, campaignId, zealyUserId };
        const response = await axios.post('https://speedrun.enso.build/api/track-campaign', payload, config);
        if (response.data.message === 'Points awarded and visit recorded') {
            if (localSpinner) spinner.succeed(chalk.green(` ┊ ✓ Campaign ${campaignName} selesai`));
            // Jika spinner global, biarkan pemanggil yang succeed/fail
            return true;
        } else {
            throw new Error(response.data.message || 'Gagal menyelesaikan campaign dengan status tidak sukses');
        }
    } catch (err) {
        const errorMsg = err.response ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data || {})}` : err.message;
        if (retryCount < maxRetries - 1) {
            await sleep(5000); // Jeda sebelum retry
            return completeCampaign(address, campaignId, campaignName, zealyUserId, proxy, retryCount + 1, spinner);
        }
        // Untuk spinner lokal atau global, tampilkan pesan error
        if (spinner) {
            const originalText = spinner.text; // Simpan teks spinner jika global
            spinner.fail(chalk.red(` ┊ ✗ Gagal menyelesaikan campaign ${campaignName} (ID: ${campaignId.slice(0,6)}...): ${errorMsg.substring(0, 50)}...`));
            if (!localSpinner) spinner.text = originalText; // Kembalikan teks spinner jika global
            else if(spinner.isSpinning) spinner.stop(); // Hentikan spinner lokal
        } else {
            console.log(chalk.red(` ┊ ✗ Gagal menyelesaikan campaign ${campaignName} (ID: ${campaignId.slice(0,6)}...): ${errorMsg.substring(0, 50)}...`));
        }
        return false;
    } finally {
        if (localSpinner && spinner && spinner.isSpinning) spinner.stop();
    }
}

async function getProtocols(zealyUserId, proxy = null, retryCount = 0) {
    const maxRetries = 3;
    const limit = 10;
    let allProtocols = [];
    const totalPagesKnown = 12; // Asumsi dari script asli, bisa disesuaikan jika API berubah
    let currentPage = 1;
    const spinner = ora({ text: chalk.cyan(` ┊ → Mengambil daftar protocols (Halaman ${currentPage})${retryCount > 0 ? ` (Retry ke-${retryCount}/${maxRetries})` : ''}...`), prefixText: '', spinner: 'bouncingBar' }).start();
    
    try {
        let config = { headers: { /* Header sama */
            'accept': 'application/json, text/plain, */*',
            'accept-language': 'en-US,en;q=0.7',
            'content-type': 'application/json',
            'priority': 'u=1, i',
            'sec-ch-ua': randomUseragent.getRandom(),
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'sec-gpc': '1',
            'Referer': 'https://speedrun.enso.build/campaign',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
        }};
        if (proxy) {
            config.httpAgent = new HttpsProxyAgent(proxy);
            config.httpsAgent = new HttpsProxyAgent(proxy);
        }

        // Menggunakan totalPagesKnown jika API tidak mengembalikan total
        for (currentPage = 1; currentPage <= totalPagesKnown; currentPage++) {
            spinner.text = chalk.cyan(` ┊ → Mengambil daftar protocols (Halaman ${currentPage}/${totalPagesKnown})...`);
            const response = await axios.get(`https://speedrun.enso.build/api/get-protocols?page=${currentPage}&limit=${limit}&zealyUserId=${zealyUserId}`, config);
            const { protocols } = response.data; // Asumsi API mengembalikan 'protocols'
            if (!protocols) { // Jika halaman terakhir tidak ada data, anggap selesai
                 if (currentPage > 1 && response.status === 200) break; // Berhasil tapi tidak ada data lagi
                 throw new Error("Respons API protocol tidak valid atau halaman tidak ditemukan");
            }
            allProtocols = allProtocols.concat(protocols);
            if (protocols.length < limit) break; // Jika data < limit, kemungkinan halaman terakhir
            await sleep(2000); // Jeda antar halaman
        }
        spinner.succeed(chalk.green(` ┊ ✓ ${allProtocols.length} protocols ditemukan`));
        await sleep(100);
        return allProtocols;
    } catch (err) {
        const errorMsg = err.response ? `HTTP ${err.response.status}` : err.message;
        if (retryCount < maxRetries - 1) {
            spinner.text = chalk.cyan(` ┊ → Mengambil daftar protocols (Retry ke-${retryCount + 1}/${maxRetries})...`);
            await sleep(5000);
            return getProtocols(zealyUserId, proxy, retryCount + 1);
        }
        spinner.fail(chalk.red(` ┊ ✗ Gagal mengambil daftar protocols: ${errorMsg}`));
        await sleep(100);
        return [];
    } finally {
        if(spinner.isSpinning) spinner.stop();
    }
}

async function completeProtocol(address, protocolId, protocolName, zealyUserId, proxy = null, retryCount = 0, spinner = null) {
    const maxRetries = 3;
    const localSpinner = !spinner;
    if (localSpinner) spinner = ora({ text: chalk.cyan(` ┊ → Menyelesaikan protocol ${protocolName}...`), prefixText: '', spinner: 'bouncingBar' }).start();
    else spinner.text = chalk.cyan(` ┊ → Menyelesaikan protocol ${protocolName} (ID: ${protocolId.slice(0,6)}...)...`);

    try {
        let config = { headers: { /* Header sama */
            'accept': 'application/json, text/plain, */*',
            'accept-language': 'en-US,en;q=0.7',
            'content-type': 'application/json',
            'priority': 'u=1, i',
            'sec-ch-ua': randomUseragent.getRandom(),
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'sec-gpc': '1',
            'Referer': 'https://speedrun.enso.build/campaign',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
        }};
        if (proxy) {
            config.httpAgent = new HttpsProxyAgent(proxy);
            config.httpsAgent = new HttpsProxyAgent(proxy);
        }
        const payload = { userId: address, protocolId, zealyUserId, };
        const response = await axios.post('https://speedrun.enso.build/api/track-protocol', payload, config);
        if (response.data.message === 'Points awarded and visit recorded') {
            if (localSpinner) spinner.succeed(chalk.green(` ┊ ✓ Protocol ${protocolName} selesai`));
            return true;
        } else {
            throw new Error(response.data.message || 'Gagal menyelesaikan protocol dengan status tidak sukses');
        }
    } catch (err) {
        const errorMsg = err.response ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data || {})}` : err.message;
        if (retryCount < maxRetries - 1) {
            await sleep(5000);
            return completeProtocol(address, protocolId, protocolName, zealyUserId, proxy, retryCount + 1, spinner);
        }
        if (spinner) {
            const originalText = spinner.text;
            spinner.fail(chalk.red(` ┊ ✗ Gagal menyelesaikan protocol ${protocolName} (ID: ${protocolId.slice(0,6)}...): ${errorMsg.substring(0,50)}...`));
            if (!localSpinner) spinner.text = originalText;
            else if(spinner.isSpinning) spinner.stop();
        } else {
             console.log(chalk.red(` ┊ ✗ Gagal menyelesaikan protocol ${protocolName} (ID: ${protocolId.slice(0,6)}...): ${errorMsg.substring(0,50)}...`));
        }
        return false;
    } finally {
        if (localSpinner && spinner && spinner.isSpinning) spinner.stop();
    }
}


// --- Fungsi Inti Proses Akun ---
async function processAccounts(accounts, accountProxies, noType) {
  const DEFIDEX_LIMIT = 5;
  let successCount = 0;
  let failCount = 0;
  let totalSuccessfulDexes = 0;
  let totalFailedDexes = 0;
  let totalSuccessfulCampaigns = 0;
  let totalFailedCampaigns = 0;
  let totalSuccessfulProtocols = 0;
  let totalFailedProtocols = 0;
  let userInfoResults = [];

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const proxy = accountProxies[i];
    const shortAddress = `${account.address.slice(0, 8)}...${account.address.slice(-6)}`;

    displayHeader(`═════[ Akun ${i + 1}/${accounts.length} (${shortAddress}) @ ${getTimestamp()} ]═════`, chalk.blue);

    let ip = 'Unknown';
    try {
      ip = await getPublicIP(proxy);
    } catch (err) {
      console.log(chalk.red(` ┊ ✗ Gagal mendapatkan IP untuk akun ${shortAddress}. Melanjutkan...`));
      // Tidak menganggap ini kegagalan akun total, tapi bisa dicatat jika perlu
    }

    let accountFullySuccess = true; // Awalnya anggap sukses penuh
    let tasksAttempted = 0;
    let tasksSucceeded = 0;
    let currentStatus = 'Sukses'; // Default status

    try {
      console.log(chalk.gray(` ┊ ℹ️ Memulai tugas untuk akun: ${shortAddress} (Zealy: ${account.zealyUserId.slice(0,8)}...)`));

      // --- Proses DeFiDex ---
      console.log(chalk.magentaBright(' ┊ ┌── Proses DeFiDex ──'));
      let successfulDexesThisAccount = 0;
      let failedDexesThisAccount = 0;
      for (let j = 0; j < DEFIDEX_LIMIT; j++) {
        tasksAttempted++;
        console.log(chalk.yellow(` ┊ ├─ DeFiDex ${createProgressBar(j + 1, DEFIDEX_LIMIT)} ──`));
        const projectSlug = generateProjectSlug();
        console.log(chalk.white(` ┊ │ Project Slug: ${projectSlug}`));
        const success = await createDefiDex(projectSlug, account.address, account.zealyUserId, proxy);
        if (success) {
          successfulDexesThisAccount++;
          tasksSucceeded++;
        } else {
          failedDexesThisAccount++;
          // Jika gagal karena batas harian, jangan tandai akun gagal total, tapi hentikan DeFiDex
          // Jika gagal karena error lain, tandai akun tidak sukses penuh
          if(!(err => err && err.message && err.message.toLowerCase().includes("batas harian"))) { // Perlu cek error code dari createDefiDex jika ada
            accountFullySuccess = false;
          }
          console.log(chalk.yellow(' ┊ │ Menghentikan DeFiDex untuk akun ini.'));
          break; 
        }
        await sleep(1000 + Math.random() * 1000); // Tambah jeda random
      }
      totalSuccessfulDexes += successfulDexesThisAccount;
      totalFailedDexes += failedDexesThisAccount;
      if (failedDexesThisAccount > 0 && successfulDexesThisAccount === 0) accountFullySuccess = false;
      console.log(chalk.yellow(' ┊ └──'));
      await sleep(1000);


      // --- Proses Campaign ---
      console.log(chalk.magentaBright(' ┊ ┌── Proses Completing Campaigns ──'));
      const campaigns = await getCampaigns(account.zealyUserId, proxy);
      let successfulCampaignsThisAccount = 0;
      let failedCampaignsThisAccount = 0;
      if (campaigns.length === 0) {
        console.log(chalk.yellow(' ┊ │ Tidak ada campaign atau gagal mengambil.'));
        // Tidak selalu berarti kegagalan akun jika memang tidak ada campaign
      } else {
        const pendingCampaigns = campaigns.filter(c => !c.visited && !c.pointsAwarded);
        if (pendingCampaigns.length === 0) {
          console.log(chalk.green(' ┊ │ Semua campaign sudah selesai!'));
        } else {
          console.log(chalk.white(` ┊ │ ${pendingCampaigns.length} campaign belum dikerjakan ditemukan`));
          const campaignSpinner = ora({ text: chalk.cyan(` ┊ │ Memproses campaign: 0/${pendingCampaigns.length}...`), prefixText: '', spinner: 'bouncingBar' }).start();
          for (let j = 0; j < pendingCampaigns.length; j++) {
            tasksAttempted++;
            const campaign = pendingCampaigns[j];
            const success = await completeCampaign(account.address, campaign.id, campaign.name, account.zealyUserId, proxy, 0, campaignSpinner);
            if (success) {
                successfulCampaignsThisAccount++;
                tasksSucceeded++;
            } else {
                failedCampaignsThisAccount++;
                accountFullySuccess = false; // Kegagalan menyelesaikan campaign dianggap penting
            }
            // Jangan update spinner.text di sini karena completeCampaign sudah melakukannya jika spinner global
            await sleep(1000 + Math.random() * 1000); // Tambah jeda random
          }
          if(campaignSpinner.isSpinning) campaignSpinner.succeed(chalk.green(` ┊ ✓ ${successfulCampaignsThisAccount} dari ${pendingCampaigns.length} campaign diproses`));
        }
      }
      totalSuccessfulCampaigns += successfulCampaignsThisAccount;
      totalFailedCampaigns += failedCampaignsThisAccount;
      if (failedCampaignsThisAccount > 0 && successfulCampaignsThisAccount === 0 && campaigns.length > 0 && campaigns.filter(c => !c.visited && !c.pointsAwarded).length > 0) {
        // Hanya jika ada campaign yang pending dan semua gagal
        accountFullySuccess = false;
      }
      console.log(chalk.yellow(' ┊ └──'));
      await sleep(1000);


      // --- Proses Protocol ---
      console.log(chalk.magentaBright(' ┊ ┌── Proses Completing Protocols ──'));
      const protocols = await getProtocols(account.zealyUserId, proxy);
      let successfulProtocolsThisAccount = 0;
      let failedProtocolsThisAccount = 0;
      if (protocols.length === 0) {
        console.log(chalk.yellow(' ┊ │ Tidak ada protocol atau gagal mengambil.'));
      } else {
        const pendingProtocols = protocols.filter(p => !p.visited && !p.pointsAwarded);
        if (pendingProtocols.length === 0) {
          console.log(chalk.green(' ┊ │ Semua protocols sudah selesai!'));
        } else {
          console.log(chalk.white(` ┊ │ ${pendingProtocols.length} protocols belum dikerjakan ditemukan`));
          const protocolSpinner = ora({ text: chalk.cyan(` ┊ │ Memproses protocols: 0/${pendingProtocols.length}...`), prefixText: '', spinner: 'bouncingBar' }).start();
          for (let j = 0; j < pendingProtocols.length; j++) {
            tasksAttempted++;
            const protocol = pendingProtocols[j];
            const success = await completeProtocol(account.address, protocol.id, protocol.name, account.zealyUserId, proxy, 0, protocolSpinner);
            if (success) {
                successfulProtocolsThisAccount++;
                tasksSucceeded++;
            } else {
                failedProtocolsThisAccount++;
                accountFullySuccess = false;
            }
            await sleep(1000 + Math.random() * 1000); // Tambah jeda random
          }
          if(protocolSpinner.isSpinning) protocolSpinner.succeed(chalk.green(` ┊ ✓ ${successfulProtocolsThisAccount} dari ${pendingProtocols.length} protocols diproses`));
        }
      }
      totalSuccessfulProtocols += successfulProtocolsThisAccount;
      totalFailedProtocols += failedProtocolsThisAccount;
      if (failedProtocolsThisAccount > 0 && successfulProtocolsThisAccount === 0 && protocols.length > 0 && protocols.filter(p => !p.visited && !p.pointsAwarded).length > 0) {
         accountFullySuccess = false;
      }
      console.log(chalk.yellow(' ┊ └──'));
      await sleep(1000);


      // Menentukan status akhir akun
      if (!accountFullySuccess) {
        if (tasksAttempted > 0 && tasksSucceeded === 0) {
            currentStatus = 'Gagal Total Tugas'; // Semua tugas yang dicoba gagal
        } else {
            currentStatus = 'Parsial'; // Beberapa tugas gagal
        }
      } else if (tasksAttempted === 0) {
        currentStatus = 'Tidak Ada Tugas'; // Tidak ada yang perlu dikerjakan (misal semua sudah selesai)
      } else {
        currentStatus = 'Sukses';
      }

      const userInfo = await getUserInfo(account.zealyUserId, proxy);
      console.log(chalk.yellow(' ┊ ┌── Ringkasan User ──'));
      console.log(chalk.white(` ┊ │ Username: ${userInfo.name || 'N/A'}`));
      console.log(chalk.white(` ┊ │ Wallet Terhubung (Zealy): ${userInfo.connectedWallet || 'N/A'}`));
      console.log(chalk.white(` ┊ │ XP (Zealy): ${userInfo.xp || 0}`));
      console.log(chalk.yellow(' ┊ └──'));
      userInfoResults.push({
        name: userInfo.name || shortAddress, // Gunakan shortAddress jika nama tidak ada
        address: account.address,
        zealy_xp: userInfo.xp || 0,
        status: currentStatus,
        dex_ok: successfulDexesThisAccount,
        dex_fail: failedDexesThisAccount,
        camp_ok: successfulCampaignsThisAccount,
        camp_fail: failedCampaignsThisAccount,
        prot_ok: successfulProtocolsThisAccount,
        prot_fail: failedProtocolsThisAccount,
      });

    } catch (err) {
      console.log(chalk.red(` ┊ ✗ Error Kritis pada Akun ${shortAddress}: ${err.message}`));
      console.error(err.stack); // Penting untuk debug
      accountFullySuccess = false;
      currentStatus = 'Error Kritis';
      userInfoResults.push({
        name: shortAddress,
        address: account.address,
        zealy_xp: 'N/A',
        status: currentStatus,
        error_message: err.message.substring(0,100) // Catat pesan errornya
      });
    }

    if (accountFullySuccess && currentStatus !== 'Tidak Ada Tugas' && currentStatus !== 'Error Kritis') {
      successCount++;
    } else if (currentStatus === 'Error Kritis' || (tasksAttempted > 0 && tasksSucceeded === 0 && currentStatus !== 'Tidak Ada Tugas')) {
      failCount++; // Hanya hitung sebagai fail jika ada error kritis atau semua tugas yang dicoba gagal
    } else if (currentStatus === 'Parsial'){
      failCount++; // Anggap parsial juga sebagai fail untuk laporan utama
    }
    // Jika 'Tidak Ada Tugas', tidak dihitung sukses atau gagal, netral.
    console.log(chalk.gray(' ┊ ══════════════════════════════════════'));
    await sleep(2000 + Math.random() * 2000); // Jeda antar akun
  }

  displayHeader(`═════[ Ringkasan Total @ ${getTimestamp()} ]═════`, chalk.blue);
  console.log(chalk.gray(` ┊ ✅ ${successCount} akun sukses penuh.`));
  console.log(chalk.gray(` ┊ ❌ ${failCount} akun gagal/parsial/error.`));
  if (totalSuccessfulDexes > 0 || totalFailedDexes > 0) console.log(chalk.cyan(` ┊ DeFiDex: ${totalSuccessfulDexes} sukses, ${totalFailedDexes} gagal.`));
  if (totalSuccessfulCampaigns > 0 || totalFailedCampaigns > 0) console.log(chalk.cyan(` ┊ Campaigns: ${totalSuccessfulCampaigns} sukses, ${totalFailedCampaigns} gagal.`));
  if (totalSuccessfulProtocols > 0 || totalFailedProtocols > 0) console.log(chalk.cyan(` ┊ Protocols: ${totalSuccessfulProtocols} sukses, ${totalFailedProtocols} gagal.`));

  return { reportData: userInfoResults, successCount, failCount };
}


// --- Fungsi Utama ---
async function main() {
  console.log(chalk.blue(`\n--- [${getTimestamp()}] Memulai Eksekusi CRON Job Enso Speedrun ---`));
  displayBanner();

  const noType = true; // Untuk typeText, jika masih digunakan
  let accounts = [];
  let proxies = [];
  let accountProxies = [];

  try {
    // ---- Bagian 1: Memuat Data ----
    try {
      const accountsData = await fs.readFile('accounts.txt', 'utf8');
      const lines = accountsData.split('\n').filter(line => line.trim() !== '');
      for (let i = 0; i < lines.length; i++) {
        const [privateKey, zealyUserId] = lines[i].split(',').map(item => item ? item.trim() : '');
        if (!privateKey || !zealyUserId) {
          console.error(chalk.red(`✗ Baris ${i + 1} di accounts.txt tidak lengkap. Format: privateKey,zealyUserId`));
          throw new Error(`Baris ${i + 1} di accounts.txt tidak lengkap.`);
        }
        if (!isValidPrivateKey(privateKey)) {
          console.error(chalk.red(`✗ PK tidak valid di baris ${i + 1}: ${privateKey}`));
          throw new Error(`PK tidak valid di baris ${i + 1}.`);
        }
        if (!isValidUUID(zealyUserId)) {
          console.error(chalk.red(`✗ UUID Zealy tidak valid di baris ${i + 1}: ${zealyUserId}`));
          throw new Error(`UUID tidak valid di baris ${i + 1}.`);
        }
        const wallet = new ethers.Wallet(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`);
        accounts.push({ address: wallet.address, privateKey, zealyUserId });
      }
      if (accounts.length === 0) throw new Error('Tidak ada akun valid ditemukan di accounts.txt.');
      console.log(chalk.green(` ┊ ✓ ${accounts.length} akun berhasil dimuat.`));
    } catch (err) {
      console.error(chalk.red(`Gagal membaca/memproses accounts.txt: ${err.message}`));
      process.exit(1); // Keluar jika data akun gagal dimuat
    }

    // Tidak perlu memuat pesan.txt lagi

    try {
      const proxyData = await fs.readFile('proxy.txt', 'utf8');
      proxies = proxyData.split('\n').filter(line => line.trim() !== '' && !line.startsWith('#')); // Abaikan baris komentar
      if (proxies.length > 0) {
        console.log(chalk.green(` ┊ ✓ ${proxies.length} proxy berhasil dimuat.`));
      } else {
        console.log(chalk.yellow(' ┊ ⚠️ File proxy.txt kosong atau hanya berisi komentar. Berjalan tanpa proxy.'));
      }
    } catch (err) {
      // Hanya error jika file tidak ditemukan, bukan jika kosong
      if (err.code === 'ENOENT') {
        console.log(chalk.yellow(' ┊ ⚠️ File proxy.txt tidak ditemukan. Berjalan tanpa proxy.'));
      } else {
        console.error(chalk.red(`Gagal membaca proxy.txt: ${err.message}`));
        // Bisa pilih untuk keluar atau lanjut tanpa proxy
      }
    }
    
    accountProxies = accounts.map((_, index) => {
      return proxies.length > 0 ? proxies[index % proxies.length] : null;
    });

    // ---- Bagian 2: Menjalankan Proses & Menangkap Hasil ----
    console.log(chalk.cyan(` ┊ ⚙️ Memulai proses akun...`));
    const { reportData, successCount, failCount } = await processAccounts(accounts, accountProxies, noType);

    // ---- Bagian 3: Mengirim Laporan ----
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) { // Cek jika kredensial Telegram ada
        console.log(chalk.magenta('DEBUG: Selesai processAccounts. Memanggil sendTelegramReport...'));
        await sendTelegramReport(reportData, successCount, failCount);
        console.log(chalk.magenta('DEBUG: Selesai sendTelegramReport. Mengecek failCount...'));
    } else {
        console.log(chalk.yellow(' ┊ ⚠️ Kredensial Telegram (TOKEN/CHAT_ID) tidak diatur di environment. Laporan tidak dikirim.'));
    }


    // ---- Bagian 4: Menentukan Status Akhir & Keluar ----
    if (failCount > 0) { // Jika ada akun yang gagal/parsial/error
      console.log(chalk.yellow(`--- [${getTimestamp()}] Eksekusi CRON Job Enso Speedrun Selesai dengan ${failCount} kegagalan/parsial. ---`));
      process.exit(1); // Keluar dengan status error untuk CRON
    }

    console.log(chalk.green(`--- [${getTimestamp()}] Eksekusi CRON Job Enso Speedrun Berhasil Semua ---`));
    process.exit(0);

  } catch (err) {
    // ---- Bagian 5: Menangani Semua Error Tak Terduga di main ----
    console.error(chalk.red(`\n--- [${getTimestamp()}] !!! Eksekusi CRON Job Selesai dengan Error Kritis di Fungsi Main !!! ---`));
    console.error(chalk.red(` ┊ ✗ Error: ${err.message}`));
    console.error(err.stack); 
    process.exit(1); // Keluar dengan status error
  }
}

// Panggil fungsi utama
main();
