import fs from 'fs/promises';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { ethers } from 'ethers';
import randomUseragent from 'random-useragent';
import ora from 'ora';
import chalk from 'chalk';
import moment from 'moment-timezone';
import figlet from 'figlet';

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
  console.log(chalk.green(' '.repeat((width - 28) / 2) + 'ENSO AUTO BOT (CRON MODE) !!'));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function typeText(text, color, noType = true) { // Default ke true
  const maxLength = 80;
  const displayText = text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
  if (noType) {
    console.log(color(` ┊ │ ${displayText}`));
    return;
  }
  // Kode ini tidak akan berjalan jika noType = true
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

// --- Fungsi API & Interaksi Enso ---

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
    throw err;
  }
}

async function getNonce(proxy = null, retryCount = 0) {
  const maxRetries = 5;
  const spinner = ora({ text: chalk.cyan(` ┊ → Mengambil nonce${retryCount > 0 ? ` (Retry ke-${retryCount}/${maxRetries})` : ''}...`), prefixText: '', spinner: 'bouncingBar' }).start();
  try {
    let config = { headers: { 'Content-Type': 'application/json' } };
    if (proxy) {
      config.httpAgent = new HttpsProxyAgent(proxy);
      config.httpsAgent = new HttpsProxyAgent(proxy);
    }
    const response = await axios.get('https://enso.brianknows.org/api/auth/nonce', config);
    spinner.succeed(chalk.green(' ┊ ✓ Nonce diterima'));
    await sleep(100);
    return response.data;
  } catch (err) {
    if (retryCount < maxRetries - 1) {
      spinner.text = chalk.cyan(` ┊ → Mengambil nonce (Retry ke-${retryCount + 1}/${maxRetries})...`);
      await sleep(5000);
      return getNonce(proxy, retryCount + 1);
    }
    spinner.fail(chalk.red(` ┊ ✗ Gagal mendapatkan nonce: ${err.message}`));
    throw err;
  }
}

async function signMessage(privateKey, nonce, address) {
  const spinner = ora({ text: chalk.cyan(' ┊ → Menandatangani pesan...'), prefixText: '', spinner: 'bouncingBar' }).start();
  try {
    const wallet = new ethers.Wallet(privateKey);
    const domain = 'enso.brianknows.org';
    const issuedAt = moment().toISOString();
    const message = [
      `${domain} wants you to sign in with your Ethereum account:`,
      address,
      '',
      'By signing this message, you confirm you have read and accepted the following Terms and Conditions: https://terms.enso.build/',
      '',
      `URI: https://enso.brianknows.org`,
      `Version: 1`,
      `Chain ID: 56`,
      `Nonce: ${nonce}`,
      `Issued At: ${issuedAt}`,
    ].join('\n');

    const signature = await wallet.signMessage(message);
    const messageObj = {
      domain,
      address,
      statement: 'By signing this message, you confirm you have read and accepted the following Terms and Conditions: https://terms.enso.build/',
      uri: 'https://enso.brianknows.org',
      version: '1',
      nonce,
      issuedAt,
      chainId: 56,
    };
    spinner.succeed(chalk.green(' ┊ ✓ Pesan ditandatangani'));
    await sleep(100);
    return { message: messageObj, signature };
  } catch (err) {
    spinner.fail(chalk.red(` ┊ ✗ Gagal menandatangani: ${err.message}`));
    throw err;
  }
}

async function verify(message, signature, address, proxy = null, retryCount = 0) {
  const maxRetries = 5;
  const spinner = ora({ text: chalk.cyan(` ┊ → Memverifikasi akun${retryCount > 0 ? ` (Retry ke-${retryCount}/${maxRetries})` : ''}...`), prefixText: '', spinner: 'bouncingBar' }).start();
  try {
    let config = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': '*/*',
        'User-Agent': randomUseragent.getRandom(),
        'Origin': 'https://enso.brianknows.org',
        'Referer': `https://enso.brianknows.org/search?userId=${address}`,
      },
    };
    if (proxy) {
      config.httpAgent = new HttpsProxyAgent(proxy);
      config.httpsAgent = new HttpsProxyAgent(proxy);
    }
    const response = await axios.post('https://enso.brianknows.org/api/auth/verify', { message, signature }, config);
    const cookies = response.headers['set-cookie'] || [];
    const tokenMatch = cookies.find(cookie => cookie.includes('brian-token='));
    const token = tokenMatch ? tokenMatch.split('brian-token=')[1].split(';')[0] : null;
    if (!token) throw new Error('brian-token tidak ditemukan');
    spinner.succeed(chalk.green(` ┊ ✓ Verifikasi berhasil: brian-token=${token.slice(0, 10)}...; address=${address.slice(0, 8)}...`));
    await sleep(100);
    return { token, address, cookies };
  } catch (err) {
    if (retryCount < maxRetries - 1) {
      spinner.text = chalk.cyan(` ┊ → Memverifikasi akun (Retry ke-${retryCount + 1}/${maxRetries})...`);
      await sleep(5000);
      return verify(message, signature, address, proxy, retryCount + 1);
    }
    spinner.fail(chalk.red(` ┊ ✗ Gagal verifikasi: ${err.message}`));
    throw err;
  }
}

async function getAccountInfo(token, address, proxy = null, retryCount = 0) {
  const maxRetries = 5;
  const spinner = ora({ text: chalk.cyan(` ┊ → Mengambil info akun${retryCount > 0 ? ` (Retry ke-${retryCount}/${maxRetries})` : ''}...`), prefixText: '', spinner: 'bouncingBar' }).start();
  try {
    const cookie = `brian-address=${address}; brian-token=${token}; ph_phc_NfMuib33NsuSeHbpu42Ng91vE5X6J1amefUiuVgwx5y_posthog={"distinct_id":"0196a6af-e55f-79aa-9eda-0bc979d7345e","$sesid":[1746600342091,"0196a97c-daff-7ede-b8ef-c6f03e5cb2e4",1746600254207],"$initial_person_info":{"r":"https://speedrun.enso.build/","u":"https://enso.brianknows.org/search?userId=${address}"}}`;
    let config = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': '*/*',
        'User-Agent': randomUseragent.getRandom(),
        'Cookie': cookie,
        'Origin': 'https://enso.brianknows.org',
        'Referer': `https://enso.brianknows.org/search?userId=${address}`,
      },
    };
    if (proxy) {
      config.httpAgent = new HttpsProxyAgent(proxy);
      config.httpsAgent = new HttpsProxyAgent(proxy);
    }
    const response = await axios.get('https://enso.brianknows.org/api/auth/me', config);
    spinner.succeed(chalk.green(` ┊ ✓ Login: ${response.data.account.address.slice(0, 8)}...${response.data.account.address.slice(-6)}`));
    await sleep(100);
    return response.data;
  } catch (err) {
    if (retryCount < maxRetries - 1) {
      spinner.text = chalk.cyan(` ┊ → Mengambil info akun (Retry ke-${retryCount + 1}/${maxRetries})...`);
      await sleep(5000);
      return getAccountInfo(token, address, proxy, retryCount + 1);
    }
    spinner.fail(chalk.red(` ┊ ✗ Gagal mendapatkan info akun: ${err.message}`));
    throw err;
  }
}

async function getUserInfo(zealyUserId, proxy = null, retryCount = 0) {
    const maxRetries = 3;
    const spinner = ora({ text: chalk.cyan(` ┊ → Mengambil info user (Zealy ID: ${zealyUserId.slice(0, 8)}...)${retryCount > 0 ? ` (Retry ke-${retryCount}/${maxRetries})` : ''}...`), prefixText: '', spinner: 'bouncingBar' }).start();
    try {
        let config = {
            headers: {
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
            },
        };
        if (proxy) {
            config.httpAgent = new HttpsProxyAgent(proxy);
            config.httpsAgent = new HttpsProxyAgent(proxy);
        }
        const response = await axios.get(`https://speedrun.enso.build/api/zealy/user/${zealyUserId}`, config);
        spinner.succeed(chalk.green(` ┊ ✓ Info user diterima: ${response.data.name}`));
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
            await sleep(5000);
            return getUserInfo(zealyUserId, proxy, retryCount + 1);
        }
        spinner.fail(chalk.red(` ┊ ✗ Gagal mengambil info user: ${errorMsg}`));
        return { // Kembalikan default agar tidak crash
            name: 'Unknown',
            connectedWallet: 'Unknown',
            xp: 0,
        };
    }
}

async function performChat(token, query, address, messages, proxy = null, retryCount = 0) {
    const maxRetries = 5;
    const spinner = ora({ text: chalk.cyan(` ┊ → Mengirim chat...`), prefixText: '', spinner: 'bouncingBar' }).start();
    try {
        const cookie = `brian-address=${address}; brian-token=${token}; ph_phc_NfMuib33NsuSeHbpu42Ng91vE5X6J1amefUiuVgwx5y_posthog={"distinct_id":"0196a6af-e55f-79aa-9eda-0bc979d7345e","$sesid":[1746600342091,"0196a97c-daff-7ede-b8ef-c6f03e5cb2e4",1746600254207],"$initial_person_info":{"r":"https://speedrun.enso.build/","u":"https://enso.brianknows.org/search?userId=${address}"}}`;
        const payload = { query, kbId: 'b4393b93-e603-426d-8b9f-0af145498c92' };
        let config = {
            headers: {
                'Content-Type': 'application/json',
                'Accept': '*/*',
                'User-Agent': randomUseragent.getRandom(),
                'Cookie': cookie,
                'Origin': 'https://enso.brianknows.org',
                'Referer': `https://enso.brianknows.org/search?userId=${address}`,
            },
        };
        if (proxy) {
            config.httpAgent = new HttpsProxyAgent(proxy);
            config.httpsAgent = new HttpsProxyAgent(proxy);
        }
        const response = await axios.post('https://enso.brianknows.org/api/search', payload, config);
        spinner.succeed(chalk.green(' ┊ ✓ Chat dikirim'));
        await sleep(100);
        return response.data.answer;
    } catch (err) {
        const errorMsg = err.response ? `HTTP ${err.response.status}` : err.message;
        if (retryCount < maxRetries - 1) {
            spinner.stop();
            console.log(chalk.cyan(` ┊ → Mengirim chat (Retry ke-${retryCount + 1}/${maxRetries})...`));
            await sleep(500);
            return performChat(token, query, address, messages, proxy, retryCount + 1);
        }
        spinner.stop();
        if (err.response && err.response.data) {
            console.log(chalk.gray(` ┊ ℹ️ Detail error server: ${JSON.stringify(err.response.data)}`));
        }
        const newQuery = messages[Math.floor(Math.random() * messages.length)];
        console.log(chalk.yellow(` ┊ ⚠️ Semua retry gagal Mencoba query baru: ${newQuery}`));
        await sleep(5000);
        return performChat(token, newQuery, address, messages, proxy, 0); // Coba lagi dengan query baru
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
    const maxRetries = 3;
    const spinner = ora({ text: chalk.cyan(` ┊ → Membuat DeFiDex: ${projectSlug}${retryCount > 0 ? ` (Retry ke-${retryCount}/${maxRetries})` : ''}...`), prefixText: '', spinner: 'bouncingBar' }).start();
    try {
        let config = {
            headers: {
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
        } else if (response.data.code === 3) {
            spinner.stop();
            console.log(chalk.yellow(` ┊ ⚠️ Batas harian DeFiDex tercapai: ${response.data.message}`));
            await sleep(100);
            return false;
        } else {
            throw new Error(response.data.message || 'Gagal membuat DeFiDex');
        }
    } catch (err) {
        const errorMsg = err.response ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data || {})}` : err.message;
        if (err.response && err.response.data && err.response.data.code === 3) {
            spinner.stop();
            console.log(chalk.yellow(` ┊ ⚠️ Batas harian DeFiDex tercapai: ${err.response.data.message}`));
            await sleep(100);
            return false;
        }
        if (retryCount < maxRetries - 1) {
            spinner.text = chalk.cyan(` ┊ → Membuat DeFiDex: ${projectSlug} (Retry ke-${retryCount + 1}/${maxRetries})...`);
            await sleep(5000);
            return createDefiDex(projectSlug, address, zealyUserId, proxy, retryCount + 1);
        }
        if (err.response && err.response.data) {
            console.log(chalk.gray(` ┊ ℹ️ Detail error server: ${JSON.stringify(err.response.data)}`));
        }
        spinner.fail(chalk.red(` ┊ ✗ Gagal membuat DeFiDex: ${errorMsg}`));
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
        let config = {
            headers: {
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
            },
        };
        if (proxy) {
            config.httpAgent = new HttpsProxyAgent(proxy);
            config.httpsAgent = new HttpsProxyAgent(proxy);
        }

        while (true) {
            const response = await axios.get(`https://speedrun.enso.build/api/get-campaigns?page=${page}&limit=${limit}&zealyUserId=${zealyUserId}`, config);
            const { campaigns, total } = response.data;
            if (!campaigns || !total) throw new Error("Respons API campaign tidak valid");
            allCampaigns = allCampaigns.concat(campaigns);
            spinner.text = chalk.cyan(` ┊ → Mengambil daftar campaign (Halaman ${page}/${Math.ceil(total / limit)})...`);
            if (page * limit >= total) break;
            page++;
            await sleep(2000);
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
        return [];
    } finally {
        spinner.stop();
    }
}

async function completeCampaign(address, campaignId, campaignName, zealyUserId, proxy = null, retryCount = 0, spinner = null) {
    const maxRetries = 3;
    try {
        let config = {
            headers: {
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
            },
        };
        if (proxy) {
            config.httpAgent = new HttpsProxyAgent(proxy);
            config.httpsAgent = new HttpsProxyAgent(proxy);
        }
        const payload = {
            userId: address,
            campaignId,
            zealyUserId,
        };
        const response = await axios.post('https://speedrun.enso.build/api/track-campaign', payload, config);
        if (response.data.message === 'Points awarded and visit recorded') {
            return true;
        } else {
            throw new Error(response.data.message || 'Gagal menyelesaikan campaign');
        }
    } catch (err) {
        const errorMsg = err.response ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data || {})}` : err.message;
        if (retryCount < maxRetries - 1) {
            await sleep(5000);
            return completeCampaign(address, campaignId, campaignName, zealyUserId, proxy, retryCount + 1, spinner);
        }
        if (spinner) {
            spinner.stop();
            console.log(chalk.red(` ┊ ✗ Gagal menyelesaikan campaign ${campaignName} (ID: ${campaignId}): ${errorMsg}`));
            spinner.start();
        }
        return false;
    }
}

async function getProtocols(zealyUserId, proxy = null, retryCount = 0) {
    const maxRetries = 3;
    const limit = 10;
    let allProtocols = [];
    const totalPages = 12; // Asumsi ada 12 halaman, bisa disesuaikan jika perlu
    const spinner = ora({ text: chalk.cyan(` ┊ → Mengambil daftar protocols (Halaman 1/${totalPages})...`), prefixText: '', spinner: 'bouncingBar' }).start();
    try {
        let config = {
            headers: {
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
            },
        };
        if (proxy) {
            config.httpAgent = new HttpsProxyAgent(proxy);
            config.httpsAgent = new HttpsProxyAgent(proxy);
        }

        for (let page = 1; page <= totalPages; page++) {
            const response = await axios.get(`https://speedrun.enso.build/api/get-protocols?page=${page}&limit=${limit}&zealyUserId=${zealyUserId}`, config);
            const { protocols } = response.data;
            if (!protocols) throw new Error("Respons API protocol tidak valid");
            allProtocols = allProtocols.concat(protocols);
            spinner.text = chalk.cyan(` ┊ → Mengambil daftar protocols (Halaman ${page}/${totalPages})...`);
            await sleep(2000);
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
        spinner.stop();
    }
}

async function completeProtocol(address, protocolId, protocolName, zealyUserId, proxy = null, retryCount = 0, spinner = null) {
    const maxRetries = 3;
    try {
        let config = {
            headers: {
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
            },
        };
        if (proxy) {
            config.httpAgent = new HttpsProxyAgent(proxy);
            config.httpsAgent = new HttpsProxyAgent(proxy);
        }
        const payload = {
            userId: address,
            protocolId,
            zealyUserId,
        };
        const response = await axios.post('https://speedrun.enso.build/api/track-protocol', payload, config);
        if (response.data.message === 'Points awarded and visit recorded') {
            return true;
        } else {
            throw new Error(response.data.message || 'Gagal menyelesaikan protocol');
        }
    } catch (err) {
        const errorMsg = err.response ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data || {})}` : err.message;
        if (retryCount < maxRetries - 1) {
            await sleep(5000);
            return completeProtocol(address, protocolId, protocolName, zealyUserId, proxy, retryCount + 1, spinner);
        }
        if (spinner) {
            spinner.stop();
            console.log(chalk.red(` ┊ ✗ Gagal menyelesaikan protocol ${protocolName} (ID: ${protocolId}): ${errorMsg}`));
            spinner.start();
        }
        return false;
    }
}


// --- Fungsi Proses Akun (Dengan Perbaikan failCount) ---

async function processAccounts(accounts, messages, accountProxies, noType) {
  const INTERACTIONS = 5;
  const DEFIDEX_LIMIT = 5;
  let successCount = 0;
  let failCount = 0;
  let totalFailedChats = 0; // Ganti nama agar lebih jelas
  let totalSuccessfulDexes = 0;
  let totalFailedDexes = 0;
  let totalSuccessfulCampaigns = 0;
  let totalFailedCampaigns = 0;
  let totalSuccessfulProtocols = 0;
  let totalFailedProtocols = 0;

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const proxy = accountProxies[i];
    const shortAddress = `${account.address.slice(0, 8)}...${account.address.slice(-6)}`;

    displayHeader(`═════[ Akun ${i + 1}/${accounts.length} @ ${getTimestamp()} ]═════`, chalk.blue);

    let ip = 'Unknown';
    try {
        ip = await getPublicIP(proxy);
    } catch (err) {
        console.log(chalk.red(` ┊ ✗ Gagal mendapatkan IP untuk akun ${shortAddress}. Melanjutkan...`));
    }


    let accountSuccess = true;
    let partialFailure = false;

    try {
      const nonce = await getNonce(proxy);
      const { message, signature } = await signMessage(account.privateKey, nonce, account.address);
      const { token } = await verify(message, signature, account.address, proxy);
      await getAccountInfo(token, account.address, proxy); // Tidak perlu simpan info jika tidak dipakai

      // --- Proses Chat ---
      console.log(chalk.magentaBright(' ┊ ┌── Proses Chat ──'));
      let failedChats = 0;
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
      totalFailedChats += failedChats;
      console.log(chalk.yellow(' ┊ └──'));

      // --- Proses DeFiDex ---
      console.log(chalk.magentaBright(' ┊ ┌── Proses DeFiDex ──'));
      let successfulDexes = 0;
      let failedDexes = 0;
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
          if (!success) { // Jika gagal (termasuk batas harian), hentikan loop
              console.log(chalk.yellow(' ┊ │ Menghentikan DeFiDex karena gagal atau batas harian.'));
              break;
          }
        }
        await sleep(1000);
      }
      totalSuccessfulDexes += successfulDexes;
      totalFailedDexes += failedDexes;
      console.log(chalk.yellow(' ┊ └──'));

      // --- Proses Campaign ---
      console.log(chalk.magentaBright(' ┊ ┌── Proses Completing Campaigns ──'));
      const campaigns = await getCampaigns(account.zealyUserId, proxy);
      if (campaigns.length === 0) {
        console.log(chalk.yellow(' ┊ │ Tidak ada campaign atau gagal mengambil.'));
        partialFailure = true; // Tandai sebagai partial failure jika tidak bisa ambil
      } else {
        const pendingCampaigns = campaigns.filter(c => !c.visited && !c.pointsAwarded);
        if (pendingCampaigns.length === 0) {
          console.log(chalk.green(' ┊ │ Semua campaign sudah selesai!'));
        } else {
          console.log(chalk.white(` ┊ │ ${pendingCampaigns.length} campaign belum dikerjakan ditemukan`));
          const spinner = ora({ text: chalk.cyan(` ┊ │ Memproses campaign: 0/${pendingCampaigns.length}...`), prefixText: '', spinner: 'bouncingBar' }).start();
          let successfulCampaigns = 0;
          for (let j = 0; j < pendingCampaigns.length; j++) {
            const campaign = pendingCampaigns[j];
            const success = await completeCampaign(account.address, campaign.id, campaign.name, account.zealyUserId, proxy, 0, spinner);
            if (success) successfulCampaigns++; else { totalFailedCampaigns++; partialFailure = true; }
            spinner.text = chalk.cyan(` ┊ │ Memproses campaign: ${j + 1}/${pendingCampaigns.length}...`);
            await sleep(1000);
          }
          spinner.succeed(chalk.green(` ┊ ✓ ${successfulCampaigns} dari ${pendingCampaigns.length} campaign selesai`));
          totalSuccessfulCampaigns += successfulCampaigns;
        }
      }
      console.log(chalk.yellow(' ┊ └──'));


      // --- Proses Protocol ---
      console.log(chalk.magentaBright(' ┊ ┌── Proses Completing Protocols ──'));
      const protocols = await getProtocols(account.zealyUserId, proxy);
      if (protocols.length === 0) {
          console.log(chalk.yellow(' ┊ │ Tidak ada protocol atau gagal mengambil.'));
          partialFailure = true;
      } else {
          const pendingProtocols = protocols.filter(p => !p.visited && !p.pointsAwarded);
          if (pendingProtocols.length === 0) {
              console.log(chalk.green(' ┊ │ Semua protocols sudah selesai!'));
          } else {
              console.log(chalk.white(` ┊ │ ${pendingProtocols.length} protocols belum dikerjakan ditemukan`));
              const spinner = ora({ text: chalk.cyan(` ┊ │ Memproses protocols: 0/${pendingProtocols.length}...`), prefixText: '', spinner: 'bouncingBar' }).start();
              let successfulProtocols = 0;
              for (let j = 0; j < pendingProtocols.length; j++) {
                  const protocol = pendingProtocols[j];
                  const success = await completeProtocol(account.address, protocol.id, protocol.name, account.zealyUserId, proxy, 0, spinner);
                  if (success) successfulProtocols++; else { totalFailedProtocols++; partialFailure = true; }
                  spinner.text = chalk.cyan(` ┊ │ Memproses protocols: ${j + 1}/${pendingProtocols.length}...`);
                  await sleep(1000);
              }
              spinner.succeed(chalk.green(` ┊ ✓ ${successfulProtocols} dari ${pendingProtocols.length} protocols selesai`));
              totalSuccessfulProtocols += successfulProtocols;
          }
      }
      console.log(chalk.yellow(' ┊ └──'));


      // --- Info User Akhir ---
      const userInfo = await getUserInfo(account.zealyUserId, proxy);
      console.log(chalk.yellow(' ┊ ┌── Ringkasan User ──'));
      console.log(chalk.white(` ┊ │ Username: ${userInfo.name}`));
      console.log(chalk.white(` ┊ │ User Address: ${userInfo.connectedWallet}`));
      console.log(chalk.white(` ┊ │ Total XP: ${userInfo.xp}`));
      console.log(chalk.yellow(' ┊ └──'));

    } catch (err) {
      console.log(chalk.red(` ┊ ✗ Error Utama pada Akun ${shortAddress}: ${err.message}`));
      console.error(err.stack); // Cetak stack untuk debug
      accountSuccess = false;
    }

    // Perhitungan Sukses/Gagal (Sudah diperbaiki)
    if (accountSuccess && !partialFailure) {
      successCount++;
    } else {
      failCount++;
    }
    console.log(chalk.gray(' ┊ ══════════════════════════════════════'));
  }

  displayHeader(`═════[ Selesai @ ${getTimestamp()} ]═════`, chalk.blue);
  console.log(chalk.gray(` ┊ ✅ ${successCount} akun sukses penuh, ❌ ${failCount} akun gagal/parsial`));
  if (totalFailedChats > 0) console.log(chalk.yellow(` ┊ ⚠️ ${totalFailedChats} chat gagal (total)`));
  if (totalFailedDexes > 0) console.log(chalk.yellow(` ┊ ⚠️ ${totalFailedDexes} DeFiDex gagal (total)`));
  if (totalFailedCampaigns > 0) console.log(chalk.yellow(` ┊ ⚠️ ${totalFailedCampaigns} campaign gagal (total)`));
  if (totalFailedProtocols > 0) console.log(chalk.yellow(` ┊ ⚠️ ${totalFailedProtocols} protocols gagal (total)`));

  // Jika ada kegagalan sama sekali, lempar error agar 'main' tahu
  if (failCount > 0) {
      throw new Error(`${failCount} akun mengalami kegagalan atau kegagalan parsial.`);
  }
}

// --- Fungsi Main (Cron-Friendly) ---

async function main() {
  console.log(chalk.blue(`\n--- [${getTimestamp()}] Memulai Eksekusi CRON Job Enso ---`));
  displayBanner();

  const noType = true;
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
        const [privateKey, zealyUserId] = lines[i].split(',').map(item => item ? item.trim() : '');
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
    process.exit(0);

  } catch (err) {
    // Tangkap SEMUA error yang tidak tertangani
    console.error(chalk.red(`\n--- [${getTimestamp()}] !!! Eksekusi CRON Job Gagal Total !!! ---`));
    console.error(chalk.red(` ┊ ✗ Error: ${err.message}`));
    console.error(err.stack);
    process.exit(1);
  }
}

// --- Panggil Fungsi Main ---
main();
