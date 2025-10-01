import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import express from 'express';
import 'dotenv/config'; 
import noblox from 'noblox.js'; 

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
    // Uses DISCORD_TOKEN and CLIENT_ID from Render environment variables
    const token = process.env.DISCORD_TOKEN;
    const clientId = process.env.CLIENT_ID; 

    // --- IMPORTANT: DEFINE YOUR SLASH COMMANDS HERE ---
    const commands = [
        {
            name: 'ping',
            description: 'Replies with Pong!',
        },
        // ADD ALL YOUR OTHER SLASH COMMAND DEFINITIONS HERE (e.g., /rank, /patrol)
        // Example:
        // {
        //     name: 'rank',
        //     description: 'Ranks a user in the Roblox group.',
        //     options: [
        //         // ... your options
        //     ]
        // }
    ];

    if (!clientId) {
        console.error("❌ ERROR: CLIENT_ID environment variable is missing. Cannot register commands.");
        return;
    }

    try {
        const rest = new REST({ version: '10' }).setToken(token);

        console.log('Started refreshing application (/) commands.');
        
        // Register commands globally
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('❌ Failed to register slash commands during startup:', error);
    }
}

// Event fired when the Discord client is fully ready
client.on('clientReady', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    
    // Slash Command Registration is called here.
    await registerSlashCommands(); 
    
    // Roblox login logic
    if (process.env.ROBLOX_COOKIE) {
        try {
            // Ensure ROBLOX_COOKIE is set in Render environment variables
            const currentUser = await noblox.setCookie(process.env.ROBLOX_COOKIE);
            console.log(`✅ Logged into Roblox as ${currentUser.UserName} (${currentUser.UserID})`);
        } catch (error) {
            console.error('❌ Failed to log into Roblox:', error);
        }
    }
    
    console.log('Bot initialization complete.');
}); 

// ----------------------------------------------------------------
// 3. INTERACTION HANDLING LOGIC
// ----------------------------------------------------------------
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'ping') {
        await interaction.reply({ content: 'Pong! The bot is responding.', ephemeral: true });
    }
    // IMPORTANT: Add all your command handling logic here!
    // Example:
    // if (interaction.commandName === 'rank') {
    //     // ... your ranking code
    // }
});


// Log in to Discord
client.login(process.env.DISCORD_TOKEN);
