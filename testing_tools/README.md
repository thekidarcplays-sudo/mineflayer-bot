# Testing Tools

This directory contains utilities for testing the Mineflayer bot commands.

## Available Tools

### 1. run_command.js

Executes bot commands in a mock environment for testing.

**Usage:**
```bash
node run_command.js [-user <username>] [-online <user1,user2>] <command> [args...]
```

**Examples:**
```bash
node run_command.js -user steve -online alex,herobrine !math 1 + 1
node run_command.js -user tester !hello
node run_command.js !randomword
```

### 2. random_args.js

Generates random arguments for testing purposes.

**Usage:**
```bash
node random_args.js [options]
```

**Options:**
- `-count, -c <number>` - Number of arguments to generate (default: 5)
- `-type, -t <type>` - Type of arguments to generate (default: mixed)
- `-separator, -s <string>` - Separator between arguments (default: space)
- `-cmd <command>` - Execute command with generated args appended
- `-list, -l` - List all available types
- `-help, -h` - Show help message

**Available Types:**
- `word` - Random nouns
- `number` - Random integers (0-99)
- `username` - Random usernames
- `sentence` - Random sentences
- `text` - Random text (3 words)
- `city` - Random city names
- `animal` - Random animal types
- `color` - Random color names
- `email` - Random email addresses
- `url` - Random URLs
- `uuid` - Random UUIDs
- `boolean` - Random true/false
- `float` - Random decimal numbers
- `date` - Random dates
- `time` - Random times
- `phone` - Random phone numbers
- `mixed` - Random combination of types

**Examples:**
```bash
# Generate 5 random mixed arguments
node testing_tools\random_args.js

# Generate 10 random numbers
node testing_tools\random_args.js -count 10 -type number

# Generate 3 usernames
node testing_tools\random_args.js -type username -count 3

# Generate 5 words separated by commas
node testing_tools\random_args.js -c 5 -t word -s ','

# Execute a command with random arguments
node testing_tools\random_args.js -cmd "node testing_tools\run_command.js !randomnumber" -count 1 -type username

# Test command with random city name
node testing_tools\random_args.js -cmd "node testing_tools\run_command.js !weather" -count 1 -type city

# List all available types
node testing_tools\random_args.js -list
```

## Combining Tools

You can combine these tools for comprehensive testing:

```bash
# Generate random numbers for math command
node testing_tools\run_command.js !math $(node testing_tools\random_args.js -c 1 -t number) + $(node testing_tools\random_args.js -c 1 -t number)

# Test with random usernames
node testing_tools\run_command.js -user $(node testing_tools\random_args.js -c 1 -t username) !hello
```
