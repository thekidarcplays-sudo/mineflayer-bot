const randomWords = require('random-words');
const { faker } = require('@faker-js/faker');
const axios = require('axios');

const mcDataModule = require('minecraft-data');
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
  const cmds = Object.keys(COMMANDS).sort();
  bot.whisper(username, 'Available commands: ' + cmds.join(', '));
}

async function cmd_gpt(bot, username, args) {
  if (!args || args.length === 0) {
    bot.whisper(username, 'Please provide a prompt for GPT.');
    return;
  }
  const prompt = encodeURIComponent(args.join(' '));
  try {
    const res = await axios.get(`https://text.pollinations.ai/text/${prompt}`);
    const answer = res.data;
    bot.whisper(username, String(answer).slice(0, 300));
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


async function cmd_give(bot, username, args) {
  if (!args || args.length === 0) {
    bot.whisper(username, 'Usage: !give <item> [count]');
    return;
  }

  const mcData = mcDataModule(bot.version);
  const rawName = args[0].toLowerCase();
  const count = Math.max(1, parseInt(args[1]) || 1);

  // normalize candidate names
  const normalize = name => name.replace(/\s+/g, '_').replace(/-/g, '_');
  const nameKey = normalize(rawName);

  const itemDef = mcData.itemsByName[nameKey] || mcData.itemsByName[nameKey + 's'];
  if (!itemDef) {
    bot.whisper(username, `Unknown item: ${args[0]}`);
    return;
  }

  const player = bot.players[username];
  if (!player || !player.entity) {
    bot.whisper(username, "I can't see you to give the item!");
    return;
  }

  // check inventory
  const invItems = bot.inventory.items();
  let have = 0;
  let invItem = null;
  for (const it of invItems) {
    if (it.type === itemDef.id) {
      have += it.count;
      invItem = it;
    }
  }

  if (have < count) {
    bot.whisper(username, `I have ${have} ${args[0]}. Trying to obtain ${count - have} more...`);

    // Try crafting using recipe if available
    try {
      const recipes = bot.recipesFor ? bot.recipesFor(itemDef.id) : [];
      if (recipes && recipes.length) {
        // try to craft missing amount
        const recipe = recipes[0];
        // find crafting table if required
        let craftingTable = null;
        try {
          craftingTable = bot.findBlock({ matching: b => b.name && b.name.includes('crafting_table'), maxDistance: 32 });
        } catch (e) { craftingTable = null; }
        await bot.craft(recipe, count - have, craftingTable || null);
      } else {
        // fallback: try mining common raw materials for simple items (logs -> planks/sticks, stone)
        const n = nameKey;
        if (n.includes('plank') || n === 'stick') {
          // mine any log
          const logIds = Object.keys(mcData.blocks).filter(k => k.endsWith('_log')).map(k => mcData.blocksByName[k]?.id).filter(Boolean);
          const block = bot.findBlock({ matching: b => logIds.includes(b.type), maxDistance: 64 });
          if (block) {
            const { GoalNear } = require('mineflayer-pathfinder').goals;
            await bot.pathfinder.goto(new GoalNear(block.position.x, block.position.y, block.position.z, 1));
            await bot.dig(block);
            // attempt craft again
            const recipes2 = bot.recipesFor ? bot.recipesFor(itemDef.id) : [];
            if (recipes2 && recipes2.length) await bot.craft(recipes2[0], count - have);
          }
        } else if (n === 'cobblestone' || n === 'stone') {
          const stoneId = mcData.blocksByName.stone && mcData.blocksByName.stone.id;
          if (stoneId) {
            const block = bot.findBlock({ matching: stoneId, maxDistance: 64 });
            if (block) {
              const { GoalNear } = require('mineflayer-pathfinder').goals;
              await bot.pathfinder.goto(new GoalNear(block.position.x, block.position.y, block.position.z, 1));
              await bot.dig(block);
            }
          }
        }
      }
    } catch (err) {
      console.error('cmd_give obtain error', err);
    }
  }

  // refresh inventory lookup
  const finalItem = bot.inventory.items().find(i => i.type === itemDef.id);
  const finalCount = finalItem ? finalItem.count : 0;
  if (!finalCount) {
    bot.whisper(username, `I couldn't obtain any ${args[0]}.`);
    return;
  }

  // go to player and drop
  try {
    const { GoalNear } = require('mineflayer-pathfinder').goals;
    await bot.pathfinder.goto(new GoalNear(player.entity.position.x, player.entity.position.y, player.entity.position.z, 2));
    const giveCount = Math.min(count, finalCount);
    await bot.toss(finalItem.type, null, giveCount);
    bot.whisper(username, `Dropped ${giveCount} ${args[0]} near you.`);
  } catch (err) {
    console.error('cmd_give give error', err);
    bot.whisper(username, 'Failed to give the item.');
  }
}



// Keep original mapping keys; add a more common '!say' alias too
const COMMANDS = {
  '!randomword': cmd_randomword,
  '!hello': cmd_hello,
  '!info': cmd_info,
  '!help': cmd_help,
  '!gpt': cmd_gpt,
  '!randomsentence': cmd_randomsentence,
  '!stop': cmd_stop,
  '!sat': cmd_say,
  '!say': cmd_say,
  '!give': cmd_give,
  '!fight': cmd_fight,
  '!randomnumber': cmd_randomnumber
};

module.exports = { COMMANDS };
