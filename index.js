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
    // We get the token and client ID from the client object after it's logged in.
    const token = process.env.DISCORD_TOKEN;
    const clientId = client.user.id; 
    
    // Define your slash commands here (replace with your actual command array)
    // NOTE: You must populate this array with all your commands for them to register!
    const commands = [
        {
            name: 'ping',
            description: 'Replies with Pong!',
        },
        // ADD YOUR OTHER SLASH COMMAND DEFINITIONS HERE (e.g., /rank, /patrol, etc.)
    ];

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
        // Log the error but don't crash the bot
        console.error('Failed to register slash commands during startup:', error);
    }
}

// **FIXED:** Changed 'ready' to 'clientReady' and ensured function closure.
client.on('clientReady', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    
    // Slash Command Registration is now called here.
    await registerSlashCommands(); 
    
    // Roblox login logic
    if (process.env.ROBLOX_COOKIE) {
        try {
            // Note: The variable name for the Roblox Cookie should match what you set in Render
            const currentUser = await noblox.setCookie(process.env.ROBLOX_COOKIE);
            console.log(`✅ Logged into Roblox as ${currentUser.UserName} (${currentUser.UserID})`);
        } catch (error) {
            console.error('❌ Failed to log into Roblox:', error);
        }
    }
    
    console.log('Bot initialization complete.');
}); // <-- THIS CLOSING BRACE WAS MISSING

// Add your command and interaction listeners here...
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'ping') {
        await interaction.reply({ content: 'Pong!', ephemeral: true });
    }
    // Add your command handling logic here...
});


// Log in to Discord
// Make sure you have DISCORD_TOKEN set in Render environment variables
client.login(process.env.DISCORD_TOKEN); // <-- THIS LOGIN CALL WAS MISSING
