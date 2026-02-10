const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

const FILES = {
    CURSES: path.join(__dirname, config.files.curses),
    GPT_CACHE: path.join(__dirname, config.files.gptCache),
    WINS: path.join(__dirname, config.files.wins),
    MAIL: path.join(__dirname, config.files.mail),
    BOOKMARKS: path.join(__dirname, 'bookmarks.json'),
    DEATHS: path.join(__dirname, config.files.deaths),
    HOMES: path.join(__dirname, config.files.homes),
    PLAYERS: path.join(__dirname, config.files.players),
    CHAT_LOGS: path.join(__dirname, config.files.chatLogs)
};

// Data structures
let data = {
    curses: loadJson(FILES.CURSES),
    gptCache: loadJson(FILES.GPT_CACHE),
    wins: loadJson(FILES.WINS),
    mail: loadJson(FILES.MAIL),
    bookmarks: loadJson(FILES.BOOKMARKS),
    homes: loadJson(FILES.HOMES),
    players: loadJson(FILES.PLAYERS),
    deaths: loadJson(FILES.DEATHS, [])
};

function loadJson(file, defaultVal = {}) {
    if (fs.existsSync(file)) {
        try {
            return JSON.parse(fs.readFileSync(file, 'utf8') || JSON.stringify(defaultVal));
        } catch (err) {
            console.error(`Failed to load ${file}`, err);
        }
    }
    return defaultVal;
}

function saveJson(file, content) {
    try {
        fs.writeFileSync(file, JSON.stringify(content, null, 4), 'utf8');
    } catch (err) {
        console.error(`Failed to save ${file}`, err);
    }
}

// Mail
function saveMail() { saveJson(FILES.MAIL, data.mail); }
function getMail(username) { return data.mail[username] || []; }
function addMail(recipient, mailEntry) {
    if (!data.mail[recipient]) data.mail[recipient] = [];
    data.mail[recipient].push(mailEntry);
    saveMail();
}
function clearMail(username) {
    data.mail[username] = [];
    saveMail();
}

// Homes
function saveHomes() { saveJson(FILES.HOMES, data.homes); }
function getHome(username) { return data.homes[username]; }
function setHome(username, coords) {
    data.homes[username] = coords;
    saveHomes();
}
function deleteHome(username) {
    delete data.homes[username];
    saveHomes();
}

// Bookmarks
function saveBookmarks() { saveJson(FILES.BOOKMARKS, data.bookmarks); }
function getBookmark(name) { return data.bookmarks[name]; }
function setBookmark(name, coords) {
    data.bookmarks[name] = coords;
    saveBookmarks();
}
function listBookmarks() { return Object.keys(data.bookmarks); }

// Wins
function saveWins() { saveJson(FILES.WINS, data.wins); }
function getWins(username) { return data.wins[username] || 0; }
function trackWin(username) {
    data.wins[username] = (data.wins[username] || 0) + 1;
    saveWins();
}
function getWinsLeaderboard() {
    return Object.entries(data.wins)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
}
function clearWins() {
    data.wins = {};
    saveWins();
}

// Curses
function saveCurses() { saveJson(FILES.CURSES, data.curses); }
function getCurseCount(username) { return data.curses[username] || 0; }
function trackCurse(username) {
    data.curses[username] = (data.curses[username] || 0) + 1;
    saveCurses();
}

// Players
function savePlayers() { saveJson(FILES.PLAYERS, data.players); }
function getPlayerJoinCount(username) { return data.players[username] || 0; }
function incrementPlayerJoin(username) {
    const count = (data.players[username] || 0) + 1;
    data.players[username] = count;
    savePlayers();
    return count;
}

// AI Cache
function saveGPTCache() { saveJson(FILES.GPT_CACHE, data.gptCache); }
function getAICache(key) { return data.gptCache[key]; }
function setAICache(key, value) {
    data.gptCache[key] = value;
    saveGPTCache();
}

// Deaths
function addDeath(deathEntry) {
    data.deaths.push(deathEntry);
    saveJson(FILES.DEATHS, data.deaths);
}

// Chat Logs
function logChat(username, message) {
    const timestamp = new Date().toLocaleString();
    const logEntry = `[${timestamp}] ${username}: ${message}\n`;
    fs.appendFile(FILES.CHAT_LOGS, logEntry, (err) => {
        if (err) console.error('Failed to save chat message:', err);
    });
}

module.exports = {
    // Database accessors
    mail: { get: getMail, add: addMail, clear: clearMail },
    homes: { get: getHome, set: setHome, delete: deleteHome },
    bookmarks: { get: getBookmark, set: setBookmark, list: listBookmarks },
    wins: { get: getWins, track: trackWin, leaderboard: getWinsLeaderboard, clear: clearWins },
    curses: { getCount: getCurseCount, track: trackCurse },
    players: { getJoinCount: getPlayerJoinCount, incrementJoin: incrementPlayerJoin },
    aiCache: { get: getAICache, set: setAICache },
    deaths: { add: addDeath },
    chat: { log: logChat },
    // Raw exposure if needed
    data
};
