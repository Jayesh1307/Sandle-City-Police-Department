import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import express from 'express';
import 'dotenv/config'; 
import noblox from 'noblox.js'; // Ensure this is needed and correctly imported

// ----------------------------------------------------------------
// 1. KEEP-ALIVE SERVER SETUP (For Render Free Tier)
// ----------------------------------------------------------------
const app = express();
// Render automatically provides the port in the environment variable PORT
const port = process.env.PORT || 3000; 

// Simple route for the keep-alive service (e.g., UptimeRobot)
app.get('/', (req, res) => {
    // This is the health check endpoint that UptimeRobot will ping
    res.send('Discord Bot is alive and running!');
});

// Start the web server
app.listen(port, () => {
    console.log(`Keep-alive server running on port ${port}`);
});

// ----------------------------------------------------------------
// 2. DISCORD BOT LOGIC 
// ----------------------------------------------------------------
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// Function to handle slash command registration
async function registerSlashCommands() {
    const token = process.env.DISCORD_TOKEN;
    const clientId = client.user.id; // Client ID is needed for registration
    
    // Define your slash commands here (replace with your actual command array)
    const commands = [
        {
            name: 'ping',
            description: 'Replies with Pong!',
        },
        // Add all your other command objects here...
    ];

    try {
        const rest = new REST({ version: '10' }).setToken(token);

        console.log('Started refreshing application (/) commands.');
        
        // This registers the commands globally (or per-guild if you change the route)
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        // Log the error but don't crash the bot
        console.error('Failed to register slash commands during startup:', error);
    }
}

// **FIXED:** Changed 'ready' to 'clientReady' to avoid the DeprecationWarning
client.on('clientReady', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    
    // **FIXED:** Slash Command Registration is now called here.
    // This ensures it runs ONLY ONCE after the client is fully ready.
    await registerSlashCommands(); 
    
    // Add your other initialization code here (e.g., Roblox login logic)
    if (process.env.ROBLOX_COOKIE) {
        try {
            const currentUser = await noblox.setCookie(process.env.ROBLOX_COOKIE);
            console.log(`✅ Logged into Roblox as ${currentUser.UserName} (${currentUser.UserID})`);
        } catch (error) {
            console.error('❌ Failed to log into Roblox:', error);
        }
    }
    
    console.log('Bot initialization complete.');
