import { Client, GatewayIntentBits } from 'discord.js';
import express from 'express';
import 'dotenv/config'; // Make sure to use 'dotenv/config' or manually load environment variables

// --- 1. KEEP-ALIVE SERVER SETUP ---
const app = express();
// Render automatically provides the port in the environment variable PORT
const port = process.env.PORT || 3000; 

// Simple route for the keep-alive service (e.g., UptimeRobot)
app.get('/', (req, res) => {
    // Send a response to confirm the server is running
    res.send('Discord Bot is alive and running!');
});

// Start the web server
app.listen(port, () => {
    console.log(`Keep-alive server running on port ${port}`);
});


// --- 2. DISCORD BOT LOGIC ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    // Your initialization code here (e.g., clearing commands, refreshing application commands)
    console.log('Bot initialization complete.');
});

// Add your other bot event listeners and functions here...
// For example:
// client.on('messageCreate', (message) => {
//     // ... your message handling code
// });

// Log in to Discord
client.login(process.env.DISCORD_TOKEN);
