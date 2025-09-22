import 'dotenv/config';
import express from 'express';
import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import noblox from 'noblox.js';

// Environment variables
// Note: You must create a .env file with these variables.
const {
  DISCORD_TOKEN,
  ALLOWED_ROLE,
  GUILD_ID,
  ROBLOX_COOKIE,
  ROBLOX_GROUP_ID, // ADD THIS NEW VARIABLE
  PORT = 3000
} = process.env;

// --- CRITICAL CHECKS ---
if (!DISCORD_TOKEN || !GUILD_ID || !ROBLOX_COOKIE || !ROBLOX_GROUP_ID) {
  console.error('❌ ERROR: Missing required environment variables. Please check your .env file.');
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
    // Noblox.js uses the .ROBLOSECURITY cookie for authentication
    await noblox.setCookie(ROBLOX_COOKIE);
    const currentUser = await noblox.getCurrentUser();
    console.log(`✅ Logged into Roblox as ${currentUser.UserName} (${currentUser.UserID})`);
  } catch (err) {
    console.error('❌ Failed to log in to Roblox. Check your ROBLOX_COOKIE and ensure it is valid.');
    console.error(err);
  }
}

// Register slash commands with Discord
async function registerCommands() {
  const commands = [
    {
      name: 'rank',
      description: 'Assign a rank to a Roblox user',
      options: [
        {
          name: 'username',
          type: 3, // STRING type
          description: 'The Roblox username to rank',
          required: true
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
    // Permission check: ensure the user has the allowed role
    if (!interaction.member.roles.cache.has(ALLOWED_ROLE)) {
      return interaction.reply({ content: '❌ You are not allowed to use this command.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const username = interaction.options.getString('username');
    try {
      const ranks = await noblox.getRoles(parseInt(ROBLOX_GROUP_ID)); // FIX: Use ROBLOX_GROUP_ID here!

      // Build dropdown menu for ranks
      const { ActionRowBuilder, StringSelectMenuBuilder } = await import('discord.js');
      const rankMenu = new StringSelectMenuBuilder()
        .setCustomId('rank_select')
        .setPlaceholder('Select a rank')
        .addOptions(
          ranks.filter(r => r.rank > 0).map(r => ({ label: r.name, value: r.rank.toString() }))
        );
      const row = new ActionRowBuilder().addComponents(rankMenu);

      await interaction.editReply({ content: `Select a rank for **${username}**:`, components: [row], ephemeral: true });

      // Create a collector to wait for a selection
      const collector = interaction.channel.createMessageComponentCollector({
        componentType: 3, // STRING_SELECT_MENU
        time: 60000, // 60 seconds
        filter: i => i.customId === 'rank_select' && i.user.id === interaction.user.id
      });

      collector.on('collect', async i => {
        try {
          const selectedRankId = parseInt(i.values[0]);
          const userId = await noblox.getIdFromUsername(username);

          // Check if the Roblox user exists
          if (!userId) {
            await i.update({ content: `❌ Roblox user **${username}** was not found. Please check the spelling.`, components: [] });
            return;
          }

          // Set the rank in the Roblox group
          await noblox.setRank(parseInt(ROBLOX_GROUP_ID), userId, selectedRankId);
          await i.update({ content: `✅ **${username}** has been ranked successfully.`, components: [] });

          // Send a log message to a specific channel if LOGS_CHANNEL_ID is set
          const logsChannel = interaction.guild.channels.cache.get(LOGS_CHANNEL_ID);
          if (logsChannel) {
            logsChannel.send(`A rank change occurred: **${interaction.user.tag}** ranked **${username}** to rank ID **${selectedRankId}**.`);
          }
        } catch (err) {
          console.error('❌ Error during rank change:', err);
          await i.update({ content: `❌ An error occurred while trying to rank the user. Please try again.`, components: [] });
        }
        collector.stop();
      });

      collector.on('end', collected => {
        if (collected.size === 0) {
          interaction.editReply({ content: '⏰ Command timed out. Please try again.', components: [] });
        }
      });

    } catch (err) {
      console.error('❌ Error in rank command:', err);
      await interaction.editReply({ content: `❌ Failed to retrieve Roblox group ranks. Please check the ROBLOX_GROUP_ID.`, components: [] });
    }
  }
});

// Initialize the bot
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await loginRoblox();
  await registerCommands();
});

client.login(DISCORD_TOKEN);
