# Mineflayer AI Bot

A feature-rich Minecraft bot built with Node.js and **Mineflayer**. This bot includes advanced AI chat capabilities, utility commands, minigames, and pathfinding.

##  Features

*   **Intelligent AI Chat**: Talk to the bot using `!ai` or by whispering. It remembers context!
*   **Pathfinding**: The bot can follow you (`!follow`) or move to coordinates.
*   **Minigames**: "Guess the word" game runs automatically in chat.
*   **Utility**: Weather, News, Math, Wikipedia, and more.
*   **Fun**: Jokes, Facts, Anime Quotes, Leetspeak converter.
*   **PvP**: Basic self-defense and `!fight` command.
*   **Auto-Eat**: Automatically eats food from inventory when hungry (`!autoeat` toggle).
*   **Bookmarks**: Save and navigate to coordinates (`!bookmark`, `!goto`).
*   **Mining**: Autonomous resource gathering (`!mine`).
*   **Item Exchange**: Automated barter system where you drop items and get rewards.
*   **Area Guard**: Protects a location from hostiles (`!guard`).
*   **Silent Logging**: Records server deaths to `deaths.json` without chat spam.

## Installation & Usage

1.  **Prerequisites**: Install [Node.js](https://nodejs.org/) (v16+ recommended).
2.  **Download** this bot.
3.  **Start the Bot**:
    ```bash
    node index.js
    ```

This script will automatically restart the bot if it crashes or if you use `!restartbot`.

## Configuration

The bot is configured via `config.json`. You can change the server connection, bot owner, and other settings there.

### `config.json` Options:
- `botOptions`: Server details (`host`, `port`, `username`).
- `owner`: The Minecraft username of the bot owner (for admin commands).
- `files`: Paths for data storage (logs, wins, mail, etc.).
- `game`: Timing settings for the "guess the word" game.
- `reconnect`: Reconnection policy on disconnect or kick.



##  Commands

| Command | Description | Usage |
| :--- | :--- | :--- |
| `!ai` | Ask the AI a question | `!ai <prompt>` |
| `!follow` | Bot follows you | `!follow` |
| `!stop` | Stops following/fighting | `!stop` |
| `!weather` | Real-time weather | `!weather <city>` |
| `!news` | Latest news headline | `!news` |
| `!wiki` | Wikipedia summary | `!wiki <topic>` |
| `!math` | Solve math problems | `!math 2 + 2` |
| `!forget` | Reset AI memory | `!forget` |
| `!leaderboard`| Top win counts | `!leaderboard` |
| `!togglechatgames`| Enable/Disable games | `!togglechatgames`|
| `!help` | List all commands | `!help` |
| `!inventory` | Shows health/food/XP | `!inventory` |
| `!autoeat` | Toggles auto-eating | `!autoeat` |
| `!bookmark` | Saves a named location | `!bookmark <name>` |
| `!goto` | Travels to a bookmark | `!goto <name>` |
| `!protect` | Follows/defends a player | `!protect <name>` |
| `!players` | Lists online players | `!players` |
| `!mine` | Mines specific blocks | `!mine <block> [count]` |
| `!exchange` | Shows trade rates | `!exchange` |
| `!guard` | Guards area (Owner) | `!guard` |
| `!sethome` | Sets your home | `!sethome` |
| `!home` | Whispers home coords | `!home` |
| `!delhome` | Deletes your home | `!delhome` |
| `!seen` | Last active time | `!seen <player>` |
| `!status` | Bot status & stats | `!status` |
| `!trash` | Clear inventory (Owner) | `!trash` |
| `!coords` | Show coordinates (Owner) | `!coords` |
| `!log` | Show recent logs (Owner) | `!log` |
| `!clearwins` | Reset leaderboard (Owner)| `!clearwins` |
| `!broadcast` | Sends shouting message | `!broadcast <msg>` |
| `!coinflip` | Flips a coin | `!coinflip` |
| `!roll` | Rolls dice | `!roll [sides\|NdM]` |
| `!8ball` | Magic 8-Ball answer | `!8ball <question>` |
| `!time` | In-game time (day/night) | `!time` |
| `!uptime` | Bot running time | `!uptime` |


*...and many more! Try `!help` in-game.*

## AI Features

*   **Public Chat**: Use `!ai <question>` to get a public response.
*   **Whisper**: Whisper the bot anything (that isn't a command) to chat privately with the AI.

## Contributing
3. There are testing tools in the `testing_tools` folder if you don't have Minecraft and still would like to contribute or if you don't want to open Minecraft.
4. `args` is a object.
5. If you add any new commands, make sure they are exported and have a description in `commands.js` in the `COMMAND_INFO` list.
6.  If anything you add makes a new file, add that file to the gitignore.
7.  If you are saving usernames, don't use it on its own, use the UUID of the player via the getPlayerUUID(bot, username) function.
8.  For bookmarks/coordinate systems, restrict access to the bot owner to prevent base leaks.