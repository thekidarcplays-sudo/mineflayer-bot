const fs = require('fs');
const path = require('path');
const mineflayer = require('mineflayer');
const { pathfinder } = require('mineflayer-pathfinder');
const pvp = require('mineflayer-pvp').plugin;
const collectBlock = require('mineflayer-collectblock').plugin;
const { deathEventPlugin } = require('mineflayer-death-event');
const Filter = require('bad-words');
const filter = new Filter();
const { COMMANDS, trackWin, checkMail } = require('./commands');
const db = require('./database');
const { faker } = require('@faker-js/faker');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

const DATA_FILE = path.join(__dirname, config.files.players);
const CURSES_FILE = path.join(__dirname, config.files.curses);
const OPTIONS = config.botOptions;


let rejoinAttempts = 0;
let gameWord = null;
let gameActive = false;
let gameTimer = null;
let autoEatEnabled = true;

function checkAutoEat(bot) {
  if (!autoEatEnabled) return;
  if (bot.food < 18) {
    const defaultFoods = [
      'cooked_beef', 'cooked_chicken', 'cooked_porkchop', 'cooked_mutton',
      'cooked_rabbit', 'cooked_cod', 'cooked_salmon', 'bread', 'apple',
      'golden_apple', 'enchanted_golden_apple', 'carrot', 'baked_potato'
    ];
    const foodList = config.foodItems || defaultFoods;
    const food = bot.inventory.items().find(item => foodList.includes(item.name));

    if (food) {
      bot.eat(food).catch(err => console.error('Failed to eat', err));
    }
  }
}

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

// trackCurse and updatePlayerCount are now in database.js

function startBot() {
  const bot = mineflayer.createBot(OPTIONS);
  bot.loadPlugin(pathfinder);
  bot.loadPlugin(pvp);
  bot.loadPlugin(collectBlock);
  bot.loadPlugin(deathEventPlugin);

  bot.once('spawn', () => {
    console.log(`${OPTIONS.username} spawned.`);
    bot.chat('Bot active!');
    rejoinAttempts = 0;
    startGameRound(bot);
  });


  bot.on('chat', (username, message) => {
    try {
      if (username === bot.username) return;
      db.chat.log(username, message);

      const isProfane = filter.isProfane(message);
      if (isProfane) {
        db.curses.track(username);
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
          if (command === '!autoeat') {
            autoEatEnabled = !autoEatEnabled;
            bot.whisper(username, `Auto-eat is now ${autoEatEnabled ? 'enabled' : 'disabled'}.`);
            return;
          }
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
      const count = db.players.incrementJoin(name);
      if (count === 1) bot.chat(`Hello ${name} and welcome!`);
      else bot.chat(`Welcome back ${name}! Join count: ${count}`);
      checkMail(bot, name);
    }
  });
  // 'playerJoin' is an alias used by some versions; guard against double-firing
  bot.on('playerJoin', player => {
    // Handled by 'playerJoined' above -- no-op to avoid duplicate counting
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

  bot.on('playerCollect', (collector, itemEntity) => {
    if (collector !== bot.entity) return;
    if (!config.exchange.enabled) return;

    // Use the registry to get item names from IDs
    const itemMetadata = itemEntity.metadata.find(m => m && typeof m === 'object' && m.present !== undefined);
    if (!itemMetadata) return;

    const itemName = bot.registry.items[itemMetadata.itemId]?.name;
    if (!itemName) return;

    const trade = config.exchange.trades[itemName];
    if (trade) {
      const rewardName = trade.reward;
      const count = trade.count;
      bot.chat(`🔄 Received ${itemName}. Exchanging for ${count}x ${rewardName}...`);

      const rewardItem = bot.inventory.items().find(i => i.name === rewardName);
      if (rewardItem) {
        bot.toss(rewardItem.type, null, count).catch(err => {
          console.error('Exchange toss error', err);
        });
      } else {
        bot.chat(`❌ I don't have enough ${rewardName} to complete the trade!`);
      }
    }
  });

  bot.on('death', () => {
    db.deaths.add({
      timestamp: new Date().toLocaleString(),
      username: bot.username,
      location: bot.entity.position
    });
  });

  bot.on('playerDeath', (data) => {
    db.deaths.add({
      timestamp: new Date().toLocaleString(),
      ...data
    });
  });

  bot.on('end', () => {
    console.log(`Bot disconnected. Reconnecting in ${config.reconnect.delay / 1000}s...`);
    setTimeout(() => startBot(), config.reconnect.delay);
  });

  bot.on('health', () => {
    checkAutoEat(bot);
  });

  return bot;
}

startBot();

