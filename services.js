const axios = require('axios');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
let SummarizerManager = require("node-summarizer").SummarizerManager;
const db = require('./database');
const { translateToLeet, perlin1D } = require('./utils');
const { evaluate } = require("mathjs");
const { faker } = require('@faker-js/faker');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const OWNER = config.owner;

let ConversationHistory = {};
let LastAIRequest = {
    global: 0,
    users: {}
};

async function cmd_AI(bot, username, args) {
    if (!args || args.length === 0) {
        bot.whisper(username, 'Please provide a prompt for GPT.');
        return;
    }
    const prompt = args.join(' ');
    const cacheKey = prompt.toLowerCase();

    const cached = db.aiCache.get(cacheKey);
    if (cached) {
        bot.whisper(username, cached);
        return;
    }

    const now = Date.now();
    const userCooldown = config.ai.cooldown || 10000;
    const globalCooldown = config.ai.globalCooldown || 2000;

    if (now - LastAIRequest.global < globalCooldown) {
        bot.whisper(username, 'AI is processing another request. Please wait a moment.');
        return;
    }

    if (LastAIRequest.users[username] && now - LastAIRequest.users[username] < userCooldown) {
        const remaining = Math.ceil((userCooldown - (now - LastAIRequest.users[username])) / 1000);
        bot.whisper(username, `Please wait ${remaining}s before your next AI request.`);
        return;
    }

    if (!ConversationHistory[username]) ConversationHistory[username] = [];

    let contextParts = [];
    const history = ConversationHistory[username].slice(-12);
    for (const entry of history) {
        const roleLabel = entry.role === 'user' ? 'User' : 'Assistant';
        contextParts.push(`${roleLabel}: ${entry.text}`);
    }
    contextParts.push(`User: ${prompt}`);
    contextParts.push(`Assistant:`);

    const fullPrompt = `You are a helpful Minecraft bot. Answer short and concisely.\n\n${contextParts.join('\n')}`;
    const encodedPrompt = encodeURIComponent(fullPrompt);

    LastAIRequest.global = now;
    LastAIRequest.users[username] = now;

    try {
        const res = await axios.get(`https://text.pollinations.ai/text/${encodedPrompt}`);
        const answer = String(res.data).slice(0, 300);

        db.aiCache.set(cacheKey, answer);

        ConversationHistory[username].push({ role: 'user', text: prompt });
        ConversationHistory[username].push({ role: 'bot', text: answer });
        if (ConversationHistory[username].length > 20) {
            ConversationHistory[username] = ConversationHistory[username].slice(-20);
        }

        bot.whisper(username, answer);
    } catch (err) {
        if (err.response) {
            const status = err.response.status;
            if (status === 429) bot.whisper(username, 'The AI is currently overloaded. Please try again later.');
            else bot.whisper(username, `AI Error (${status}). Please try again later.`);
        } else {
            console.error('cmd_ai error', err?.message || err);
            bot.whisper(username, 'Failed to fetch AI response.');
        }
    }
}

async function cmd_newchat(bot, username) {
    ConversationHistory[username] = [];
    bot.whisper(username, 'I have forgotten our previous conversation. Starting a new chat!');
}

async function cmd_savechat(bot, username, args) {
    if (!args || args.length === 0) {
        bot.whisper(username, 'Usage: !savechat <name>');
        return;
    }
    const chatName = args[0].replace(/[^a-z0-9_-]/gi, '_');
    const history = ConversationHistory[username] || [];
    const dirPath = path.join(__dirname, 'chats');
    const filePath = path.join(dirPath, `${username}_${chatName}.json`);

    try {
        if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath);
        fs.writeFileSync(filePath, JSON.stringify(history, null, 4), 'utf8');
        bot.whisper(username, `Chat session saved as "${chatName}".`);
    } catch (err) {
        console.error('savechat error', err);
        bot.whisper(username, 'Failed to save chat session.');
    }
}

async function cmd_loadchat(bot, username, args) {
    if (!args || args.length === 0) {
        bot.whisper(username, 'Usage: !loadchat <name>');
        return;
    }
    const chatName = args[0].replace(/[^a-z0-9_-]/gi, '_');
    const filePath = path.join(__dirname, 'chats', `${username}_${chatName}.json`);

    if (!fs.existsSync(filePath)) {
        bot.whisper(username, `Chat session "${chatName}" not found.`);
        return;
    }

    try {
        const data = fs.readFileSync(filePath, 'utf8');
        ConversationHistory[username] = JSON.parse(data);
        bot.whisper(username, `Chat session "${chatName}" loaded!`);
    } catch (err) {
        console.error('loadchat error', err);
        bot.whisper(username, 'Failed to load chat session.');
    }
}

async function cmd_listchats(bot, username) {
    const dirPath = path.join(__dirname, 'chats');
    if (!fs.existsSync(dirPath)) {
        bot.whisper(username, 'You have no saved chats.');
        return;
    }

    try {
        const files = fs.readdirSync(dirPath);
        const prefix = `${username}_`;
        const userChats = files
            .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
            .map(f => f.slice(prefix.length, -5));

        if (userChats.length === 0) bot.whisper(username, 'You have no saved chats.');
        else bot.whisper(username, 'Your saved chats: ' + userChats.join(', '));
    } catch (err) {
        console.error('listchats error', err);
        bot.whisper(username, 'Failed to list chat sessions.');
    }
}

async function cmd_weather(bot, username, args) {
    if (!args || args.length === 0) {
        bot.whisper(username, 'Usage: !weather [city]');
        return;
    }
    const city = args.join(' ');
    try {
        const geo = await axios.get(`https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1`);
        if (!geo.data.results) {
            bot.whisper(username, `City "${city}" not found.`);
            return;
        }
        const { latitude, longitude, name } = geo.data.results[0];
        const weather = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&temperature_unit=fahrenheit`);
        const temp = weather.data.current_weather.temperature;
        bot.whisper(username, `Weather in ${name}: ${temp}°F`);
    } catch (err) {
        console.error('weather error', err);
        bot.whisper(username, 'Error fetching weather.');
    }
}

async function cmd_wiki(bot, username, args) {
    const query = Array.isArray(args) ? args.join('_') : args;
    try {
        const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${query}`);
        if (!response.ok) return bot.whisper(username, "I couldn't find a Wikipedia page for that.");
        const data = await response.json();
        bot.whisper(username, data.extract);
    } catch (err) {
        bot.whisper(username, "Internal error fetching Wikipedia data.");
    }
}

async function cmd_news(bot, username) {
    try {
        const res = await axios.get(`https://api.rss2json.com/v1/api.json?rss_url=http://feeds.bbci.co.uk/news/world/rss.xml`);
        const latest = res.data.items[0];
        bot.whisper(username, `Latest: ${latest.title}`.slice(0, 250));
    } catch (err) {
        console.error('news error', err);
        bot.whisper(username, 'Failed to fetch news.');
    }
}

async function cmd_joke(bot, username) {
    try {
        const response = await fetch('https://official-joke-api.appspot.com/random_joke');
        const data = await response.json();
        bot.whisper(username, `${data.setup}`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        bot.whisper(username, `${data.punchline}`);
    } catch (error) {
        bot.whisper(username, 'Sorry, I could not fetch a joke at this time.');
    }
}

async function cmd_catfact(bot, username) {
    try {
        const response = await fetch('https://catfact.ninja/fact');
        const data = await response.json();
        bot.whisper(username, data.fact);
    } catch (error) {
        bot.whisper(username, 'Sorry, I could not fetch a cat fact at this time.');
    }
}

async function cmd_dogfact(bot, username) {
    try {
        const response = await fetch('https://dogapi.dog/api/v2/facts');
        if (!response.ok) throw new Error('Network error');
        const json = await response.json();
        const fact = json.data?.[0]?.attributes?.body || "Could not find a dog fact.";
        bot.whisper(username, fact);
    } catch (error) {
        bot.whisper(username, 'Sorry, I could not fetch a dog fact at this time.');
    }
}

async function cmd_fact(bot, username) {
    try {
        const response = await fetch('https://uselessfacts.jsph.pl/random.json?language=en');
        const data = await response.json();
        bot.whisper(username, data.text);
    } catch (error) {
        bot.whisper(username, 'Sorry, I could not fetch a fact at this time.');
    }
}

async function cmd_anime_quote(bot, username) {
    try {
        const response = await fetch('https://animechan.io/api/random');
        const data = await response.json();
        bot.whisper(username, `"${data.quote}" - ${data.character} from ${data.anime}`);
    } catch (error) {
        bot.whisper(username, 'Sorry, I could not fetch an anime quote at this time.');
    }
}

async function cmd_summarizer(bot, username, args) {
    if (!args || args.length === 0) {
        bot.whisper(username, 'Please provide text to summarize.');
        return;
    }
    const Summarizer = new SummarizerManager(args.join(' '), 3);
    let summary = Summarizer.getSummaryByFrequency(args).summary;
    bot.whisper(username, summary);
}

async function cmd_food(bot, username, args) {
    if (!args || args.length === 0) {
        bot.whisper(username, 'Usage: !food <product name>');
        return;
    }
    const query = args.join(' ');
    try {
        const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1`;
        const response = await axios.get(url);
        if (response.data.products && response.data.products.length > 0) {
            const product = response.data.products[0];
            const name = product.product_name || 'Unknown Product';
            const brand = product.brands || 'Unknown Brand';
            const grade = product.nutrition_grades ? product.nutrition_grades.toUpperCase() : '?';
            bot.whisper(username, `Found: ${name} (${brand}) - Grade: ${grade}`);
        } else {
            bot.whisper(username, `No food found for "${query}".`);
        }
    } catch (err) {
        bot.whisper(username, 'Error fetching food data.');
    }
}

async function cmd_math(bot, username, args) {
    const expression = args.join(' ');
    try {
        const result = evaluate(expression);
        bot.whisper(username, `The result is: ${result}`);
    } catch (err) {
        bot.whisper(username, 'Error: Invalid mathematical expression.');
    }
}

async function cmd_randomsentence(bot, username) {
    bot.whisper(username, faker.lorem.sentence());
}

async function cmd_randomword(bot, username) {
    bot.whisper(username, faker.hacker.noun());
}

async function cmd_hello(bot, username) {
    bot.whisper(username, `Hey there, ${username}!`);
}

async function cmd_info(bot, username) {
    bot.whisper(username, 'I am a modular Node.js Mineflayer bot.');
}

async function cmd_randomnumber(bot, username) {
    const number = Math.floor(Math.random() * 10) + 1;
    bot.whisper(username, `Your random number is: ${number}`);
}

async function cmd_trng(bot, username) {
    const time = Date.now();
    const noise = perlin1D(time / 1000);
    const normalizedValue = Math.floor(((noise + 1) / 2) * 100);
    bot.whisper(username, `[TRNG] Result: ${normalizedValue}`);
}

async function cmd_leetspeak(bot, username, args) {
    if (!args || args.length === 0) {
        bot.whisper(username, 'Please provide text.');
        return;
    }
    bot.whisper(username, translateToLeet(args.join(' ')));
}

async function cmd_inventory(bot, username) {
    const items = bot.inventory.items();
    if (items.length === 0) {
        bot.whisper(username, 'My inventory is empty.');
        return;
    }
    const output = items.map(item => `${item.name} x${item.count}`).join(', ');
    bot.whisper(username, `Inventory: ${output}`);
}

async function cmd_stats(bot, username) {
    const health = Math.round(bot.health);
    const food = Math.round(bot.food);
    const xp = bot.experience.points;
    bot.whisper(username, `Stats - Health: ${health}/20, Food: ${food}/20, XP: ${xp}`);
}

async function cmd_coords(bot, username) {
    if (username !== OWNER) return;
    const { x, y, z } = bot.entity.position;
    bot.whisper(username, `Current coords: ${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}`);
}

async function cmd_hand(bot, username) {
    const item = bot.heldItem;
    if (!item) bot.whisper(username, 'I am not holding anything.');
    else bot.whisper(username, `I am holding ${item.name}.`);
}

async function cmd_near(bot, username) {
    const nearby = Object.values(bot.entities)
        .filter(e => e !== bot.entity && bot.entity.position.distanceTo(e.position) < 16)
        .map(e => (e.username || e.displayName || e.name || 'Unknown entity'));
    if (nearby.length === 0) bot.whisper(username, 'No one nearby.');
    else bot.whisper(username, `Nearby: ${nearby.join(', ')}`);
}

async function cmd_players(bot, username) {
    const playerNames = Object.keys(bot.players);
    bot.whisper(username, `Online players: ${playerNames.join(', ')}`);
}

async function cmd_broadcast(bot, username, args) {
    if (!args || args.length === 0) return;
    bot.chat(`📢 BROADCAST: ${args.join(' ').toUpperCase()}`);
}

async function cmd_status(bot, username) {
    let status = 'Idle';
    if (bot.pathfinder.goal) status = 'Moving';
    if (bot.pvp.target) status = 'In combat';
    const health = Math.round(bot.health);
    const food = Math.round(bot.food);
    bot.whisper(username, `🤖 Status: ${status} | ❤️ Health: ${health}/20 | 🍖 Food: ${food}/20`);
}

async function cmd_coinflip(bot, username) {
    bot.whisper(username, `🪙 ${Math.random() < 0.5 ? 'Heads' : 'Tails'}!`);
}

async function cmd_roll(bot, username, args) {
    let count = 1;
    let sides = 6;
    if (args && args[0]) {
        const match = args[0].toLowerCase().match(/^(\d*)d(\d+)$/);
        if (match) {
            count = parseInt(match[1]) || 1;
            sides = parseInt(match[2]);
        } else {
            sides = parseInt(args[0]) || 6;
        }
    }
    if (sides < 1 || count < 1 || count > 100) {
        bot.whisper(username, 'Usage: !roll [sides] or !roll <count>d<sides>');
        return;
    }
    const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
    const total = rolls.reduce((a, b) => a + b, 0);
    if (count === 1) bot.whisper(username, `🎲 You rolled a ${total} (d${sides}).`);
    else bot.whisper(username, `🎲 ${rolls.join(' + ')} = ${total} (${count}d${sides}).`);
}

const EIGHT_BALL_ANSWERS = [
    'It is certain.', 'Without a doubt.', 'Yes, definitely.', 'You may rely on it.',
    'Most likely.', 'Outlook good.', 'Signs point to yes.', 'Reply hazy, try again.',
    'Ask again later.', 'Cannot predict now.', "Don't count on it.", 'My reply is no.',
    'Very doubtful.', 'Outlook not so good.'
];

async function cmd_8ball(bot, username, args) {
    if (!args || args.length === 0) {
        bot.whisper(username, 'Usage: !8ball <question>');
        return;
    }
    const answer = EIGHT_BALL_ANSWERS[Math.floor(Math.random() * EIGHT_BALL_ANSWERS.length)];
    bot.whisper(username, `🎱 ${answer}`);
}

async function cmd_time(bot, username) {
    const t = bot.time?.timeOfDay;
    if (typeof t !== 'number') {
        bot.whisper(username, "I can't tell the time right now.");
        return;
    }
    const isDay = t >= 0 && t < 12000;
    const hours = Math.floor(((t / 1000 + 6) % 24));
    const minutes = Math.floor((t % 1000) / 1000 * 60);
    const clock = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    bot.whisper(username, `🕒 In-game time: ${clock} (${isDay ? '☀️ Day' : '🌙 Night'})`);
}

async function cmd_uptime(bot, username) {
    const total = Math.floor(process.uptime());
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    bot.whisper(username, `⏱️ Uptime: ${h}h ${m}m ${s}s`);
}

async function cmd_exchange(bot, username) {
    const trades = config.exchange.trades;
    bot.whisper(username, '--- 🔄 Current Trade Rates ---');
    for (const [item, data] of Object.entries(trades)) {
        bot.whisper(username, `${item} -> ${data.count}x ${data.reward}`);
    }
}

module.exports = {
    ai: { chat: cmd_AI, newChat: cmd_newchat, saveChat: cmd_savechat, loadChat: cmd_loadchat, listChats: cmd_listchats },
    weather: cmd_weather,
    wiki: cmd_wiki,
    news: cmd_news,
    joke: cmd_joke,
    catfact: cmd_catfact,
    dogfact: cmd_dogfact,
    fact: cmd_fact,
    animeQuote: cmd_anime_quote,
    summarizer: cmd_summarizer,
    food: cmd_food,
    math: cmd_math,
    randomSentence: cmd_randomsentence,
    randomWord: cmd_randomword,
    hello: cmd_hello,
    info: cmd_info,
    randomNumber: cmd_randomnumber,
    trng: cmd_trng,
    leet: cmd_leetspeak,
    inventory: cmd_inventory,
    stats: cmd_stats,
    coords: cmd_coords,
    hand: cmd_hand,
    near: cmd_near,
    players: cmd_players,
    broadcast: cmd_broadcast,
    status: cmd_status,
    exchange: cmd_exchange,
    coinflip: cmd_coinflip,
    roll: cmd_roll,
    eightball: cmd_8ball,
    time: cmd_time,
    uptime: cmd_uptime
};
