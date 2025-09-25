import 'dotenv/config';
import express from 'express';
import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import noblox from 'noblox.js';

// Environment variables
const {
  DISCORD_TOKEN,
  ALLOWED_ROLE,
  GUILD_ID,
  LOGS_CHANNEL_ID,
  ROBLOX_COOKIE,
  ROBLOX_GROUP_ID,
  PORT = 3000
} = process.env;

// --- CRITICAL CHECKS ---
if (!DISCORD_TOKEN || !GUILD_ID || !ROBLOX_COOKIE || !ROBLOX_GROUP_ID) {
  console.error('❌ ERROR: Missing required environment variables. Please check your .env file or Render settings.');
  process.exit(1);
}

// Express server to keep bot alive for hosting services like UptimeRobot
const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(PORT, () => console.log(`Express server running on port ${PORT}`));

// Discord client
// We explicitly enable partials to ensure all Discord features work correctly
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Login to Roblox
async function loginRoblox() {
  try {
    await noblox.setCookie(ROBLOX_COOKIE);
    const currentUser = await noblox.getCurrentUser();
    console.log(`✅ Logged into Roblox as ${currentUser.UserName} (${currentUser.UserID})`);
  } catch (err) {
    console.error('❌ Failed to log in to Roblox. Check your ROBLOX_COOKIE and ensure it is valid.');
    console.error(err);
    process.exit(1);
  }
}

// Register slash commands with Discord
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

  try {
    console.log('🔄 Clearing existing application (/) commands.');
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, GUILD_ID),
      { body: [] }
    );
    console.log('✅ Successfully cleared all application (/) commands.');
  } catch (err) {
    console.error('❌ Failed to clear slash commands.');
    console.error(err);
  }

  // Now, register the new commands
  try {
    const ranks = await noblox.getRoles(parseInt(ROBLOX_GROUP_ID));
    if (!ranks) {
      console.error('❌ Could not retrieve ranks from the Roblox group. Please check the group ID and bot permissions.');
      process.exit(1);
    }

    // FIX: Use 'r.id' for roleset ID
    const rankChoices = ranks
      .filter(r => r.rank > 0)
      .map(r => ({ name: r.name, value: r.id }));

    const commands = [
      {
        name: 'rank',
        description: 'Assign a rank to a Roblox user',
        options: [
          {
            name: 'username',
            type: 3, // STRING
            description: 'The Roblox username to rank',
            required: true
          },
          {
            name: 'rank',
            type: 4, // INTEGER
            description: 'The Roblox rank to assign',
            required: true,
            choices: rankChoices
          }
        ]
      },
      {
        name: 'ping',
        description: 'Checks the bot\'s latency.'
      }
    ];

    console.log('🔄 Started refreshing application (/) commands.');
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, GUILD_ID),
      { body: commands }
    );
    console.log('✅ Successfully reloaded application (/) commands.');
  } catch (err) {
    console.error('❌ Failed to register slash commands.');
    console.error(err);
  }
}

// Handle Discord interactions
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  
  // CRITICAL LOGGING: Check if any interaction is received
  console.log(`[DEBUG] Interaction received: ${interaction.commandName}`);

  // === /ping COMMAND HANDLER ===
  if (interaction.commandName === 'ping') {
    try {
      // CRITICAL LOGGING: Check if the deferReply is reached
      console.log('[DEBUG] PING: Starting deferReply...');
      await interaction.deferReply({ ephemeral: true });
      console.log('[DEBUG] PING: deferReply successful.');

      const latency = Date.now() - interaction.createdTimestamp;
      
      // CRITICAL LOGGING: Check if the editReply is reached
      console.log('[DEBUG] PING: Starting editReply...');
      await interaction.editReply({ content: `Pong! My latency is ${latency}ms.`, ephemeral: true });
      console.log('[DEBUG] PING: editReply successful. Command finished.');
      
    } catch (err) {
      // CRITICAL LOGGING: Catch ANY error during PING execution
      console.error('❌ PING COMMAND CRASHED:', err);
    }
    return; // Stop execution after ping command
  }
  // =============================

  // === /rank COMMAND HANDLER ===
  if (interaction.commandName === 'rank') {
    // CRITICAL LOGGING: Check if rank handler is reached
    console.log('[DEBUG] RANK: Rank handler reached.');

    // Permission check
    if (!interaction.member.roles.cache.has(ALLOWED_ROLE)) {
      return interaction.reply({ content: '❌ You are not allowed to use this command.', ephemeral: true });
    }

    try {
      // CRITICAL LOGGING: Check if the deferReply is reached
      console.log('[DEBUG] RANK: Starting deferReply...');
      await interaction.deferReply();
      console.log('[DEBUG] RANK: deferReply successful.');

      const username = interaction.options.getString('username');
      const rankId = interaction.options.getInteger('rank');

      // CRITICAL LOGGING: Starting noblox calls
      console.log('[DEBUG] RANK: Starting noblox.getIdFromUsername...');
      const userId = await noblox.getIdFromUsername(username);
      console.log(`[DEBUG] RANK: Received UserId: ${userId}`);

      if (!userId) {
        return interaction.editReply({ content: `❌ Roblox user **${username}** was not found. Please check the spelling.` });
      }

      // Check if the user is in the group before attempting to rank them
      console.log('[DEBUG] RANK: Starting noblox.getRankInGroup...');
      const userInGroup = await noblox.getRankInGroup(parseInt(ROBLOX_GROUP_ID), userId);
      console.log(`[DEBUG] RANK: User rank in group: ${userInGroup}`);

      if (userInGroup === -1) {
        return interaction.editReply({ content: `❌ Roblox user **${username}** is not in the group.` });
      }

      console.log('[DEBUG] RANK: Starting noblox.getRoles...');
      const ranks = await noblox.getRoles(parseInt(ROBLOX_GROUP_ID));
      const selectedRank = ranks.find(r => r.id === rankId);
      const selectedRankName = selectedRank ? selectedRank.name : 'Unknown Rank';
      console.log(`[DEBUG] RANK: Target Rank Name: ${selectedRankName}, ID: ${rankId}`);

      // Final rank operation
      console.log('[DEBUG] RANK: Starting noblox.setRank...');
      await noblox.setRank(parseInt(ROBLOX_GROUP_ID), userId, rankId);
      console.log('[DEBUG] RANK: noblox.setRank successful.');

      const successMessage = `✅ **${username}** has been ranked to **${selectedRankName}** successfully.`;
      await interaction.editReply({ content: successMessage });

      // Log to internal channel
      const logsChannel = interaction.guild.channels.cache.get(LOGS_CHANNEL_ID);
      if (logsChannel) {
        logsChannel.send(`A rank change occurred: **${interaction.user.tag}** ranked **${username}** to **${selectedRankName}**.`);
      }

      console.log('[DEBUG] RANK: Command finished successfully.');

    } catch (err) {
      // Robust Error Handling for the user and console
      console.error('❌ AN UNEXPECTED CRASH OCCURRED DURING RANK COMMAND:', err);
      let errorMessage = '❌ An unexpected error occurred. Please try again.';

      if (err.message.includes('No group with the ID')) {
        errorMessage = '❌ Failed to find the Roblox group. Please check the `ROBLOX_GROUP_ID`.';
      } else if (err.message.includes('Authorization has been denied for this request.')) {
        errorMessage = '❌ Failed to set rank. The bot\'s Roblox account may not have permission, or its rank is too low.';
      } else if (err.message.includes('The specified rank is not a valid rank')) {
        errorMessage = '❌ The provided rank is not a valid rank in the group.';
      } else if (err.message.includes('Request failed with status code 500') || err.message.includes('Request failed with status code 503')) {
        errorMessage = '❌ The Roblox API is currently unavailable. Please try again later.';
      }

      await interaction.editReply({ content: errorMessage }).catch(e => console.error('Failed to send error reply after crash:', e));
    }
  }
});

// Initialize the bot
client.once('clientReady', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  
  // Log into Roblox and register commands on clientReady
  await loginRoblox();
  await registerCommands();
  
  console.log(`✅ Bot initialization complete.`);
});

client.login(DISCORD_TOKEN);
