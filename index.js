import 'dotenv/config';
import express from 'express';
import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import noblox from 'noblox.js';

// Environment variables
const {
  DISCORD_TOKEN,
  ALLOWED_ROLE,
  GUILD_ID,
  LOGS_CHANNEL_ID,
  ROBLOX_COOKIE,
  PORT = 3000
} = process.env;

// Express server to keep bot alive
const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(PORT, () => console.log(`Express server running on port ${PORT}`));

// Discord client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Login to Roblox
async function loginRoblox() {
  try {
    await noblox.setCookie(ROBLOX_COOKIE); // v6+ uses setCookie
    const currentUser = await noblox.getCurrentUser();
    console.log(`✅ Logged into Roblox as ${currentUser.UserName}`);
  } catch (err) {
    console.error('❌ Failed to log in to Roblox:', err);
  }
}

// Register commands
async function registerCommands() {
  const commands = [];

  // /rank command structure
  commands.push({
    name: 'rank',
    description: 'Assign a rank to a Roblox user',
    options: [
      {
        name: 'username',
        type: 3, // STRING
        description: 'Roblox username',
        required: true
      }
    ]
  });

  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  try {
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, GUILD_ID),
      { body: commands }
    );
    console.log('✅ Slash commands registered.');
  } catch (err) {
    console.error(err);
  }
}

// Handle interactions
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'rank') {
    // Permission check
    if (!interaction.member.roles.cache.has(ALLOWED_ROLE)) {
      return interaction.reply({ content: '❌ You are not allowed to use this command.', ephemeral: true });
    }

    const username = interaction.options.getString('username');
    const ranks = await noblox.getRoles(parseInt(GUILD_ID));

    // Build dropdown
    const { ActionRowBuilder, StringSelectMenuBuilder } = await import('discord.js');
    const rankMenu = new StringSelectMenuBuilder()
      .setCustomId('rank_select')
      .setPlaceholder('Select rank')
      .addOptions(
        ranks.map(r => ({ label: r.name, value: r.rank.toString() }))
      );
    const row = new ActionRowBuilder().addComponents(rankMenu);

    await interaction.reply({ content: `Select a rank for **${username}**:`, components: [row], ephemeral: true });

    const collector = interaction.channel.createMessageComponentCollector({ componentType: 3, time: 15000 });
    collector.on('collect', async i => {
      if (i.customId === 'rank_select') {
        const rankId = parseInt(i.values[0]);
        try {
          const userId = await noblox.getIdFromUsername(username);
          await noblox.setRank(parseInt(GUILD_ID), userId, rankId);
          await i.update({ content: `✅ **${username}** has been ranked successfully.`, components: [] });
        } catch (err) {
          await i.update({ content: `❌ Failed to assign rank. Make sure the username is correct.`, components: [] });
        }
      }
    });
  }
});

// Initialize
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await loginRoblox();
  await registerCommands();
});

client.login(DISCORD_TOKEN);
