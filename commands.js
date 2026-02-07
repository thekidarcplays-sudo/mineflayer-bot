const { faker } = require('@faker-js/faker');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
let SummarizerManager = require("node-summarizer").SummarizerManager;
const Filter = require('bad-words');
const filter = new Filter();
const fetch = require('node-fetch');
const { evaluate } = require("mathjs");

console.log('Loading Mineflayer Bot...');

const { goals, Movements } = require('mineflayer-pathfinder');
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

const CURSES_FILE = path.join(__dirname, config.files.curses);
const GPT_CACHE_FILE = path.join(__dirname, config.files.gptCache);
const WINS_FILE = path.join(__dirname, config.files.wins);
const MAIL_FILE = path.join(__dirname, config.files.mail);
const BOOKMARKS_FILE = path.join(__dirname, 'bookmarks.json');
const DEATHS_FILE = path.join(__dirname, config.files.deaths);
const HOMES_FILE = path.join(__dirname, config.files.homes);
const TRADES_FILE = path.join(__dirname, config.files.trades);

const OWNER = config.owner;


const leetMap = {
  'a': '4', 'b': '8', 'e': '3',
  'g': '6', 'i': '1', 'l': '1',
  'o': '0',
  's': '5', 't': '7',
  'z': '2'
};

function translateToLeet(text) {
  return text
    .toLowerCase()
    .split('')
    .map(char => leetMap[char] || char)
    .join('');
}

let AICache = {};
if (fs.existsSync(GPT_CACHE_FILE)) {
  try {
    AICache = JSON.parse(fs.readFileSync(GPT_CACHE_FILE, 'utf8') || '{}');
  } catch (err) {
    console.error('Failed to load GPT cache', err);
  }
}

// Store conversation history per user
// { username: [ { role: 'user'|'bot', text: '...' } ] }
// { username: [ { role: 'user'|'bot', text: '...' } ] }
let ConversationHistory = {};
let LastAIRequest = {
  global: 0,
  users: {}
};

let winsData = {};
if (fs.existsSync(WINS_FILE)) {
  try {
    winsData = JSON.parse(fs.readFileSync(WINS_FILE, 'utf8') || '{}');
  } catch (err) {
    console.error('Failed to load wins data', err);
  }
}

// Mail system data
let mailData = {};
if (fs.existsSync(MAIL_FILE)) {
  try {
    mailData = JSON.parse(fs.readFileSync(MAIL_FILE, 'utf8') || '{}');
  } catch (err) {
    console.error('Failed to load mail data', err);
  }
}

// Bookmark system data
let bookmarksData = {};
if (fs.existsSync(BOOKMARKS_FILE)) {
  try {
    bookmarksData = JSON.parse(fs.readFileSync(BOOKMARKS_FILE, 'utf8') || '{}');
  } catch (err) {
    console.error('Failed to load bookmarks data', err);
  }
}

let homesData = {};
if (fs.existsSync(HOMES_FILE)) {
  try {
    homesData = JSON.parse(fs.readFileSync(HOMES_FILE, 'utf8') || '{}');
  } catch (err) {
    console.error('Failed to load homes data', err);
  }
}

function saveHomes() {
  try {
    fs.writeFileSync(HOMES_FILE, JSON.stringify(homesData, null, 4), 'utf8');
  } catch (err) {
    console.error('Failed to save homes data', err);
  }
}

function saveBookmarks() {
  try {
    fs.writeFileSync(BOOKMARKS_FILE, JSON.stringify(bookmarksData, null, 4), 'utf8');
  } catch (err) {
    console.error('Failed to save bookmarks data', err);
  }
}

function saveMail() {
  try {
    fs.writeFileSync(MAIL_FILE, JSON.stringify(mailData, null, 4), 'utf8');
  } catch (err) {
    console.error('Failed to save mail data', err);
  }
}
async function cmd_math(bot, username, args) {
  const expression = args.join(' ');
  try {
    const result = evaluate(expression);
    bot.whisper(username, `The result is: ${result}`);
  } catch (err) {
    bot.whisper(username, 'Error: Invalid mathematical expression. 🐛');
    console.error(`${username} tried to use the math command with th e expression: ${expression} But ${err} happened.`);
  }
}

async function cmd_randomsentence(bot, username, args) {
  const sentence = faker.lorem.sentence();
  bot.whisper(username, sentence);
}

async function cmd_randomword(bot, username, args) {
  const word = faker.hacker.noun();
  bot.whisper(username, word);
}

async function cmd_hello(bot, username, args) {
  bot.whisper(username, `Hey there, ${username}!`);
}

async function cmd_info(bot, username, args) {
  bot.whisper(username, 'I am a Node.js Mineflayer bot ported from the Python version. I was ported because the JavaScript libary on python sucks');
  // NO I WILL NOT BE PORTING THIS BACK
}

async function cmd_randomnumber(bot, username, args) {
  const number = Math.floor(Math.random() * 10) + 1;
  bot.whisper(username, `Your random number is: ${number}`);
}

// Simple 1D Perlin Noise implementation
const perlin1D = (function () {
  const p = new Uint8Array(512);
  const permutation = new Uint8Array(256);
  for (let i = 0; i < 256; i++) permutation[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
  }
  for (let i = 0; i < 512; i++) p[i] = permutation[i % 256];

  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (t, a, b) => a + t * (b - a);
  const grad = (hash, x) => (hash & 1 ? -x : x);

  return function (x) {
    const X = Math.floor(x) & 255;
    x -= Math.floor(x);
    const u = fade(x);
    return lerp(u, grad(p[X], x), grad(p[X + 1], x - 1)) * 2;
  };
})();

async function cmd_trng(bot, username, args) {
  const time = Date.now();
  // Using time as x input, scaled to avoid repeating patterns too quickly
  const noise = perlin1D(time / 1000);
  // Normalize noise from [-1, 1] to [0, 100]
  const normalizedValue = Math.floor(((noise + 1) / 2) * 100);
  bot.whisper(username, `[TRNG] Result: ${normalizedValue}`);
}

async function cmd_help(bot, username, args) {
  if (args && args.length > 0) {
    const commandName = (args[0].startsWith('!') ? args[0] : '!' + args[0]).toLowerCase();
    const cmd = COMMAND_INFO[commandName];
    if (cmd) {
      bot.whisper(username, `Command: ${commandName}`);
      bot.whisper(username, `Description: ${cmd.description}`);
      bot.whisper(username, `Format: ${cmd.format}`);
    } else {
      bot.whisper(username, `Unknown command: ${args[0]}`);
    }
  } else {
    const cmds = Object.keys(COMMANDS).sort();
    bot.whisper(username, 'Available commands: ' + cmds.join(', '));
    bot.whisper(username, 'Use !help [command] for more details.');
  }
}
// hopefully this doesnt dissappear tmr
async function cmd_AI(bot, username, args) {
  if (!args || args.length === 0) {
    bot.whisper(username, 'Please provide a prompt for GPT.');
    return;
  }
  const prompt = args.join(' ');
  const cacheKey = prompt.toLowerCase();

  // Check Cache first
  if (AICache[cacheKey]) {
    bot.whisper(username, AICache[cacheKey]);
    return;
  }

  // Rate Limiting
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

  // Initialize history if needed
  if (!ConversationHistory[username]) {
    ConversationHistory[username] = [];
  }

  // Build context from history
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

    // Update Cache
    AICache[cacheKey] = answer;
    try {
      fs.writeFileSync(GPT_CACHE_FILE, JSON.stringify(AICache, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to save GPT cache', err);
    }

    // Update history
    ConversationHistory[username].push({ role: 'user', text: prompt });
    ConversationHistory[username].push({ role: 'bot', text: answer });

    if (ConversationHistory[username].length > 20) {
      ConversationHistory[username] = ConversationHistory[username].slice(-20);
    }

    bot.whisper(username, answer);
  } catch (err) {
    if (err.response) {
      const status = err.response.status;
      if (status === 429) {
        bot.whisper(username, 'The AI is currently overloaded. Please try again later.');
      } else if (status >= 500 && status <= 504) {
        bot.whisper(username, `The AI service is currently unavailable (Error ${status}). Try again in a minute.`);
      } else {
        bot.whisper(username, `AI Error (${status}). Please try again later.`);
      }
    } else {
      console.error('cmd_ai error', err?.message || err);
      bot.whisper(username, 'Failed to fetch AI response.');
    }
  }
}

async function cmd_newchat(bot, username, args) {
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
  const filePath = path.join(__dirname, 'chats', `${username}_${chatName}.json`);

  try {
    if (!fs.existsSync(path.join(__dirname, 'chats'))) {
      fs.mkdirSync(path.join(__dirname, 'chats'));
    }
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

async function cmd_listchats(bot, username, args) {
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

    if (userChats.length === 0) {
      bot.whisper(username, 'You have no saved chats.');
    } else {
      bot.whisper(username, 'Your saved chats: ' + userChats.join(', '));
    }
  } catch (err) {
    console.error('listchats error', err);
    bot.whisper(username, 'Failed to list chat sessions.');
  }
}

async function cmd_follow(bot, username, args) {
  const player = bot.players[username];
  if (!player || !player.entity) {
    bot.whisper(username, "I can't see you!");
    return;
  }

  bot.chat(`I am now following ${username}.`);

  const defaultMove = new Movements(bot);
  bot.pathfinder.setMovements(defaultMove);

  // Dynamic follow goal
  // range = 2 blocks
  const goal = new goals.GoalFollow(player.entity, 2);
  bot.pathfinder.setGoal(goal, true);
}

async function cmd_fight(bot, username, args) {
  const player = bot.players[username];
  if (!player || !player.entity) {
    bot.whisper(username, "I can't see you to fight!");
    return;
  }
  bot.chat(`Combat initiated with ${username}!`);
  try {
    bot.pvp.attack(player.entity);
  } catch (err) {
    console.error('fight error', err);
  }
}

async function cmd_stop(bot, username, args) {
  try {
    bot.pvp.stop();
    bot.pathfinder.setGoal(null);
    bot.chat('Combat and movement terminated.');
  } catch (err) {
    console.error('stop error', err);
  }
}

async function cmd_refresh(bot, username, args) {
  if (username !== OWNER) {
    bot.whisper(username, '⛔ You do not have permission to use this command.');
    return;
  }

  bot.chat('🔄 Restarting bot process to apply updates...');
  process.exit(1);

}

async function cmd_fetchforupdates(bot, username, args) {
  if (username !== OWNER) {
    bot.whisper(username, '⛔ You do not have permission to use this command.');
    return;
  }
  bot.chat('⬇️ Fetching updates from git...');
  exec('git pull', (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      bot.whisper(username, 'Error fetching updates.');
      return;
    }
    if (stdout) console.log(`stdout: ${stdout}`);
    if (stderr) console.error(`stderr: ${stderr}`);
    bot.chat('✅ Updates fetched. Use !restartbot to apply.');
  });
}

async function cmd_say(bot, username, args) {
  if (!args || args.length === 0) {
    bot.whisper(username, 'Please provide a message for me to say.');
    return;
  }
  if (filter.isProfane(args.join(' '))) {
    bot.chat(`${username} tried to make me curse!`)
  } else {
    bot.chat(args.join(' '));
  }
}

async function cmd_timescursed(bot, username, args) {
  if (!args || args.length === 0) {
    bot.whisper(username, 'Usage: !timescursed [player]');
    return;
  }

  const playerName = args[0];
  let data = {};
  if (fs.existsSync(CURSES_FILE)) {
    try {
      data = JSON.parse(fs.readFileSync(CURSES_FILE, 'utf8') || '{}');
    } catch (err) { }
  }

  const curseCount = data[playerName] || 0;
  bot.whisper(username, `${playerName} has cursed ${curseCount} times.`);
}

async function cmd_wins(bot, username, args) {
  if (!args || args.length === 0) {
    const wins = winsData[username] || 0;
    bot.whisper(username, `You have ${wins} wins.`);
    return;
  }

  const playerName = args[0];
  const wins = winsData[playerName] || 0;
  bot.whisper(username, `${playerName} has ${wins} wins.`);
}

async function cmd_leaderboard(bot, username, args) {
  if (Object.keys(winsData).length === 0) {
    bot.whisper(username, 'No wins recorded yet.');
    return;
  }

  const sorted = Object.entries(winsData)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  bot.whisper(username, 'Top 10 Winners:');
  sorted.forEach((entry, index) => {
    bot.whisper(username, `${index + 1}. ${entry[0]}: ${entry[1]} wins`);
  });
}

async function cmd_wiki(bot, username, args) {
  const query = Array.isArray(args) ? args.join('_') : args;

  try {
    const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${query}`);

    if (!response.ok) {
      return bot.whisper(username, "I couldn't find a Wikipedia page for that.");
    }

    const data = await response.json();
    bot.whisper(username, data.extract);
  } catch (err) {
    bot.whisper(username, "Internal error fetching Wikipedia data.");
  }
}

async function cmd_summarizer(bot, username, args) {
  if (!args || args.length === 0) {
    bot.whisper(username, 'Please provide text to summarize.');
    return;
  }
  Summarizer = new SummarizerManager(args.join(' '), 3)
  let summary = Summarizer.getSummaryByFrequency(args).summary;

  bot.whisper(username, summary);

}

async function cmd_leetspeak(bot, username, args) {
  if (!args || args.length === 0) {
    bot.whisper(username, 'Please provide text to convert to leetspeak.');
    return;
  }
  const leetText = translateToLeet(args.join(' '));
  bot.whisper(username, leetText);
}

async function cmd_joke(bot, username) {
  try {
    const response = await fetch('https://official-joke-api.appspot.com/random_joke');
    const data = await response.json();

    bot.whisper(username, `${data.setup}`);

    // Proper way to wait 2 seconds in an async function:
    await new Promise(resolve => setTimeout(resolve, 2000));

    bot.whisper(username, `${data.punchline}`);
  } catch (error) {
    console.error('Error fetching joke:', error);
    bot.whisper(username, 'Sorry, I could not fetch a joke at this time.');
  }
}

async function cmd_catfact(bot, username, args) {
  try {
    const response = await fetch('https://catfact.ninja/fact');
    const data = await response.json();
    bot.whisper(username, data.fact);
  } catch (error) {
    console.error('Error fetching cat fact:', error);
    bot.whisper(username, 'Sorry, I could not fetch a cat fact at this time.');
  }
}

async function cmd_dogfact(bot, username, args) {
  try {
    const response = await fetch('https://dogapi.dog/api/v2/facts');

    // Check if the HTTP request actually succeeded
    if (!response.ok) throw new Error('Network response was not ok');

    const json = await response.json();

    // Drill down into the JSON structure
    const fact = json.data?.[0]?.attributes?.body || "Could not find a dog fact.";
    bot.whisper(username, fact);
  } catch (error) {
    console.error('Error fetching dog fact:', error);
    bot.whisper(username, 'Sorry, I could not fetch a dog fact at this time.');
  }
}

async function cmd_base64(bot, username, args) {
  if (args.length < 2) {
    bot.whisper(username, 'Usage: !base64 <encode|decode> <text>');
    return;
  }

  const action = args[0].toLowerCase();
  const text = args.slice(1).join(' ');

  try {
    if (action === 'encode') {
      const encoded = Buffer.from(text).toString('base64');
      bot.whisper(username, `Encoded: ${encoded}`);
    } else if (action === 'decode') {
      const decoded = Buffer.from(text, 'base64').toString('utf8');
      bot.whisper(username, `Decoded: ${decoded}`);
    } else {
      bot.whisper(username, 'Please specify "encode" or "decode".');
    }
  } catch (err) {
    bot.whisper(username, 'Error: Could not process that text.');
  }
}

async function cmd_fact(bot, username, args) {
  try {
    const response = await fetch('https://uselessfacts.jsph.pl/random.json?language=en');
    const data = await response.json();
    bot.whisper(username, data.text);
  } catch (error) {
    console.error('Error fetching fact:', error);
    bot.whisper(username, 'Sorry, I could not fetch a fact at this time.');
  }
}
async function cmd_anime_quote(bot, username) {
  try {
    const response = await fetch('https://animechan.io/api/random');
    const data = await response.json();
    bot.whisper(username, `"${data.quote}" - ${data.character} from ${data.anime}`);
  }
  catch (error) {
    console.error('Error fetching anime quote:', error);
    bot.whisper(username, 'Sorry, I could not fetch an anime quote at this time.');
  }
}

async function cmd_ping(bot, username) {
  const ping = (bot.player && bot.player.ping !== undefined) ? bot.player.ping : 'Unknown';
  bot.whisper(username, ping + 'ms');
};

async function cmd_news(bot, username) {
  try {
    // Using a general news RSS-to-JSON converter to keep it simple
    const res = await axios.get(`https://api.rss2json.com/v1/api.json?rss_url=http://feeds.bbci.co.uk/news/world/rss.xml`);
    const latest = res.data.items[0];

    // Minecraft chat limit is 256, so we slice it just in case
    const headline = `Latest: ${latest.title}`.slice(0, 250);
    bot.whisper(username, headline);
  } catch (err) {
    console.error('news error', err);
    bot.whisper(username, 'Failed to fetch news.');
  }
}

async function cmd_weather(bot, username, args) {
  if (!args || args.length === 0) {
    bot.whisper(username, 'Usage: !weather [city]');
    return;
  }
  const city = args.join(' ');
  try {
    // 1. Get Lat/Lon for the city
    const geo = await axios.get(`https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1`);
    if (!geo.data.results) {
      bot.whisper(username, `City "${city}" not found.`);
      return;
    }
    const { latitude, longitude, name } = geo.data.results[0];

    // 2. Get Weather
    const weather = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&temperature_unit=fahrenheit`);
    const temp = weather.data.current_weather.temperature;

    bot.whisper(username, `Weather in ${name}: ${temp}°F`);
  } catch (err) {
    console.error('weather error', err);
    bot.whisper(username, 'Error fetching weather.');
  }
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
      const quantity = product.quantity || 'Unknown Quantity';
      const grade = product.nutrition_grades ? product.nutrition_grades.toUpperCase() : '?';

      bot.whisper(username, `Found: ${name} (${brand}, ${quantity}) - Nutrition Grade: ${grade}`);
    } else {
      bot.whisper(username, `No food found for "${query}".`);
    }
  } catch (err) {
    console.error('food error', err);
    bot.whisper(username, 'Error fetching food data.');
  }
}


async function cmd_mail(bot, username, args) {
  if (!args || args.length < 2) {
    bot.whisper(username, 'Usage: !mail <username> <message>');
    return;
  }
  const recipient = args[0];
  const message = args.slice(1).join(' ');
  const timestamp = new Date().toLocaleString();

  if (!mailData[recipient]) {
    mailData[recipient] = [];
  }

  mailData[recipient].push({
    from: username,
    message: message,
    timestamp: timestamp
  });

  saveMail();
  bot.whisper(username, `Mail sent to ${recipient}.`);
}

async function cmd_readmail(bot, username, args) {
  const messages = mailData[username];
  if (!messages || messages.length === 0) {
    bot.whisper(username, 'You have no new mail.');
    return;
  }

  bot.whisper(username, '--- 📬 Your Mailbox ---');
  messages.forEach((msg, index) => {
    bot.whisper(username, `${index + 1}. From ${msg.from} (${msg.timestamp}): ${msg.message}`);
  });
}

async function cmd_clearmail(bot, username, args) {
  if (!mailData[username] || mailData[username].length === 0) {
    bot.whisper(username, 'Your mailbox is already empty.');
    return;
  }

  mailData[username] = [];
  saveMail();
  bot.whisper(username, 'Mailbox cleared.');
}

function checkMail(bot, username) {
  const messages = mailData[username];
  if (messages && messages.length > 0) {
    bot.whisper(username, `📬 You have ${messages.length} new mail message(s)! Use !readmail to view them.`);
  }
}

async function cmd_togglechatgames(bot, username, args) {
  if (username !== OWNER) {
    bot.whisper(username, '⛔ You do not have permission to use this command.');
    return;
  }

  config.game.enabled = !config.game.enabled;
  try {
    fs.writeFileSync(path.join(__dirname, 'config.json'), JSON.stringify(config, null, 2), 'utf8');
    const status = config.game.enabled ? 'ENABLED' : 'DISABLED';
    bot.chat(`🎮 Chat games have been ${status} by the owner.`);
  } catch (err) {
    console.error('Failed to save config.json', err);
    bot.whisper(username, 'Failed to save configuration change.');
  }
}

async function cmd_inventory(bot, username, args) {
  const items = bot.inventory.items();
  if (items.length === 0) {
    bot.whisper(username, 'My inventory is empty.');
    return;
  }
  const output = items.map(item => `${item.name} x${item.count}`).join(', ');
  bot.whisper(username, `Inventory: ${output}`);
}

async function cmd_stats(bot, username, args) {
  const health = Math.round(bot.health);
  const food = Math.round(bot.food);
  const xp = bot.experience.points;
  bot.whisper(username, `Stats - Health: ${health}/20, Food: ${food}/20, XP: ${xp}`);
}

async function cmd_coords(bot, username, args) {
  if (username !== OWNER) {
    bot.whisper(username, '⛔ This is an owner-only command to prevent base leaks.');
    return;
  }
  const { x, y, z } = bot.entity.position;
  bot.whisper(username, `Current coords: ${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}`);
}

async function cmd_drop(bot, username, args) {
  const item = bot.heldItem;
  if (!item) {
    bot.whisper(username, 'I am not holding anything.');
    return;
  }
  try {
    await bot.tossStack(item);
    bot.whisper(username, `Dropped ${item.name}.`);
  } catch (err) {
    bot.whisper(username, 'Failed to drop item.');
  }
}

async function cmd_hand(bot, username, args) {
  const item = bot.heldItem;
  if (!item) {
    bot.whisper(username, 'I am not holding anything.');
  } else {
    bot.whisper(username, `I am holding ${item.name}.`);
  }
}

async function cmd_near(bot, username, args) {
  const nearby = Object.values(bot.entities)
    .filter(e => e !== bot.entity && bot.entity.position.distanceTo(e.position) < 16)
    .map(e => (e.username || e.displayName || e.name || 'Unknown entity'));

  if (nearby.length === 0) {
    bot.whisper(username, 'No one nearby.');
  } else {
    bot.whisper(username, `Nearby: ${nearby.join(', ')}`);
  }
}

async function cmd_bookmark(bot, username, args) {
  if (username !== OWNER) {
    bot.whisper(username, '⛔ This is an owner-only command.');
    return;
  }
  if (!args || args.length === 0) {
    bot.whisper(username, 'Usage: !bookmark <name>');
    return;
  }
  const name = args[0];
  bookmarksData[name] = bot.entity.position;
  saveBookmarks();
  bot.whisper(username, `Bookmark "${name}" saved!`);
}

async function cmd_goto(bot, username, args) {
  if (username !== OWNER) {
    bot.whisper(username, '⛔ This is an owner-only command.');
    return;
  }
  if (!args || args.length === 0) {
    bot.whisper(username, 'Usage: !goto <bookmark_name>');
    return;
  }
  const name = args[0];
  const pos = bookmarksData[name];
  if (!pos) {
    bot.whisper(username, `Bookmark "${name}" not found.`);
    return;
  }
  bot.chat(`Navigating to bookmark: ${name}`);
  const defaultMove = new Movements(bot);
  bot.pathfinder.setMovements(defaultMove);
  bot.pathfinder.setGoal(new goals.GoalBlock(pos.x, pos.y, pos.z));
}

async function cmd_players(bot, username, args) {
  const playerNames = Object.keys(bot.players);
  bot.whisper(username, `Online players: ${playerNames.join(', ')}`);
}

async function cmd_log(bot, username, args) {
  if (username !== OWNER) {
    bot.whisper(username, '⛔ This is an owner-only command.');
    return;
  }
  const logFile = path.join(__dirname, config.files.chatLogs);
  try {
    const data = fs.readFileSync(logFile, 'utf8');
    const lines = data.split('\n').filter(l => l.trim()).slice(-5);
    bot.whisper(username, '--- Last 5 logs ---');
    lines.forEach(l => bot.whisper(username, l));
  } catch (err) {
    bot.whisper(username, 'Failed to read logs.');
  }
}

let protectTarget = null;
async function cmd_protect(bot, username, args) {
  if (!args || args.length === 0) {
    protectTarget = null;
    bot.pvp.stop();
    bot.pathfinder.setGoal(null);
    bot.chat('Protection mode disabled.');
    return;
  }
  const name = args[0];
  const player = bot.players[name];
  if (!player || !player.entity) {
    bot.whisper(username, `I can't see ${name}.`);
    return;
  }
  protectTarget = name;
  bot.chat(`Protecting ${name}!`);

  const defaultMove = new Movements(bot);
  bot.pathfinder.setMovements(defaultMove);
  bot.pathfinder.setGoal(new goals.GoalFollow(player.entity, 2), true);
}

// In bot.js entityHurt is already defined, but for protection we might need extra logic
// Let's refine the cmd_protect logic in a follow-up if needed, 
// for now this sets the goal to follow.

async function cmd_clearwins(bot, username, args) {
  if (username !== OWNER) {
    bot.whisper(username, '⛔ This is an owner-only command.');
    return;
  }
  winsData = {};
  try {
    fs.writeFileSync(WINS_FILE, JSON.stringify(winsData, null, 4), 'utf8');
    bot.chat('🏆 Wins leaderboard has been cleared by the owner.');
  } catch (err) {
    bot.whisper(username, 'Failed to clear wins.');
  }
}

async function cmd_broadcast(bot, username, args) {
  if (!args || args.length === 0) {
    bot.whisper(username, 'Usage: !broadcast <message>');
    return;
  }
  const msg = args.join(' ').toUpperCase();
  bot.chat(`📢 BROADCAST: ${msg}`);
}

async function cmd_mine(bot, username, args) {
  if (!args || args.length === 0) {
    bot.whisper(username, 'Usage: !mine <block_name> [count]');
    return;
  }
  const blockName = args[0];
  const count = parseInt(args[1]) || 1;
  const mcData = require('minecraft-data')(bot.version);
  const blockType = mcData.blocksByName[blockName];

  if (!blockType) {
    bot.whisper(username, `I don't know what "${blockName}" is.`);
    return;
  }

  const blocks = bot.findBlocks({
    matching: blockType.id,
    maxDistance: 64,
    count: count
  });

  if (blocks.length === 0) {
    bot.whisper(username, `I couldn't find any ${blockName} nearby.`);
    return;
  }

  bot.chat(`⛏️ Mining ${blocks.length} ${blockName}...`);
  try {
    await bot.collectBlock.collect(bot.findBlock({ matching: blockType.id, maxDistance: 64 }));
    bot.chat(`✅ Finished mining ${blockName}.`);
  } catch (err) {
    console.error('Mining error', err);
    bot.whisper(username, 'Failed to mine blocks.');
  }
}

async function cmd_sethome(bot, username, args) {
  homesData[username] = bot.entity.position;
  saveHomes();
  bot.whisper(username, '🏠 Home set! Use !home to see your coordinates.');
}

async function cmd_home(bot, username, args) {
  const pos = homesData[username];
  if (!pos) {
    bot.whisper(username, "You haven't set a home yet. Use !sethome.");
    return;
  }
  bot.whisper(username, `📍 Your home is at: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`);
}

async function cmd_delhome(bot, username, args) {
  if (homesData[username]) {
    delete homesData[username];
    saveHomes();
    bot.whisper(username, '🏠 Home deleted.');
  } else {
    bot.whisper(username, 'You have no home to delete.');
  }
}

async function cmd_trash(bot, username, args) {
  if (username !== OWNER) {
    bot.whisper(username, '⛔ This is an owner-only command.');
    return;
  }
  const items = bot.inventory.items();
  if (items.length === 0) {
    bot.whisper(username, 'Inventory is empty.');
    return;
  }

  bot.chat('🗑️ Clearing inventory...');
  for (const item of items) {
    await bot.tossStack(item);
  }
  bot.chat('✅ Inventory cleared.');
}

async function cmd_seen(bot, username, args) {
  if (!args || args.length === 0) {
    bot.whisper(username, 'Usage: !seen <player>');
    return;
  }
  const target = args[0];
  const player = bot.players[target];
  if (player) {
    bot.whisper(username, `${target} is currently online!`);
    return;
  }

  // Check players.json (assumed to be updated on join/leave)
  // For now, let's just check if we have data for them
  let data = {};
  const DATA_FILE = path.join(__dirname, config.files.players);
  if (fs.existsSync(DATA_FILE)) {
    try { data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '{}'); } catch (e) { }
  }

  if (data[target]) {
    bot.whisper(username, `${target} was last seen on this server (Login count: ${data[target]}).`);
  } else {
    bot.whisper(username, `I haven't seen ${target} before.`);
  }
}

let guardPos = null;
async function cmd_guard(bot, username, args) {
  if (username !== OWNER) {
    bot.whisper(username, '⛔ This is an owner-only command.');
    return;
  }
  if (guardPos) {
    guardPos = null;
    bot.pvp.stop();
    bot.pathfinder.setGoal(null);
    bot.chat('🛡️ Guard mode disabled.');
  } else {
    guardPos = bot.entity.position.clone();
    bot.chat(`🛡️ Guarding this area within ${config.guard.radius} blocks.`);
    // Setup guard routine
    const guardInterval = setInterval(() => {
      if (!guardPos) {
        clearInterval(guardInterval);
        return;
      }

      const target = bot.nearestEntity(e =>
        (e.type === 'mob' && config.guard.attackMobs) ||
        (e.type === 'player' && config.guard.attackPlayers && e.username !== OWNER)
      );

      if (target && target.position.distanceTo(guardPos) < config.guard.radius) {
        bot.pvp.attack(target);
      } else if (bot.entity.position.distanceTo(guardPos) > 2) {
        bot.pathfinder.setGoal(new goals.GoalBlock(guardPos.x, guardPos.y, guardPos.z));
      }
    }, 1000);
  }
}

async function cmd_status(bot, username, args) {
  let status = 'Idle';
  if (bot.pathfinder.goal) status = 'Moving / Pathfinder active';
  if (bot.pvp.target) status = `In combat with ${bot.pvp.target.username || bot.pvp.target.displayName || 'entity'}`;
  if (guardPos) status = 'Guarding area';

  const health = Math.round(bot.health);
  const food = Math.round(bot.food);
  bot.whisper(username, `🤖 Bot Status: ${status} | ❤️ Health: ${health}/20 | 🍖 Food: ${food}/20`);
}

async function cmd_exchange(bot, username, args) {
  const trades = config.exchange.trades;
  bot.whisper(username, '--- 🔄 Current Trade Rates ---');
  for (const [item, data] of Object.entries(trades)) {
    bot.whisper(username, `${item} -> ${data.count}x ${data.reward}`);
  }
  bot.whisper(username, 'Drop the items to me to begin trading!');
}


const COMMANDS = {
  '!math': cmd_math,
  '!food': cmd_food,
  '!news': cmd_news,
  '!weather': cmd_weather,
  '!ping': cmd_ping,
  '!animequote': cmd_anime_quote,
  '!fact': cmd_fact,
  '!base64': cmd_base64,
  '!dogfact': cmd_dogfact,
  '!catfact': cmd_catfact,
  '!leet': cmd_leetspeak,
  '!joke': cmd_joke,
  '!summary': cmd_summarizer,
  '!wikipedia': cmd_wiki,
  '!wiki': cmd_wiki,
  '!randomword': cmd_randomword,
  '!hello': cmd_hello,
  '!info': cmd_info,
  '!help': cmd_help,
  '!ai': cmd_AI,
  '!randomsentence': cmd_randomsentence,
  '!stop': cmd_stop,
  '!sat': cmd_say,
  '!say': cmd_say,
  '!fight': cmd_fight,
  '!randomnumber': cmd_randomnumber,
  '!timescursed': cmd_timescursed,
  '!wins': cmd_wins,
  '!leaderboard': cmd_leaderboard,
  '!follow': cmd_follow,
  '!newchat': cmd_newchat,
  '!savechat': cmd_savechat,
  '!loadchat': cmd_loadchat,
  '!listchats': cmd_listchats,
  '!restartbot': cmd_refresh,
  '!fetchforupdates': cmd_fetchforupdates,
  '!togglechatgames': cmd_togglechatgames,
  '!trng': cmd_trng,
  '!inventory': cmd_inventory,
  '!stats': cmd_stats,
  '!coords': cmd_coords,
  '!drop': cmd_drop,
  '!hand': cmd_hand,
  '!near': cmd_near,
  '!bookmark': cmd_bookmark,
  '!goto': cmd_goto,
  '!players': cmd_players,
  '!log': cmd_log,
  '!protect': cmd_protect,
  '!clearwins': cmd_clearwins,
  '!broadcast': cmd_broadcast,
  '!mine': cmd_mine,
  '!sethome': cmd_sethome,
  '!home': cmd_home,
  '!delhome': cmd_delhome,
  '!trash': cmd_trash,
  '!seen': cmd_seen,
  '!guard': cmd_guard,
  '!status': cmd_status,
  '!exchange': cmd_exchange,
  '!autoeat': (bot, username) => { } // already handled in bot.js but added here for help visibility
};


const COMMAND_INFO = {
  '!math': {
    description: 'Evaluates a mathematical expression.',
    format: '!math [expression]'
  },
  '!news': {
    description: 'Shows the latest world news headline.',
    format: '!news'
  },
  '!food': {
    description: 'Searches OpenFoodFacts (name, brand, nutrition grade).',
    format: '!food [product]'
  },
  '!weather': {
    description: 'Shows the current temperature for a city.',
    format: '!weather [city]'
  },
  '!ping': {
    description: 'Checks the bot\'s ping to the server.',
    format: '!ping'
  },
  '!animequote': {
    description: 'Tells a random anime quote.',
    format: '!animequote'
  },
  '!fact': {
    description: 'Tells a random useless fact.',
    format: '!fact'
  },
  '!base64': {
    description: 'Encodes or decodes text in Base64.',
    format: '!base64 <encode|decode> <text>'
  },
  '!dogfact': {
    description: 'Tells a random dog fact.',
    format: '!dogfact'
  },
  '!catfact': {
    description: 'Tells a random cat fact.',
    format: '!catfact'
  },
  '!leet': {
    description: 'Converts text to leetspeak.',
    format: '!leet [text]'
  },
  '!joke': {
    description: 'Tells a random joke.',
    format: '!joke'
  },
  '!summary': {
    description: 'Summarizes the provided text.',
    format: '!summary [text]'
  },
  '!wikipedia': {
    description: 'Gets the wikipidia page for a word.',
    format: '!wikipedia [word]'
  },
  '!wiki': {
    description: 'Gets the wikipidia page for a word.',
    format: '!wiki [word]'
  },
  '!mine': {
    description: 'Mines a specific block nearby.',
    format: '!mine <block> [count]'
  },
  '!sethome': {
    description: 'Sets your current location as your home.',
    format: '!sethome'
  },
  '!home': {
    description: 'Whispers your home coordinates to you.',
    format: '!home'
  },
  '!delhome': {
    description: 'Deletes your saved home.',
    format: '!delhome'
  },
  '!trash': {
    description: 'Owner only: Drops all items in inventory.',
    format: '!trash'
  },
  '!seen': {
    description: 'Shows when a player was last online.',
    format: '!seen <player>'
  },
  '!guard': {
    description: 'Owner only: Guards the current area.',
    format: '!guard'
  },
  '!status': {
    description: 'Shows the bot\'s current activity and stats.',
    format: '!status'
  },
  '!exchange': {
    description: 'Shows the current trade rates for item exchange.',
    format: '!exchange'
  },
  '!autoeat': {
    description: 'Toggles automatic eating.',
    format: '!autoeat'
  },
  '!randomword': {
    description: 'Generates a random word',
    format: '!randomword'
  },
  '!hello': {
    description: 'Greets you',
    format: '!hello'
  },
  '!info': {
    description: 'Shows bot information',
    format: '!info'
  },
  '!help': {
    description: 'Lists all commands or shows details about a specific command',
    format: '!help [command]'
  },
  '!ai': {
    description: 'Sends a prompt to a AI and returns the response',
    format: '!ai [prompt]'
  },
  '!randomsentence': {
    description: 'Generates a random sentence',
    format: '!randomsentence'
  },
  '!stop': {
    description: 'Stops bot combat',
    format: '!stop'
  },
  '!say': {
    description: 'Makes the bot say something in chat',
    format: '!say [message]'
  },
  '!fight': {
    description: 'Initiates combat with you',
    format: '!fight'
  },
  '!randomnumber': {
    description: 'Generates a random number between 1 and 10',
    format: '!randomnumber'
  },
  '!timescursed': {
    description: 'Shows how many times a player has cursed',
    format: '!timescursed [player]'
  },
  '!wins': {
    description: 'Shows how many times you or another player has won the chat game',
    format: '!wins [player]'
  },
  '!leaderboard': {
    description: 'Shows the top 10 players with the most wins',
    format: '!leaderboard'
  },
  '!follow': {
    description: 'Follows the player who sent the command',
    format: '!follow'
  },
  '!newchat': {
    description: 'Resets your AI conversation history',
    format: '!newchat'
  },
  '!savechat': {
    description: 'Saves your current AI conversation history',
    format: '!savechat <name>'
  },
  '!loadchat': {
    description: 'Loads a previously saved AI conversation history',
    format: '!loadchat <name>'
  },
  '!listchats': {
    description: 'Lists all your saved AI conversation histories',
    format: '!listchats'
  },
  '!restartbot': {
    description: 'Owner only: Restarts the bot connection',
    format: '!restartbot'
  },
  '!fetchforupdates': {
    description: 'Owner only: Pulls latest code from git',
    format: '!fetchforupdates'
  },
  '!togglechatgames': {
    description: 'Owner only: Enables or disables the automatic chat games',
    format: '!togglechatgames'
  },
  '!mail': {
    description: 'Sends a message to an offline or online player',

    format: '!mail <username> <message>'
  },
  '!readmail': {
    description: 'Reads your messages',
    format: '!readmail'
  },
  '!clearmail': {
    description: 'Clears all your messages',
    format: '!clearmail'
  },
  '!trng': {
    description: 'Generates a random number using system time and Perlin noise.',
    format: '!trng'
  },
  '!inventory': {
    description: 'Shows your inventory items.',
    format: '!inventory'
  },
  '!stats': {
    description: 'Shows health, hunger, and XP.',
    format: '!stats'
  },
  '!coords': {
    description: 'Owner only: Shows current coordinates.',
    format: '!coords'
  },
  '!drop': {
    description: 'Drops the item in hand.',
    format: '!drop'
  },
  '!hand': {
    description: 'Identifies the item in hand.',
    format: '!hand'
  },
  '!near': {
    description: 'Lists nearby entities.',
    format: '!near'
  },
  '!bookmark': {
    description: 'Owner only: Saves a named coordinate.',
    format: '!bookmark <name>'
  },
  '!goto': {
    description: 'Owner only: Travels to a bookmark.',
    format: '!goto <name>'
  },
  '!players': {
    description: 'Lists online players.',
    format: '!players'
  },
  '!log': {
    description: 'Owner only: Shows recent chat logs.',
    format: '!log'
  },
  '!protect': {
    description: 'Follows and protects a player.',
    format: '!protect <name>'
  },
  '!clearwins': {
    description: 'Owner only: Resets the wins leaderboard.',
    format: '!clearwins'
  },
  '!broadcast': {
    description: 'Sends a shouting broadcast message.',
    format: '!broadcast <message>'
  },
  '!autoeat': {
    description: 'Toggles automatic eating.',
    format: '!autoeat'
  }
};

function trackWin(username) {
  const count = (winsData[username] || 0) + 1;
  winsData[username] = count;

  try {
    fs.writeFileSync(WINS_FILE, JSON.stringify(winsData, null, 4), 'utf8');
  } catch (err) {
    console.error('Failed to write wins.json', err);
  }
}

/**
 * Gets the UUID of a player by their username.
 * @param {object} bot - The Mineflayer bot instance.
 * @param {string} username - The username of the player.
 * @returns {string|null} - The UUID of the player, or null if not found.
 */
function getPlayerUUID(bot, username) {
  const player = bot.players[username];
  return player ? player.uuid : null;
}


if (require.main === module) {
  console.log('I am a module! Use bot.js to run me!')
}

module.exports = { COMMANDS, trackWin, checkMail, getPlayerUUID }