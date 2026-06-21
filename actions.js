const { goals, Movements } = require('mineflayer-pathfinder');

let guardState = { active: false, pos: null, interval: null };

function stopGuard(bot) {
    if (guardState.interval) clearInterval(guardState.interval);
    guardState = { active: false, pos: null, interval: null };
    try {
        bot.pvp.stop();
        bot.pathfinder.setGoal(null);
    } catch (err) {
        console.error('stopGuard error', err);
    }
}

function cmd_guard(bot, username, args, config) {
    if (guardState.active) {
        stopGuard(bot);
        bot.chat('🛡️ Guard mode disabled.');
        return;
    }
    const gcfg = (config && config.guard) || {};
    const radius = gcfg.radius || 10;
    const attackMobs = gcfg.attackMobs !== false;
    const attackPlayers = gcfg.attackPlayers === true;

    guardState.active = true;
    guardState.pos = bot.entity.position.clone();
    bot.chat(`🛡️ Guarding this area (radius ${radius}).`);

    const defaultMove = new Movements(bot);
    bot.pathfinder.setMovements(defaultMove);

    guardState.interval = setInterval(() => {
        if (!guardState.active || !guardState.pos) return;
        if (bot.pvp.target) return; // Already engaging a target

        const target = bot.nearestEntity(e => {
            if (e === bot.entity) return false;
            if (e.position.distanceTo(guardState.pos) > radius) return false;
            if (attackMobs && e.type === 'mob' && e.kind === 'Hostile mobs') return true;
            if (attackPlayers && e.type === 'player' && e.username !== bot.username) return true;
            return false;
        });

        if (target) {
            bot.pvp.attack(target);
        } else if (bot.entity.position.distanceTo(guardState.pos) > 3) {
            bot.pathfinder.setGoal(new goals.GoalBlock(guardState.pos.x, guardState.pos.y, guardState.pos.z));
        }
    }, 1000);
}

function cmd_follow(bot, username) {
    const player = bot.players[username];
    if (!player || !player.entity) {
        bot.whisper(username, "I can't see you!");
        return;
    }
    bot.chat(`I am now following ${username}.`);
    const defaultMove = new Movements(bot);
    bot.pathfinder.setMovements(defaultMove);
    bot.pathfinder.setGoal(new goals.GoalFollow(player.entity, 2), true);
}

function cmd_fight(bot, username) {
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

function cmd_stop(bot, username) {
    try {
        if (guardState.active) stopGuard(bot);
        bot.pvp.stop();
        bot.pathfinder.setGoal(null);
        bot.chat('Combat and movement terminated.');
    } catch (err) {
        console.error('stop error', err);
    }
}

function cmd_goto(bot, username, args, bookmarks) {
    if (!args || args.length === 0) {
        bot.whisper(username, 'Usage: !goto <bookmark_name>');
        return;
    }
    const name = args[0];
    const pos = bookmarks.get(name);
    if (!pos) {
        bot.whisper(username, `Bookmark "${name}" not found.`);
        return;
    }
    bot.chat(`Navigating to bookmark: ${name}`);
    const defaultMove = new Movements(bot);
    bot.pathfinder.setMovements(defaultMove);
    bot.pathfinder.setGoal(new goals.GoalBlock(pos.x, pos.y, pos.z));
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

function cmd_come(bot, username) {
    const player = bot.players[username];
    if (!player || !player.entity) {
        bot.whisper(username, "I can't see you!");
        return;
    }
    bot.chat(`Coming to you, ${username}.`);
    const defaultMove = new Movements(bot);
    bot.pathfinder.setMovements(defaultMove);
    const { x, y, z } = player.entity.position;
    bot.pathfinder.setGoal(new goals.GoalNear(x, y, z, 1));
}

async function cmd_equip(bot, username, args) {
    if (!args || args.length === 0) {
        bot.whisper(username, 'Usage: !equip <item_name>');
        return;
    }
    const itemName = args[0].toLowerCase();
    const item = bot.inventory.items().find(i => i.name.includes(itemName));
    if (!item) {
        bot.whisper(username, `I don't have "${itemName}".`);
        return;
    }
    let destination = 'hand';
    if (item.name.includes('helmet')) destination = 'head';
    else if (item.name.includes('chestplate') || item.name.includes('elytra')) destination = 'torso';
    else if (item.name.includes('leggings')) destination = 'legs';
    else if (item.name.includes('boots')) destination = 'feet';
    else if (item.name.includes('shield')) destination = 'off-hand';
    try {
        await bot.equip(item, destination);
        bot.whisper(username, `Equipped ${item.name} (${destination}).`);
    } catch (err) {
        console.error('equip error', err);
        bot.whisper(username, `Failed to equip ${item.name}.`);
    }
}

async function cmd_drop(bot, username, args) {
    // No args: drop whatever is currently in hand.
    if (!args || args.length === 0) {
        if (!bot.heldItem) {
            bot.whisper(username, 'Nothing in hand.');
            return;
        }
        try {
            const held = bot.heldItem;
            await bot.tossStack(held);
            bot.chat(`Dropped ${held.count}x ${held.name}.`);
        } catch (err) {
            console.error('drop error', err);
            bot.whisper(username, 'Failed to drop held item.');
        }
        return;
    }
    const itemName = args[0].toLowerCase();
    const count = parseInt(args[1]) || null;
    const item = bot.inventory.items().find(i => i.name.includes(itemName));
    if (!item) {
        bot.whisper(username, `I don't have "${itemName}".`);
        return;
    }
    try {
        if (count) await bot.toss(item.type, null, count);
        else await bot.tossStack(item);
        bot.chat(`Dropped ${count || item.count}x ${item.name}.`);
    } catch (err) {
        console.error('drop error', err);
        bot.whisper(username, `Failed to drop ${item.name}.`);
    }
}

function cmd_look(bot, username, args) {
    const targetName = (args && args[0]) ? args[0] : username;
    const player = bot.players[targetName];
    if (!player || !player.entity) {
        bot.whisper(username, `I can't see ${targetName}.`);
        return;
    }
    const e = player.entity;
    bot.lookAt(e.position.offset(0, e.height || 1.6, 0));
    bot.whisper(username, `Looking at ${targetName}.`);
}

async function cmd_jump(bot, username) {
    bot.setControlState('jump', true);
    setTimeout(() => bot.setControlState('jump', false), 500);
    bot.chat('Boing!');
}

const DEFAULT_FOODS = [
    'cooked_beef', 'cooked_chicken', 'cooked_porkchop', 'cooked_mutton',
    'cooked_rabbit', 'cooked_cod', 'cooked_salmon', 'bread', 'apple',
    'golden_apple', 'enchanted_golden_apple', 'carrot', 'baked_potato'
];

async function cmd_eat(bot, username, args, foodItems) {
    const foodList = foodItems || DEFAULT_FOODS;
    const food = bot.inventory.items().find(item => foodList.includes(item.name));
    if (!food) {
        bot.whisper(username, "I don't have any food to eat.");
        return;
    }
    try {
        await bot.equip(food, 'hand');
        await bot.consume();
        bot.whisper(username, `Ate ${food.name}.`);
    } catch (err) {
        console.error('eat error', err);
        bot.whisper(username, 'Failed to eat.');
    }
}

function cmd_hunt(bot, username, args) {
    const typeName = (args && args[0]) ? args[0].toLowerCase() : null;
    const target = bot.nearestEntity(e => {
        if (e === bot.entity) return false;
        if (e.type !== 'mob' || e.kind !== 'Hostile mobs') return false;
        if (e.position.distanceTo(bot.entity.position) > 16) return false;
        if (typeName && !(e.name || e.displayName || '').toLowerCase().includes(typeName)) return false;
        return true;
    });
    if (!target) {
        bot.whisper(username, typeName ? `No ${typeName} nearby.` : 'No hostile mobs nearby.');
        return;
    }
    const name = target.name || target.displayName || 'mob';
    bot.chat(`⚔️ Hunting ${name}!`);
    try {
        bot.pvp.attack(target);
    } catch (err) {
        console.error('hunt error', err);
    }
}

function cmd_protect(bot, username, args) {
    if (!args || args.length === 0) {
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
    bot.chat(`Protecting ${name}!`);
    const defaultMove = new Movements(bot);
    bot.pathfinder.setMovements(defaultMove);
    bot.pathfinder.setGoal(new goals.GoalFollow(player.entity, 2), true);
}

module.exports = {
    follow: cmd_follow,
    fight: cmd_fight,
    stop: cmd_stop,
    goto: cmd_goto,
    mine: cmd_mine,
    protect: cmd_protect,
    guard: cmd_guard,
    come: cmd_come,
    equip: cmd_equip,
    drop: cmd_drop,
    look: cmd_look,
    jump: cmd_jump,
    eat: cmd_eat,
    hunt: cmd_hunt
};
