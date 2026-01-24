const randomWords = require('random-words');
const { faker } = require('@faker-js/faker');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const wiki = require('wikipedia');
let SummarizerManager = require("node-summarizer").SummarizerManager;


const mcDataModule = require('minecraft-data');
const CURSES_FILE = path.join(__dirname, 'curses.json');
const GPT_CACHE_FILE = path.join(__dirname, 'gpt_cache.json');
const WINS_FILE = path.join(__dirname, 'wins.json');

// Initialize GPT cache
let gptCache = {};
if (fs.existsSync(GPT_CACHE_FILE)) {
  try {
    gptCache = JSON.parse(fs.readFileSync(GPT_CACHE_FILE, 'utf8') || '{}');
  } catch (err) {
    console.error('Failed to load GPT cache', err);
  }
}

// Initialize wins data
let winsData = {};
if (fs.existsSync(WINS_FILE)) {
  try {
    winsData = JSON.parse(fs.readFileSync(WINS_FILE, 'utf8') || '{}');
  } catch (err) {
    console.error('Failed to load wins data', err);
  }
}
async function cmd_randomsentence(bot, username, args) {
  const sentence = faker.lorem.sentence();
  bot.whisper(username, sentence);
}

async function cmd_randomword(bot, username, args) {
  const word = randomWords();
  bot.whisper(username, word);
}

async function cmd_hello(bot, username, args) {
  bot.whisper(username, `Hey there, ${username}!`);
}

async function cmd_info(bot, username, args) {
  bot.whisper(username, 'I am a Node.js Mineflayer bot ported from the Python version. I was ported because the JavaScript libary on python sucks');
}

async function cmd_randomnumber(bot, username, args) {
  const number = Math.floor(Math.random() * 10) + 1;
  bot.whisper(username, `Your random number is: ${number}`);
}

async function cmd_help(bot, username, args) {
  if (args && args.length > 0) {
    const commandName = args[0].startsWith('!') ? args[0] : '!' + args[0];
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

async function cmd_gpt(bot, username, args) {
  if (!args || args.length === 0) {
    bot.whisper(username, 'Please provide a prompt for GPT.');
    return;
  }
  const prompt = args.join(' ');
  const cacheKey = prompt.toLowerCase();
  
  // Check cache first
  if (gptCache[cacheKey]) {
    bot.whisper(username, gptCache[cacheKey] + ' (cached)');
    return;
  }
  
  const encodedPrompt = encodeURIComponent(prompt);
  try {
    const res = await axios.get(`https://text.pollinations.ai/text/${encodedPrompt}`);
    const answer = String(res.data).slice(0, 300);
    
    // Caching because my wifi sucks
    gptCache[cacheKey] = answer;
    try {
      fs.writeFileSync(GPT_CACHE_FILE, JSON.stringify(gptCache, null, 4), 'utf8');
    } catch (err) {
      console.error('Failed to write GPT cache', err);
    }
    
    bot.whisper(username, answer);
  } catch (err) {
    console.error('cmd_gpt error', err?.message || err);
    bot.whisper(username, 'Failed to fetch GPT response.');
  }
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
    bot.chat('Combat terminated.');
  } catch (err) {
    console.error('stop error', err);
  }
}

async function cmd_say(bot, username, args) {
  if (!args || args.length === 0) {
    bot.whisper(username, 'Please provide a message for me to say.');
    return;
  }
  bot.chat(args.join(' '));
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
    } catch (err) {}
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
 
const COMMANDS = {
  '!wikipedia': cmd_wiki,
  '!wiki': cmd_wiki,
  '!randomword': cmd_randomword,
  '!hello': cmd_hello,
  '!info': cmd_info,
  '!help': cmd_help,
  '!gpt': cmd_gpt,
  '!randomsentence': cmd_randomsentence,
  '!stop': cmd_stop,
  '!sat': cmd_say,
  '!say': cmd_say,
  '!fight': cmd_fight,
  '!randomnumber': cmd_randomnumber,
  '!timescursed': cmd_timescursed,
  '!wins': cmd_wins,
  '!leaderboard': cmd_leaderboard
};

const COMMAND_INFO = {
  '!wikipedia':{
    description: 'Gets the wikipidia page for a word.',
    format: '!wikipedia [word]'
  },
  '!wiki':{
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
  '!gpt': {
    description: 'Sends a prompt to GPT and returns the response',
    format: '!gpt [prompt]'
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

module.exports = { COMMANDS, trackWin };
if (require.main === module) {
    console.log('I am a module!')
} 