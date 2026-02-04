const { faker } = require('@faker-js/faker');
const { execSync } = require('child_process');

// Parse arguments
const args = process.argv.slice(2);

// Default values
let count = 5;
let type = 'mixed';
let separator = ' ';
let command = null;

// Available types
const TYPES = {
    'word': () => faker.word.noun(),
    'number': () => Math.floor(Math.random() * 100).toString(),
    'username': () => faker.internet.displayName(),
    'sentence': () => faker.lorem.sentence(),
    'text': () => faker.lorem.words(3),
    'city': () => faker.location.city(),
    'animal': () => faker.animal.type(),
    'color': () => faker.color.human(),
    'email': () => faker.internet.email(),
    'url': () => faker.internet.url(),
    'uuid': () => faker.string.uuid(),
    'boolean': () => Math.random() > 0.5 ? 'true' : 'false',
    'float': () => (Math.random() * 100).toFixed(2),
    'date': () => faker.date.recent().toISOString().split('T')[0],
    'time': () => faker.date.recent().toTimeString().split(' ')[0],
    'phone': () => faker.phone.number(),
    'mixed': () => {
        const types = ['word', 'number', 'text', 'city', 'color'];
        const randomType = types[Math.floor(Math.random() * types.length)];
        return TYPES[randomType]();
    }
};

// Parse command line flags
for (let i = 0; i < args.length; i++) {
    if (args[i] === '-count' || args[i] === '-c') {
        if (i + 1 < args.length) {
            count = parseInt(args[i + 1]);
            if (isNaN(count) || count < 1) {
                console.error('Error: -count must be a positive number');
                process.exit(1);
            }
            i++;
        } else {
            console.error('Error: -count flag requires a value');
            process.exit(1);
        }
    } else if (args[i] === '-type' || args[i] === '-t') {
        if (i + 1 < args.length) {
            type = args[i + 1].toLowerCase();
            if (!TYPES[type]) {
                console.error(`Error: Unknown type "${type}". Available types: ${Object.keys(TYPES).join(', ')}`);
                process.exit(1);
            }
            i++;
        } else {
            console.error('Error: -type flag requires a value');
            process.exit(1);
        }
    } else if (args[i] === '-separator' || args[i] === '-s') {
        if (i + 1 < args.length) {
            separator = args[i + 1];
            i++;
        } else {
            console.error('Error: -separator flag requires a value');
            process.exit(1);
        }
    } else if (args[i] === '-cmd') {
        if (i + 1 < args.length) {
            command = args[i + 1];
            i++;
        } else {
            console.error('Error: -cmd flag requires a command');
            process.exit(1);
        }
    } else if (args[i] === '-help' || args[i] === '--help' || args[i] === '-h') {
        showHelp();
        process.exit(0);
    } else if (args[i] === '-list' || args[i] === '-l') {
        console.log('Available types:');
        Object.keys(TYPES).filter(t => t !== 'mixed').forEach(t => {
            console.log(`  - ${t}`);
        });
        console.log('  - mixed (random combination of types)');
        process.exit(0);
    } else {
        console.error(`Unknown flag: ${args[i]}`);
        console.error('Use -help for usage information');
        process.exit(1);
    }
}

function showHelp() {
    console.log('Random Arguments Generator');
    console.log('');
    console.log('Usage: node random_args.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  -count, -c <number>      Number of arguments to generate (default: 5)');
    console.log('  -type, -t <type>         Type of arguments to generate (default: mixed)');
    console.log('  -separator, -s <string>  Separator between arguments (default: space)');
    console.log('  -cmd <command>           Execute command with generated args appended');
    console.log('  -list, -l                List all available types');
    console.log('  -help, -h                Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  node random_args.js');
    console.log('  node random_args.js -count 10 -type word');
    console.log('  node random_args.js -c 3 -t number -s ,');
    console.log('  node random_args.js -type username -count 5');
    console.log('  node random_args.js -cmd "node run_command.js !math" -count 3 -type number');
    console.log('');
    console.log('Available types: ' + Object.keys(TYPES).join(', '));
}

// Generate random arguments
const randomArgs = [];
for (let i = 0; i < count; i++) {
    randomArgs.push(TYPES[type]());
}

// Output or execute command
if (command) {
    // Build the full command with random args
    const fullCommand = `${command} ${randomArgs.join(separator)}`;
    console.log(`Executing: ${fullCommand}`);
    console.log('---');
    try {
        const output = execSync(fullCommand, {
            encoding: 'utf8',
            stdio: ['inherit', 'pipe', 'pipe']
        });
        console.log(output);
    } catch (error) {
        console.error('Command execution failed:');
        if (error.stdout) console.log(error.stdout);
        if (error.stderr) console.error(error.stderr);
        process.exit(error.status || 1);
    }
} else {
    console.log(randomArgs.join(separator));
}

// If running as a module, export the function
if (require.main !== module) {
    module.exports = {
        generate: (options = {}) => {
            const {
                count: c = 5,
                type: t = 'mixed',
                separator: s = ' '
            } = options;

            const results = [];
            for (let i = 0; i < c; i++) {
                results.push(TYPES[t]());
            }
            return results.join(s);
        },
        TYPES
    };
}
