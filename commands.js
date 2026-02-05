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
let ConversationHistory = {};

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

  // Initialize history if needed
  if (!ConversationHistory[username]) {
    ConversationHistory[username] = [];
  }

  // Build context from history
  // Format: "User: <msg>\nBot: <msg>\n..."
  let contextParts = [];
  // Keep last 6 exchanges (12 lines)
  const history = ConversationHistory[username].slice(-12);

  for (const entry of history) {
    // If role is user, label 'User', else 'You' or 'Bot'
    const roleLabel = entry.role === 'user' ? 'User' : 'Assistant';
    contextParts.push(`${roleLabel}: ${entry.text}`);
  }

  // Add current prompt
  contextParts.push(`User: ${prompt}`);
  contextParts.push(`Assistant:`);

  const fullPrompt = `You are a helpful Minecraft bot. Answer short and concisely.\n\n${contextParts.join('\n')}`;

  const encodedPrompt = encodeURIComponent(fullPrompt);
  try {
    const res = await axios.get(`https://text.pollinations.ai/text/${encodedPrompt}`);
    const answer = String(res.data).slice(0, 300); // 300 chars max for chat

    // Update history
    ConversationHistory[username].push({ role: 'user', text: prompt });
    ConversationHistory[username].push({ role: 'bot', text: answer });

    // Prune history to keep it manageable (max 20 items = 10 turns)
    if (ConversationHistory[username].length > 20) {
      ConversationHistory[username] = ConversationHistory[username].slice(-20);
    }

    bot.whisper(username, answer);
  } catch (err) {
    console.error('cmd_ai error', err?.message || err);
    bot.whisper(username, 'Failed to fetch AI response.');
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
  '!trng': cmd_trng
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