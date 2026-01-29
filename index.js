const { spawn } = require('child_process');

console.log('🚀 Initializing Mineflayer Bot Launcher...');

function startBot() {
    console.log('Starting bot process...');
    const child = spawn('node', ['bot.js'], { stdio: 'inherit', shell: true });

    child.on('close', (code) => {
        console.log(`Bot process exited with code ${code}.`);
        console.log('🔄 Restarting in 5 seconds...');
        setTimeout(startBot, 5000);
    });

    child.on('error', (err) => {
        console.error('Failed to start bot process:', err);
    });
}

startBot();
