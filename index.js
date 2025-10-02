import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
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
    const token = process.env.DISCORD_TOKEN;
    const clientId = process.env.CLIENT_ID; 

    // --- IMPORTANT: DEFINE YOUR SLASH COMMANDS HERE ---
    const commands = [
        {
            name: 'ping',
            description: 'Replies with Pong!',
        },
        // **RANK COMMAND DEFINITION**
        new SlashCommandBuilder()
            .setName('rank')
            .setDescription('Ranks a Roblox user in the Sandle City Police Group.')
            .addStringOption(option =>
                option.setName('username')
                    .setDescription('The Roblox username of the person to rank.')
                    .setRequired(true))
            .addIntegerOption(option =>
                option.setName('rankid')
                    .setDescription('The Roblox rank ID (e.g., 5 for Officer).')
                    .setRequired(true))
            .toJSON(),
        // ADD OTHER COMMANDS HERE (if any)
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

client.on('clientReady', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    
    // 1. Register Slash Commands
    await registerSlashCommands(); 
    
    // 2. Roblox login logic
    if (process.env.ROBLOX_COOKIE) {
        try {
            const currentUser = await noblox.setCookie(process.env.ROBLOX_COOKIE);
            console.log(`✅ Logged into Roblox as ${currentUser.UserName} (${currentUser.UserID})`);
        } catch (error) {
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
        await interaction.deferReply({ ephemeral: false }); 
    } catch (e) {
        console.error(`Failed to defer reply for /${commandName}:`, e);
        return;
    }
    
    // C. Command execution logic
    try {
        if (commandName === 'rank') {
            
            // 1. Get the command options
            const targetUsername = interaction.options.getString('username'); 
            const targetRankId = interaction.options.getInteger('rankid'); 

            // **!!! REPLACE with your actual Roblox Group ID !!!**
            const groupId = 35844460; // <-- CHANGE THIS TO YOUR GROUP ID

            // 2. Look up the Roblox User ID
            const targetUserId = await noblox.getIdFromUsername(targetUsername);

            if (!targetUserId) {
                await interaction.editReply({ 
                    content: `❌ Roblox user **${targetUsername}** not found.`, 
                    ephemeral: true 
                });
                return;
            }

            // 3. Set the Rank
            await noblox.setRank({ 
                group: groupId, 
                target: targetUserId, 
                rank: targetRankId 
            });

            // 4. Send Success Message
            await interaction.editReply({ 
                content: `✅ Successfully ranked **${targetUsername}** to rank ID **${targetRankId}**!`, 
                ephemeral: false 
            });

        } else {
            // Fallback for any unhandled command
            await interaction.editReply({ content: `Unknown command: /${commandName}`, ephemeral: true });
        }
        
    } catch (error) {
        // Catch any error during command execution (e.g., Roblox error)
        console.error(`CRITICAL ERROR during /${commandName}:`, error);
        await interaction.editReply({ 
            content: `❌ Failed to execute /${commandName}. Error: ${error.message || 'Check bot logs.'}`, 
            ephemeral: true 
        });
    }
});


// ----------------------------------------------------------------
// 6. START BOT
// ----------------------------------------------------------------
client.login(process.env.DISCORD_TOKEN);
