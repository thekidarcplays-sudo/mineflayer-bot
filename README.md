# Mineflayer AI Bot

A feature-rich Minecraft bot built with Node.js and **Mineflayer**. This bot includes advanced AI chat capabilities, utility commands, minigames, and pathfinding.

##  Features

*   **Intelligent AI Chat**: Talk to the bot using `!ai` or by whispering. It remembers context!
*   **Pathfinding**: The bot can follow you (`!follow`) or move to coordinates.
*   **Minigames**: "Guess the word" game runs automatically in chat.
*   **Utility**: Weather, News, Math, Wikipedia, and more.
*   **Fun**: Jokes, Facts, Anime Quotes, Leetspeak converter.
*   **PvP**: Basic self-defense and `!fight` command.

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


*...and many more! Try `!help` in-game.*

## AI Features

*   **Public Chat**: Use `!ai <question>` to get a public response.
*   **Whisper**: Whisper the bot anything (that isn't a command) to chat privately with the AI.

## Contributing
There are testing tools in the `testing_tools` folder if you don't have Minecraft and still would like to contribute or if you don't want to open Minecraft.
`args` in `commands.js` is a object.
If you add any new commands, add them to the `COMMANDS` object in `commands.js` and `COMMAND_INFO` object in `commands.js`.
If anything you add makes a new file, add that file to the gitignore.
If you are saving usernames, don't use it on its own, use the UUID of the player via the getPlayerUUID(bot, username) function.