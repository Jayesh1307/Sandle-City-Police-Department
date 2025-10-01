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
// 2. DISCORD BOT CLIENT SETUP
// ----------------------------------------------------------------
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// ----------------------------------------------------------------
// 3. SLASH COMMAND REGISTRATION
// ----------------------------------------------------------------

// Function to handle slash command registration
async function registerSlashCommands() {
    // Requires DISCORD_TOKEN and CLIENT_ID set in Render environment variables
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
        //     options: [ /* ... your options ... */ ]
        // }
    ];

    if (!clientId) {
        console.error("❌ ERROR: CLIENT_ID environment variable is missing. Cannot register commands.");
        return;
    }

    try {
        const rest = new REST({ version: '10' }).setToken(token);
        console.log('Started refreshing application (/) commands.');
        
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('❌ Failed to register slash commands during startup:', error);
    }
}

// ----------------------------------------------------------------
// 4. CLIENT READY & INITIALIZATION
// ----------------------------------------------------------------

// Event fired when the Discord client is fully ready
client.on('clientReady', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    
    // 1. Register Slash Commands
    await registerSlashCommands(); 
    
    // 2. Roblox login logic
    if (process.env.ROBLOX_COOKIE) {
        try {
            // This relies on the fresh cookie you just updated.
            const currentUser = await noblox.setCookie(process.env.ROBLOX_COOKIE);
            console.log(`✅ Logged into Roblox as ${currentUser.UserName} (${currentUser.UserID})`);
        } catch (error) {
            // If this fails, the cookie is bad. You must update it in Render.
            console.error('❌ Failed to log into Roblox. Commands depending on Roblox WILL FAIL:', error);
        }
    }
    
    console.log('Bot initialization complete.');
}); 

// ----------------------------------------------------------------
// 5. INTERACTION HANDLING LOGIC
// ----------------------------------------------------------------

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const commandName = interaction.commandName;

    // A. Fast Command: /ping
    if (commandName === 'ping') {
        await interaction.reply({ content: 'Pong! The bot is responding.', ephemeral: true });
        return; 
    }

    // B. SLOW COMMANDS (Require Deferral to prevent "Application did not respond")
    try {
        // Send "Bot is thinking..." message immediately to avoid timeout
        await interaction.deferReply({ ephemeral: false }); 
    } catch (e) {
        // If deferral fails, the command is already timed out or invalid
        console.error(`Failed to defer reply for /${commandName}:`, e);
        return;
    }
    
    // C. Command execution logic
    try {
        if (commandName === 'rank') {
            // ************ // YOUR ROBLOX RANKING LOGIC GOES HERE 
            // ************ // Example placeholder response:
            await interaction.editReply({ content: 'Rank command is ready to be implemented!', ephemeral: true });

        } else if (commandName === 'patrol') {
            // ************ // YOUR /PATROL LOGIC GOES HERE 
            // ************ // Example placeholder response:
            await interaction.editReply({ content: 'Patrol command is ready to be implemented!', ephemeral: true });

        } else {
            // Handle any command that exists in Discord but isn't handled here
            await interaction.editReply({ content: `Unknown command: /${commandName}`, ephemeral: true });
        }
        
    } catch (error) {
        // Catch any error during command execution (e.g., Roblox error)
        console.error(`CRITICAL ERROR during /${commandName}:`, error);
        await interaction.editReply({ 
            content: '❌ An internal error occurred while running the command. Please check the logs.', 
            ephemeral: true 
        });
    }
});


// ----------------------------------------------------------------
// 6. START BOT
// ----------------------------------------------------------------
// Log in to Discord
client.login(process.env.DISCORD_TOKEN);
