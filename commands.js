const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const db = require('./database');
const svc = require('./services');
const act = require('./actions');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const OWNER = config.owner;

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
    bot.whisper(username, 'Available: ' + cmds.join(', '));
    bot.whisper(username, "Type !help [command] for more info.");
  }
}

async function cmd_say(bot, username, args) {
  if (!args || args.length === 0) return;
  bot.chat(args.join(' '));
}

const COMMANDS = {
  '!math': svc.math,
  '!food': svc.food,
  '!news': svc.news,
  '!weather': svc.weather,
  '!ping': (bot, username) => bot.whisper(username, (bot.player?.ping ?? 'Unknown') + 'ms'),
  '!animequote': svc.animeQuote,
  '!fact': svc.fact,
  '!base64': (bot, username, args) => {
    if (args.length < 2) return;
    const action = args[0].toLowerCase();
    const text = args.slice(1).join(' ');
    if (action === 'encode') bot.whisper(username, Buffer.from(text).toString('base64'));
    else if (action === 'decode') bot.whisper(username, Buffer.from(text, 'base64').toString('utf8'));
  },
  '!dogfact': svc.dogfact,
  '!catfact': svc.catfact,
  '!leet': svc.leet,
  '!joke': svc.joke,
  '!summary': svc.summarizer,
  '!wiki': svc.wiki,
  '!wikipedia': svc.wiki,
  '!randomword': svc.randomWord,
  '!hello': svc.hello,
  '!info': svc.info,
  '!help': cmd_help,
  '!ai': svc.ai.chat,
  '!randomsentence': svc.randomSentence,
  '!randomnumber': svc.randomNumber,
  '!trng': svc.trng,
  '!say': cmd_say,

  // Database Commands
  '!wins': (bot, username, args) => {
    const target = args[0] || username;
    bot.whisper(username, `${target} has ${db.wins.get(target)} wins.`);
  },
  '!leaderboard': (bot, username) => {
    const lb = db.wins.leaderboard();
    if (lb.length === 0) return bot.whisper(username, 'No wins yet.');
    bot.whisper(username, 'Top Winners: ' + lb.map((e, i) => `${i + 1}. ${e[0]}: ${e[1]}`).join(', '));
  },
  '!clearwins': (bot, username) => {
    if (username !== OWNER) return;
    db.wins.clear();
    bot.chat('🏆 Wins cleared.');
  },
  '!timescursed': (bot, username, args) => {
    const target = args[0] || username;
    bot.whisper(username, `${target} has cursed ${db.curses.getCount(target)} times.`);
  },
  '!mail': (bot, username, args) => {
    if (args.length < 2) return;
    db.mail.add(args[0], { from: username, message: args.slice(1).join(' '), timestamp: new Date().toLocaleString() });
    bot.whisper(username, `Mail sent to ${args[0]}.`);
  },
  '!readmail': (bot, username) => {
    const msgs = db.mail.get(username);
    if (msgs.length === 0) return bot.whisper(username, 'No mail.');
    msgs.forEach((m, i) => bot.whisper(username, `${i + 1}. From ${m.from}: ${m.message}`));
  },
  '!clearmail': (bot, username) => {
    db.mail.clear(username);
    bot.whisper(username, 'Mailbox cleared.');
  },
  '!sethome': (bot, username) => {
    db.homes.set(username, bot.entity.position);
    bot.whisper(username, '🏠 Home set!');
  },
  '!home': (bot, username) => {
    const pos = db.homes.get(username);
    if (!pos) return bot.whisper(username, 'No home set.');
    bot.whisper(username, `📍 Home: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`);
  },
  '!delhome': (bot, username) => {
    db.homes.delete(username);
    bot.whisper(username, '🏠 Home deleted.');
  },
  '!seen': (bot, username, args) => {
    if (!args[0]) return;
    const target = args[0];
    if (bot.players[target]) return bot.whisper(username, `${target} is online.`);
    const count = db.players.getJoinCount(target);
    if (count > 0) bot.whisper(username, `${target} seen (Join count: ${count}).`);
    else bot.whisper(username, `Never seen ${target}.`);
  },

  // Action Commands
  '!follow': act.follow,
  '!fight': act.fight,
  '!stop': act.stop,
  '!goto': (bot, username, args) => {
    if (username !== OWNER) return;
    act.goto(bot, username, args, db.bookmarks);
  },
  '!mine': act.mine,
  '!protect': act.protect,
  '!trash': (bot, username) => {
    if (username !== OWNER) return;
    bot.inventory.items().forEach(item => bot.tossStack(item));
  },
  '!drop': (bot, username) => bot.heldItem ? bot.tossStack(bot.heldItem) : bot.whisper(username, 'Nothing in hand.'),

  // Service/Bot State
  '!inventory': svc.inventory,
  '!stats': svc.stats,
  '!coords': svc.coords,
  '!status': svc.status,
  '!exchange': svc.exchange,
  '!hand': svc.hand,
  '!near': svc.near,
  '!players': svc.players,
  '!broadcast': svc.broadcast,
  '!bookmark': (bot, username, args) => {
    if (username !== OWNER || !args[0]) return;
    db.bookmarks.set(args[0], bot.entity.position);
    bot.whisper(username, `Bookmark "${args[0]}" saved!`);
  },
  '!log': (bot, username) => {
    if (username !== OWNER) return;
    const data = fs.readFileSync(path.join(__dirname, config.files.chatLogs), 'utf8');
    data.split('\n').filter(l => l.trim()).slice(-5).forEach(l => bot.whisper(username, l));
  },
  '!newchat': svc.ai.newChat,
  '!savechat': svc.ai.saveChat,
  '!loadchat': svc.ai.loadChat,
  '!listchats': svc.ai.listChats,
  '!restartbot': () => process.exit(1),
  '!togglechatgames': (bot, username) => {
    if (username !== OWNER) return;
    config.game.enabled = !config.game.enabled;
    fs.writeFileSync(path.join(__dirname, 'config.json'), JSON.stringify(config, null, 2));
    bot.chat(`🎮 Chat games ${config.game.enabled ? 'ENABLED' : 'DISABLED'}.`);
  },
  '!fetchforupdates': (bot, username) => {
    if (username !== OWNER) return;
    bot.chat('⬇️ Fetching updates...');
    exec('git pull', (err) => bot.chat(err ? '❌ Error.' : '✅ Done. !restartbot to apply.'));
  },
  '!autoeat': () => { } // Handled in bot.js
};

const COMMAND_INFO = {
  '!math': { description: 'Evaluates a mathematical expression.', format: '!math [expression]' },
  '!news': { description: 'Shows the latest world news headline.', format: '!news' },
  '!food': { description: 'Searches OpenFoodFacts.', format: '!food [product]' },
  '!weather': { description: 'Shows temperature for a city.', format: '!weather [city]' },
  '!ping': { description: 'Checks bot ping.', format: '!ping' },
  '!animequote': { description: 'Tells a random anime quote.', format: '!animequote' },
  '!fact': { description: 'Tells a random useless fact.', format: '!fact' },
  '!base64': { description: 'Encodes/decodes base64.', format: '!base64 <encode|decode> <text>' },
  '!dogfact': { description: 'Tells a random dog fact.', format: '!dogfact' },
  '!catfact': { description: 'Tells a random cat fact.', format: '!catfact' },
  '!leet': { description: 'Converts text to leetspeak.', format: '!leet [text]' },
  '!joke': { description: 'Tells a random joke.', format: '!joke' },
  '!summary': { description: 'Summarizes text.', format: '!summary [text]' },
  '!wiki': { description: 'Gets Wikipedia page info.', format: '!wiki [word]' },
  '!randomword': { description: 'Generates a random word.', format: '!randomword' },
  '!hello': { description: 'Greets you.', format: '!hello' },
  '!info': { description: 'Shows bot info.', format: '!info' },
  '!help': { description: 'Lists commands or shows details.', format: '!help [command]' },
  '!ai': { description: 'Sends prompt to AI.', format: '!ai [prompt]' },
  '!follow': { description: 'Follows you.', format: '!follow' },
  '!fight': { description: 'Starts combat.', format: '!fight' },
  '!stop': { description: 'Stops movement/combat.', format: '!stop' },
  '!sethome': { description: 'Sets home.', format: '!sethome' },
  '!home': { description: 'Shows home coords.', format: '!home' },
  '!delhome': { description: 'Deletes home.', format: '!delhome' },
  '!seen': { description: 'Shows when player was last online.', format: '!seen <player>' },
  '!wins': { description: 'Shows win count.', format: '!wins [player]' },
  '!leaderboard': { description: 'Shows top winners.', format: '!leaderboard' },
  '!mail': { description: 'Sends mail to player.', format: '!mail <user> <msg>' },
  '!readmail': { description: 'Reads your mail.', format: '!readmail' },
  '!inventory': { description: 'Shows inventory.', format: '!inventory' },
  '!stats': { description: 'Shows bot stats.', format: '!stats' },
  '!coords': { description: 'Owner only: Shows coords.', format: '!coords' },
  '!bookmark': { description: 'Owner only: Saves location.', format: '!bookmark <name>' },
  '!goto': { description: 'Owner only: Travels to bookmark.', format: '!goto <name>' },
  '!clearwins': { description: 'Owner only: Clears all wins.', format: '!clearwins' },
  '!timescursed': { description: 'Shows how many times a player cursed.', format: '!timescursed [player]' },
  '!clearmail': { description: 'Clears your mailbox.', format: '!clearmail' },
  '!protect': { description: 'Follows and defends a player.', format: '!protect <player>' },
  '!mine': { description: 'Mines a specific block type nearby.', format: '!mine <block> [count]' },
  '!trash': { description: 'Owner only: Drops all inventory items.', format: '!trash' },
  '!drop': { description: 'Drops the currently held item.', format: '!drop' },
  '!status': { description: 'Shows bot status, health, and food.', format: '!status' },
  '!exchange': { description: 'Shows current item trade rates.', format: '!exchange' },
  '!hand': { description: 'Shows what the bot is holding.', format: '!hand' },
  '!near': { description: 'Lists nearby entities.', format: '!near' },
  '!players': { description: 'Lists online players.', format: '!players' },
  '!broadcast': { description: 'Sends a shouting message in chat.', format: '!broadcast <message>' },
  '!log': { description: 'Owner only: Shows recent chat logs.', format: '!log' },
  '!newchat': { description: 'Starts a fresh AI conversation.', format: '!newchat' },
  '!savechat': { description: 'Saves current AI conversation.', format: '!savechat <name>' },
  '!loadchat': { description: 'Loads a saved AI conversation.', format: '!loadchat <name>' },
  '!listchats': { description: 'Lists your saved AI conversations.', format: '!listchats' },
  '!restartbot': { description: 'Restarts the bot process.', format: '!restartbot' },
  '!togglechatgames': { description: 'Owner only: Enables/disables chat games.', format: '!togglechatgames' },
  '!fetchforupdates': { description: 'Owner only: Pulls latest code from git.', format: '!fetchforupdates' },
  '!autoeat': { description: 'Toggles automatic eating when hungry.', format: '!autoeat' },
  '!say': { description: 'Makes the bot say something in chat.', format: '!say <message>' },
  '!randomsentence': { description: 'Generates a random sentence.', format: '!randomsentence' },
  '!randomnumber': { description: 'Generates a random number 1-10.', format: '!randomnumber' },
  '!trng': { description: 'Generates a Perlin noise-based random number.', format: '!trng' },
  '!wikipedia': { description: 'Gets Wikipedia page info (alias for !wiki).', format: '!wikipedia <topic>' }
};

module.exports = {
  COMMANDS,
  trackWin: db.wins.track,
  checkMail: (bot, username) => {
    const msgs = db.mail.get(username);
    if (msgs.length > 0) bot.whisper(username, `📬 You have ${msgs.length} mail! Use !readmail.`);
  },
  getPlayerUUID: (bot, username) => bot.players[username]?.uuid || null
};