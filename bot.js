const fs = require('fs');
const path = require('path');
const mineflayer = require('mineflayer');
const { pathfinder } = require('mineflayer-pathfinder');
const pvp = require('mineflayer-pvp').plugin;
const Filter = require('bad-words');
const filter = new Filter();
const { COMMANDS, trackWin } = require('./commands');
const { faker } = require('@faker-js/faker');

const DATA_FILE = path.join(__dirname, 'players.json');
const CURSES_FILE = path.join(__dirname, 'curses.json');
const OPTIONS = {
  host: 'localhost',
  port: 25565,
  username: 'Bot'
};

let rejoinAttempts = 0;
let gameWord = null;
let gameActive = false;
let gameTimer = null;

function getRandomInterval() {
  // 5 to 15 minutes is much more "server-friendly"
  return Math.random() * (900000 - 300000) + 300000;
}

function startGameRound(bot) {
  gameWord = faker.hacker.noun();
  gameActive = true;
  bot.chat(`🎮 GAME STARTED! Say the word: ${gameWord}`);
  
  // Schedule next round
  if (gameTimer) clearTimeout(gameTimer);
  gameTimer = setTimeout(() => {
    gameActive = false;
    bot.chat(`⏰ Game round ended. No one said the word!`);
    startGameRound(bot);
  }, getRandomInterval());
}

function getNewGameWord() {
  gameWord = faker.hacker.noun()[0];
  return gameWord;
}

function trackCurse(username) {
  let data = {};
  if (fs.existsSync(CURSES_FILE)) {
    try {
      data = JSON.parse(fs.readFileSync(CURSES_FILE, 'utf8') || '{}');
    } catch (err) {}
  }

  const count = (data[username] || 0) + 1;
  data[username] = count;

  try {
    fs.writeFileSync(CURSES_FILE, JSON.stringify(data, null, 4), 'utf8');
  } catch (err) {
    console.error('Failed to write curses.json', err);
  }
}

function updatePlayerCount(username, bot) {
  let data = {};
  if (fs.existsSync(DATA_FILE)) {
    try {
      data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '{}');
    } catch (err) {}
  }

  const count = (data[username] || 0) + 1;
  data[username] = count;

  if (count === 1) {
    bot.chat(`Hello ${username} and welcome to the server!`);
  } else {
    bot.chat(`Welcome back ${username}! Join count: ${count}`);
  }

  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 4), 'utf8');
  } catch (err) {
    console.error('Failed to write players.json', err);
  }
}

function startBot() {
  const bot = mineflayer.createBot(OPTIONS);
  bot.loadPlugin(pathfinder);
  bot.loadPlugin(pvp);

  bot.once('spawn', () => {
    console.log(`${OPTIONS.username} spawned.`);
    bot.chat('Bot active!');
    rejoinAttempts = 0;
    startGameRound(bot);
  });


  bot.on('chat', (username, message) => {
    try {
      if (username === bot.username) return;
      const timestamp = new Date().toLocaleString();
    const logEntry = `[${timestamp}] ${username}: ${message}\n`;

    fs.appendFile('chat_logs.txt', logEntry, (err) => {
      if (err) console.error('Failed to save chat message:', err);
    });
      const isProfane = filter.isProfane(message);
      if (isProfane) {
        trackCurse(username);
        bot.whisper(username, 'Please avoid using profanity.');
        // still process command if starts with '!'
        if (!message.startsWith('!')) return;
      }

      // Check if player said the game word
      if (gameActive && message.toLowerCase().includes(gameWord.toLowerCase())) {
    trackWin(username);
    gameActive = false;
    if (gameTimer) clearTimeout(gameTimer);
    bot.chat(`🎉 ${username} won! Next round in 5 minutes.`);
  
    // Wait 5 minutes before the next game starts
    setTimeout(() => startGameRound(bot), 300000); 
}
      if (message.startsWith('!')) {
        const parts = message.split(/\s+/);
        const command = parts[0];
        const args = parts.slice(1);
        const fn = COMMANDS[command];
        if (fn) {
          const res = fn(bot, username, args);
          if (res && typeof res.then === 'function') {
            res.catch(err => {
              console.error('Command error', err);
              try { bot.whisper(username, 'Command error.'); } catch (e) {}
            });
          }
        }
      }
    } catch (err) {
      console.error('chat handler error', err);
    }
  });

  // Listen for both event names to be resilient
  bot.on('playerJoined', player => {
    const name = (player && player.username) ? player.username : player;
    if (name && name !== bot.username) updatePlayerCount(name, bot);
  });
  bot.on('playerJoin', player => {
    const name = (player && player.username) ? player.username : player;
    if (name && name !== bot.username) updatePlayerCount(name, bot);
  });

  bot.on('kicked', (reason) => {
    console.log('Kicked for:', reason);
    if (rejoinAttempts < 5) {
      rejoinAttempts += 1;
      setTimeout(() => startBot(), 5000);
    } else {
      console.log('Max rejoins reached. Exiting.');
      process.exit(1);
    }
  });

  bot.on('error', (err) => {
    console.error('Bot error', err);
  });

  return bot;
}

startBot();
