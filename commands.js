const { faker } = require('@faker-js/faker');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
let SummarizerManager = require("node-summarizer").SummarizerManager;
const Filter = require('bad-words');
const filter = new Filter();

const mcDataModule = require('minecraft-data');
const { time } = require('console');
const CURSES_FILE = path.join(__dirname, 'curses.json');
const GPT_CACHE_FILE = path.join(__dirname, 'gpt_cache.json');
const WINS_FILE = path.join(__dirname, 'wins.json');

const leetMap = {
    'a': '4', 'b': '8', 'c': '(', 'd': '|)', 'e': '3', 'f': '|=',
    'g': '6', 'h': '#', 'i': '1', 'j': '_|', 'k': '|<', 'l': '1',
    'm': '|\\/|', 'n': '|\\|', 'o': '0', 'p': '|*', 'q': '(,)',
    'r': '|2', 's': '5', 't': '7', 'u': '|_|', 'v': '\\/',
    'w': '\\/\\/', 'x': '><', 'y': '`/', 'z': '2'
};

function translateToLeet(text) {
    return text
        .toLowerCase() // Ensure it matches the lowercase keys in your map
        .split('')     // Turn "hello" into ['h', 'e', 'l', 'l', 'o']
        .map(char => leetMap[char] || char) // Swap if it exists, otherwise keep original
        .join('');    // Turn back into a string
}

// Initialize GPT cache
let AICache = {};
if (fs.existsSync(GPT_CACHE_FILE)) {
  try {
    AICache = JSON.parse(fs.readFileSync(GPT_CACHE_FILE, 'utf8') || '{}');
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
// hopefully this doesnt dissappear tmr
async function cmd_AI(bot, username, args) {
  if (!args || args.length === 0) {
    bot.whisper(username, 'Please provide a prompt for GPT.');
    return;
  }
  const prompt = args.join(' ');
  const cacheKey = prompt.toLowerCase();
  
  // Check cache first
  if (AICache[cacheKey]) {
    bot.whisper(username, AICache[cacheKey] + ' (cached)');
    return;
  }
  
  const encodedPrompt = encodeURIComponent(prompt);
  try {
    const res = await axios.get(`https://text.pollinations.ai/text/${encodedPrompt}`);
    const answer = String(res.data).slice(0, 300);
    
    // Caching because my wifi sucks
    AICache[cacheKey] = answer;
    try {
      fs.writeFileSync(GPT_CACHE_FILE, JSON.stringify(AICache, null, 4), 'utf8');
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
  if (filter.isProfane(args.join(' '))) {
    bot.chat(`${username} tried to make me curse!`)
} else {
    bot.chat(args.join(' '));
}}

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

async function cmd_summarizer(bot, username, args) {
  if (!args || args.length === 0) {
    bot.whisper(username, 'Please provide text to summarize.');
    return;
  }
  Summarizer = new SummarizerManager(args.join(' '),3)
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
        const fact = json.data[0].attributes.body;
        
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
  const COMMANDS = {
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
  '!leaderboard': cmd_leaderboard
};

const COMMAND_INFO = {
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
  '!joke':{
    description: 'Tells a random joke.',
    format: '!joke'
  },
  '!summary':{
    description: 'Summarizes the provided text.',
    format: '!summary [text]'
  },
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


if (require.main === module) {
    console.log('I am a module! Use bot.js to run me!')
} 
module.exports = { COMMANDS, trackWin };