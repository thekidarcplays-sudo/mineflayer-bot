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
    guard: cmd_guard
};
