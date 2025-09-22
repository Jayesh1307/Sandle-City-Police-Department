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
  // First, get the rank information from Roblox
  const ranks = await noblox.getRoles(parseInt(ROBLOX_GROUP_ID));
  if (!ranks) {
    console.error('❌ Could not retrieve ranks from the Roblox group. Please check the group ID and bot permissions.');
    process.exit(1);
  }

  // Create an array of choices for the Discord command, filtering out the guest rank
  const rankChoices = ranks
    .filter(r => r.rank > 0)
    .map(r => ({ name: r.name, value: r.rank }));

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

  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  try {
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

  if (interaction.commandName === 'rank') {
    // Permission check
    if (!interaction.member.roles.cache.has(ALLOWED_ROLE)) {
      return interaction.reply({ content: '❌ You are not allowed to use this command.', ephemeral: true });
    }

    await interaction.deferReply();

    const username = interaction.options.getString('username');
    const rankNumber = interaction.options.getInteger('rank');

    try {
      const userId = await noblox.getIdFromUsername(username);

      if (!userId) {
        return interaction.editReply({ content: `❌ Roblox user **${username}** was not found. Please check the spelling.` });
      }

      const ranks = await noblox.getRoles(parseInt(ROBLOX_GROUP_ID));
      const selectedRank = ranks.find(r => r.rank === rankNumber);
      const selectedRankName = selectedRank ? selectedRank.name : 'Unknown Rank';

      await noblox.setRank(parseInt(ROBLOX_GROUP_ID), userId, rankNumber);

      const successMessage = `✅ **${username}** has been ranked to **${selectedRankName}** successfully.`;
      await interaction.editReply({ content: successMessage });

      const logsChannel = interaction.guild.channels.cache.get(LOGS_CHANNEL_ID);
      if (logsChannel) {
        logsChannel.send(`A rank change occurred: **${interaction.user.tag}** ranked **${username}** to **${selectedRankName}**.`);
      }

    } catch (err) {
      console.error('❌ Error during rank change:', err);
      let errorMessage = '❌ An unexpected error occurred. Please try again.';

      if (err.message.includes('No group with the ID')) {
        errorMessage = '❌ Failed to find the Roblox group. Please check the `ROBLOX_GROUP_ID`.';
      } else if (err.message.includes('Authorization has been denied for this request.')) {
        errorMessage = '❌ Failed to set rank. The bot\'s Roblox account may not have permission, or its rank is too low.';
      } else if (err.message.includes('The specified rank is not a valid rank')) {
        errorMessage = '❌ The provided rank ID is not a valid rank in the group.';
      }

      await interaction.editReply({ content: errorMessage });
    }
  }
});

// Initialize the bot
client.once('clientReady', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await loginRoblox();
  await registerCommands();
});

client.login(DISCORD_TOKEN);
