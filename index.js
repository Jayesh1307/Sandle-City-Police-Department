import 'dotenv/config';
import * as discord from 'discord.js'; 
import noblox from 'noblox.js'; 

// Suppress the deprecated warning for a cleaner startup
noblox.setOptions({ show_deprecation_warnings: false });

const {
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes
} = discord;

// Environment variables
const {
  DISCORD_TOKEN,
  ALLOWED_ROLE,
  GUILD_ID,
  LOGS_CHANNEL_ID,
  ROBLOX_COOKIE,
  ROBLOX_GROUP_ID
} = process.env;

// --- CRITICAL CHECKS ---
if (!DISCORD_TOKEN || !GUILD_ID || !ROBLOX_COOKIE || !ROBLOX_GROUP_ID) {
  console.error('❌ ERROR: Missing required environment variables. Please check your hosting configuration.');
  // Exit the process cleanly if configuration is missing
  process.exit(1); 
}

// Discord client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Login to Roblox
async function loginRoblox() {
  try {
    await noblox.setCookie(ROBLOX_COOKIE);
    const currentUser = await noblox.getCurrentUser();
    console.log(`✅ Logged into Roblox as ${currentUser.UserName} (${currentUser.UserID})`);
  } catch (err) {
    console.error('❌ Failed to log in to Roblox. Check your ROBLOX_COOKIE.');
    process.exit(1);
  }
}

// Register slash commands 
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

  // Skip the 'clear' step on every cron job run for speed, but ensure it works initially
  
  try {
    const ranks = await noblox.getRoles(parseInt(ROBLOX_GROUP_ID));
    if (!ranks) {
      console.error('❌ Could not retrieve ranks from the Roblox group.');
      process.exit(1);
    }

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
      }
    ];

    await rest.put(
      Routes.applicationGuildCommands(client.user.id, GUILD_ID),
      { body: commands }
    );
    // Removed success logging to keep output clean for cron job
  } catch (err) {
    console.error('❌ Failed to register slash commands during startup.');
  }
}

// Handle Discord interactions
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  
  // === /rank COMMAND HANDLER ===
  if (interaction.commandName === 'rank') {
    // Permission check
    if (!interaction.member.roles.cache.has(ALLOWED_ROLE)) {
      return interaction.reply({ content: '❌ You are not allowed to use this command.', ephemeral: true });
    }

    try {
      await interaction.deferReply();

      const username = interaction.options.getString('username');
      const rankId = interaction.options.getInteger('rank');

      const userId = await noblox.getIdFromUsername(username);

      if (!userId) {
        return interaction.editReply({ content: `❌ Roblox user **${username}** was not found. Please check the spelling.` });
      }

      const userInGroup = await noblox.getRankInGroup(parseInt(ROBLOX_GROUP_ID), userId);

      if (userInGroup === -1) {
        return interaction.editReply({ content: `❌ Roblox user **${username}** is not in the group.` });
      }

      const ranks = await noblox.getRoles(parseInt(ROBLOX_GROUP_ID));
      const selectedRank = ranks.find(r => r.id === rankId);
      const selectedRankName = selectedRank ? selectedRank.name : 'Unknown Rank';

      // Final rank operation
      await noblox.setRank(parseInt(ROBLOX_GROUP_ID), userId, rankId);

      const successMessage = `✅ **${username}** has been ranked to **${selectedRankName}** successfully.`;
      await interaction.editReply({ content: successMessage });

      // Log to internal channel
      const logsChannel = interaction.guild.channels.cache.get(LOGS_CHANNEL_ID);
      if (logsChannel) {
        logsChannel.send(`A rank change occurred: **${interaction.user.tag}** ranked **${username}** to **${selectedRankName}**.`);
      }

    } catch (err) {
      console.error('❌ RANK COMMAND CRASHED:', err);
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
    
    // CRITICAL: Force the script to close after processing an interaction.
    // This prevents the Discord connection from hanging open, which is necessary for cron jobs.
    // If the process must handle multiple events, you may need a setTimeout before exiting.
    setTimeout(() => {
        client.destroy();
        process.exit(0);
    }, 10000); // Give 10 seconds to finish all tasks and close cleanly
  }
});


// FINAL STARTUP LOGIC: Login, set up, and wait for commands.
client.once('clientReady', async () => {
    console.log(`✅ Bot initialization complete. Logged in as ${client.user.tag}`);
    
    await loginRoblox();
    await registerCommands();
    
    // CRITICAL FOR CRON JOBS: Close the process after a short time if no commands are received.
    // If a command is received, the interaction handler will initiate a custom timeout/exit.
    setTimeout(() => {
        if (!client.isReady()) return; // Avoid destroying if not truly ready
        client.destroy();
        process.exit(0);
    }, 15000); // Wait 15 seconds for a command to come in
});


// Launch the bot. This replaces the express server block.
try {
    client.login(DISCORD_TOKEN);
} catch (error) {
    console.error('❌ Failed to log in to Discord. Check DISCORD_TOKEN.', error);
    process.exit(1);
}
