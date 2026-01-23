const fs = require('fs');
const path = require('path');
const mineflayer = require('mineflayer');
const { pathfinder } = require('mineflayer-pathfinder');
const pvp = require('mineflayer-pvp').plugin;
const Filter = require('bad-words');
const filter = new Filter();
const { COMMANDS } = require('./commands');

const DATA_FILE = path.join(__dirname, 'players.json');
const OPTIONS = {
  host: 'localhost',
  port: 25565,
  username: 'Bot'
};

let rejoinAttempts = 0;

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

  bot.on('spawn', () => {
    console.log(`${OPTIONS.username} spawned.`);
    bot.chat('Bot active!');
  });

  bot.on('chat', (username, message) => {
    try {
      if (username === bot.username) return;

      const isProfane = filter.isProfane(message);
      if (isProfane) {
        bot.whisper(username, 'Please avoid using profanity.');
        // still process command if starts with '!'
        if (!message.startsWith('!')) return;
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
