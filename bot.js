const fs = require('fs');
const path = require('path');
const mineflayer = require('mineflayer');
const { pathfinder } = require('mineflayer-pathfinder');
const pvp = require('mineflayer-pvp').plugin;
const Filter = require('bad-words');
const filter = new Filter();
const { COMMANDS, trackWin, checkMail } = require('./commands');
const { faker } = require('@faker-js/faker');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

const DATA_FILE = path.join(__dirname, config.files.players);
const CURSES_FILE = path.join(__dirname, config.files.curses);
const OPTIONS = config.botOptions;


let rejoinAttempts = 0;
let gameWord = null;
let gameActive = false;
let gameTimer = null;

function getRandomInterval() {
  // Configurable interval
  return Math.random() * (config.game.maxInterval - config.game.minInterval) + config.game.minInterval;
}


function startGameRound(bot) {
  if (!config.game.enabled) {
    gameActive = false;
    if (gameTimer) clearTimeout(gameTimer);
    return;
  }
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
    } catch (err) { }
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
    } catch (err) { }
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

      fs.appendFile(config.files.chatLogs, logEntry, (err) => {
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
        // Wait configurable delay before the next game starts
        setTimeout(() => startGameRound(bot), config.game.winNextRoundDelay);

      }
      if (message.startsWith('!')) {
        const parts = message.split(/\s+/);
        const command = parts[0].toLowerCase();
        const args = parts.slice(1);
        const fn = COMMANDS[command];
        if (fn) {
          const res = fn(bot, username, args);
          if (res && typeof res.then === 'function') {
            res.catch(err => {
              console.error('Command error', err);
              try { bot.whisper(username, 'Command error.'); } catch (e) { }
            });
          }
        }
      }
    } catch (err) {
      console.error('chat handler error', err);
    }
  });

  bot.on('whisper', (username, message) => {
    if (username === bot.username) return;

    // If it looks like a command, run it
    if (message.startsWith('!')) {
      const parts = message.split(/\s+/);
      const command = parts[0].toLowerCase();
      const args = parts.slice(1);
      const fn = COMMANDS[command];
      if (fn) {
        const res = fn(bot, username, args);
        if (res && typeof res.then === 'function') {
          res.catch(err => {
            console.error('Command error', err);
            try { bot.whisper(username, 'Command error.'); } catch (e) { }
          });
        }
      } else {
        bot.whisper(username, "Unknown command.");
      }
    } else {
      // Treat as conversation -> AI
      const fn = COMMANDS['!ai'];
      if (fn) {
        // usage: cmd_AI(bot, username, args)
        // args is array of words
        const args = message.split(' ');
        fn(bot, username, args);
      }
    }
  });

  bot.on('entityHurt', (entity) => {
    if (entity !== bot.entity) return;
    if (bot.pvp.target) return; // Already fighting

    // Find the nearest attacker (player or mob) within 4 blocks
    const attacker = bot.nearestEntity(e =>
      (e.type === 'player' || e.type === 'mob') &&
      e.position.distanceTo(bot.entity.position) < 4 &&
      e !== bot.entity
    );

    if (attacker) {
      const name = attacker.username || attacker.displayName || attacker.name;
      bot.chat(`I am being attacked by ${name}! Defending myself!`);
      bot.pvp.attack(attacker);
    }
  });

  // Listen for both event names to be resilient
  bot.on('playerJoined', player => {
    const name = (player && player.username) ? player.username : player;
    if (name && name !== bot.username) {
      updatePlayerCount(name, bot);
      checkMail(bot, name);
    }
  });
  bot.on('playerJoin', player => {
    const name = (player && player.username) ? player.username : player;
    if (name && name !== bot.username) {
      updatePlayerCount(name, bot);
      checkMail(bot, name);
    }
  });

  bot.on('kicked', (reason) => {
    console.log('Kicked for:', reason);
    if (rejoinAttempts < config.reconnect.attempts) {
      rejoinAttempts += 1;
      setTimeout(() => startBot(), config.reconnect.delay);

    } else {
      console.log('Max rejoins reached. Exiting.');
      process.exit(1);
    }
  });

  bot.on('error', (err) => {
    console.error('Bot error', err);
  });

  bot.on('end', () => {
    console.log(`Bot disconnected. Reconnecting in ${config.reconnect.delay / 1000}s...`);
    setTimeout(() => startBot(), config.reconnect.delay);
  });

  return bot;
}

startBot();

