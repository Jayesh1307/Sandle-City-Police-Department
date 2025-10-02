import 'dotenv/config';
import express from 'express';
import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import noblox from 'noblox.js';

// Environment variables are destructured here
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
// Added checks for ALLOWED_ROLE and LOGS_CHANNEL_ID as they are used later.
if (!DISCORD_TOKEN || !GUILD_ID || !ROBLOX_COOKIE || !ROBLOX_GROUP_ID || !ALLOWED_ROLE || !LOGS_CHANNEL_ID) {
  console.error('❌ ERROR: Missing one or more required environment variables (DISCORD_TOKEN, GUILD_ID, ROBLOX_COOKIE, ROBLOX_GROUP_ID, ALLOWED_ROLE, LOGS_CHANNEL_ID). Please check your Secrets/Environment tab.');
  process.exit(1);
}

// Ensure Group ID is parsed as an integer early
const GROUP_ID_INT = parseInt(ROBLOX_GROUP_ID);
if (isNaN(GROUP_ID_INT)) {
    console.error('❌ ERROR: ROBLOX_GROUP_ID is not a valid number.');
    process.exit(1);
}

// Express server to keep bot alive
const app = express();
app.get('/', (req, res) => res.send('Bot is running and operational!'));
app.listen(PORT, () => console.log(`Express keep-alive server running on port ${PORT}`));

// Discord client setup - ADDED GatewayIntentBits.Guilds to receive interactions
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Global variable to store fetched ranks
let rankChoicesCache = [];

// Function to log into Roblox and retrieve the group's ranks
async function initializeRoblox() {
  try {
    // 1. Login
    await noblox.setCookie(ROBLOX_COOKIE);
    const currentUser = await noblox.getCurrentUser();
    console.log(`✅ Logged into Roblox as ${currentUser.UserName} (${currentUser.UserID})`);
    
    // 2. Cache Ranks
    const ranks = await noblox.getRoles(GROUP_ID_INT);
    
    // Filter out Guest rank (rank 0) and map to Discord choice format
    rankChoicesCache = ranks
      .filter(r => r.rank > 0)
      .map(r => ({ name: r.name, value: r.rank }));

    if (rankChoicesCache.length === 0) {
      console.error('❌ Could not retrieve any ranks. Check Group ID or if the bot is in the group.');
      process.exit(1); 
    }
    console.log(`✅ Fetched ${rankChoicesCache.length} ranks from Roblox Group.`);

  } catch (err) {
    console.error('❌ CRITICAL FAILURE during Roblox initialization. Check ROBLOX_COOKIE or group membership/permissions.');
    console.error(err);
    // Do not exit here; allow Discord to try and connect, but commands will fail.
    // However, since we rely on ranks for registration, we should exit.
    process.exit(1);
  }
}

// Register slash commands with Discord
async function registerCommands() {
  
  // This function relies on rankChoicesCache being populated by initializeRoblox()
  const rankCommand = {
    name: 'rank',
    description: 'Assign a rank to a Roblox user in the group.',
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
        // Use the dynamically fetched ranks for choices
        choices: rankChoicesCache
      }
    ]
  };

  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  try {
    console.log('🔄 Started refreshing application (/) commands.');
    
    // client.user.id is available here because this is called after 'ready'
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, GUILD_ID),
      { body: [rankCommand] }
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

  if (interaction.commandName === 'rank') {
    // Permission check: Uses ALLOWED_ROLE environment variable
    if (!interaction.member || !interaction.member.roles.cache.has(ALLOWED_ROLE)) {
      return interaction.reply({ content: '❌ You are not authorized to use the ranking command.', ephemeral: true });
    }

    // Defer the reply for long operations (Roblox API calls)
    await interaction.deferReply();

    const username = interaction.options.getString('username');
    const rankNumber = interaction.options.getInteger('rank');

    try {
      // 1. Get User ID
      const userId = await noblox.getIdFromUsername(username);

      if (!userId) {
        return interaction.editReply({ content: `❌ Roblox user **${username}** was not found. Please check the spelling.` });
      }

      // 2. Find rank name for logging (using the cached data)
      const selectedRank = rankChoicesCache.find(r => r.value === rankNumber);
      const selectedRankName = selectedRank ? selectedRank.name : 'Unknown Rank';

      // 3. Set the Rank 
      await noblox.setRank(GROUP_ID_INT, userId, rankNumber);

      const successMessage = `✅ **${username}** has been ranked to **${selectedRankName}** successfully.`;
      await interaction.editReply({ content: successMessage });

      // 4. Log the action to a specific channel
      const logsChannel = interaction.guild.channels.cache.get(LOGS_CHANNEL_ID);
      if (logsChannel) {
        logsChannel.send(`A rank change occurred: **${interaction.user.tag}** ranked **${username}** to **${selectedRankName}**.`);
      }

    } catch (err) {
      console.error(`❌ Error during rank change for ${username}:`, err);
      let errorMessage = '❌ An unexpected error occurred during the ranking process. Please try again.';

      // More informative error messages based on noblox.js errors
      if (err.message.includes('No group with the ID')) {
        errorMessage = '❌ Failed to find the Roblox group. Check the `ROBLOX_GROUP_ID`.';
      } else if (err.message.includes('Authorization has been denied')) {
        errorMessage = '❌ Failed to set rank. The bot\'s Roblox account may not have permission, or its rank is too low/equal to target.';
      } else if (err.message.includes('The specified rank is not a valid rank')) {
        errorMessage = '❌ The rank selected is not a valid rank in the group.';
      }

      await interaction.editReply({ content: errorMessage });
    }
  }
});

// Initialize the bot: This is the correct order of operations.
client.once('ready', async () => {
  console.log(`✅ Discord client ready.`);
  // 1. Initialize Roblox (log in and fetch ranks)
  await initializeRoblox(); 
  // 2. Register Commands (requires fetched ranks and client.user.id)
  await registerCommands();
});

// Start the Discord login process
client.login(DISCORD_TOKEN);
