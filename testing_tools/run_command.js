const { COMMANDS } = require('../commands.js');

// Parse arguments
const args = process.argv.slice(2);
let username = 'tester';
let commandArgs = [];
let onlineUsers = [];

// Parse flags
for (let i = 0; i < args.length; i++) {
    if (args[i] === '-user') {
        if (i + 1 < args.length) {
            username = args[i + 1];
            i++;
        } else {
            console.error('Error: -user flag requires a username');
            process.exit(1);
        }
    } else if (args[i] === '-online') {
        if (i + 1 < args.length) {
            onlineUsers = args[i + 1].split(',');
            i++;
        } else {
            console.error('Error: -online flag requires a list of users');
            process.exit(1);
        }
    } else {
        commandArgs.push(args[i]);
    }
}

if (commandArgs.length === 0) {
    console.log('Usage: node run_command.js [-user <username>] [-online <user1,user2>] <command> [args...]');
    console.log('Example: node run_command.js -user steve -online alex,herobrine !math 1 + 1');
    process.exit(0);
}

const commandName = commandArgs[0];
const cmdFunc = COMMANDS[commandName] || COMMANDS['!' + commandName]; // Handle with/without !

if (!cmdFunc) {
    console.error(`Command not found: ${commandName}`);
    process.exit(1);
}

// Mock Bot Object
const playersMock = {};
// Add current user
playersMock[username] = {
    username: username,
    entity: { position: { x: 0, y: 0, z: 0 } }
};
// Add other online users
onlineUsers.forEach(u => {
    playersMock[u] = {
        username: u,
        entity: { position: { x: 0, y: 0, z: 0 } }
    };
});

// Load Minecraft Data for registry
let registry;
try {
    const mcData = require('minecraft-data');
    registry = mcData('1.20.1'); // Default to recent version
} catch (e) {
    console.warn('Warning: minecraft-data not found, some commands may fail.');
    registry = {
        blocksByName: new Proxy({}, { get: () => ({ id: 0 }) }),
        itemsByName: new Proxy({}, { get: () => ({ id: 0 }) })
    };
}

const bot = {
    version: '1.20.1',
    registry: registry,
    whisper: (target, message) => {
        console.log(`[WHISPER to ${target}]: ${message}`);
    },
    chat: (message) => {
        console.log(`[CHAT]: ${message}`);
    },
    players: playersMock,
    pvp: {
        attack: (entity) => {
            console.log(`[PVP]: Attacking entity ${entity}`);
        },
        stop: () => {
            console.log(`[PVP]: Stopping combat`);
        }
    },
    pathfinder: {
        setMovements: (movements) => {
            console.log(`[PATHFINDER]: Setting movements`);
        },
        setGoal: (goal) => {
            console.log(`[PATHFINDER]: Setting goal to ${goal}`);
        }
    },
    // Mock player for ping command
    player: {
        ping: 50
    }
};

// Execute
console.log(`Executing ${commandName} as ${username}...`);
try {
    // Pass everything after the command name as args to the function
    const funcArgs = commandArgs.slice(1);
    cmdFunc(bot, username, funcArgs);
} catch (error) {
    console.error(`Error executing command:`, error);
}
