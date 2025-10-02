import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import express from 'express';
import 'dotenv/config'; 
import noblox from 'noblox.js'; 

// ----------------------------------------------------------------
// 1. KEEP-ALIVE SERVER SETUP (For Hosting)
// ----------------------------------------------------------------
const app = express();
// The port is usually provided by the hosting service (3000 for Replit/Render)
const port = process.env.PORT || 3000; 

app.get('/', (req, res) => {
    res.send('Discord Bot is alive and running!');
});

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

// --- DEFINE YOUR RANK CHOICES HERE ---
// You MUST customize these with your group's actual ranks and IDs.
const RANK_CHOICES = [
    { name: 'Trainee', value: 1 },
    { name: 'Officer', value: 5 },
    { name: 'Sergeant', value: 10 },
    { name: 'Lieutenant', value: 15 },
    // ADD ALL YOUR RANKS HERE
];

async function registerSlashCommands() {
    const token = process.env.DISCORD_TOKEN;
    const clientId = process.env.CLIENT_ID; 

    const commands = [
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
                    .setDescription('Select the target rank.')
                    // ADD THE CHOICES HERE TO MAKE RANKS APPEAR IN DISCORD
                    .setChoices(...RANK_CHOICES) 
                    .setRequired(true))
            .toJSON(),
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
    
    await registerSlashCommands(); 
    
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

    // NO /ping command handling is present here.

    // All slow commands (like /rank) must defer the reply
    try {
        await interaction.deferReply({ ephemeral: false }); 
    } catch (e) {
        console.error(`Failed to defer reply for /${commandName}:`, e);
        return;
    }
    
    // Command execution logic
    try {
        if (commandName === 'rank') {
            
            // 1. Get the command options
            const targetUsername = interaction.options.getString('username'); 
            const targetRankId = interaction.options.getInteger('rankid'); 

            // **!!! REPLACE with your actual Roblox Group ID !!!**
            const groupId = 1234567; // <-- CHANGE THIS TO YOUR GROUP ID

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
