// index.js
import 'dotenv/config';
import express from 'express';
import { Client, GatewayIntentBits, Routes, SlashCommandBuilder } from 'discord.js';
import { REST } from '@discordjs/rest';
import noblox from 'noblox.js';

const app = express();
const PORT = process.env.PORT || 10000;

// Express server (for Render)
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(PORT, () => console.log(`Express server running on port ${PORT}`));

// Discord client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Login to Roblox
async function loginRoblox() {
  try {
    await noblox.loginCookie(process.env.ROBLOX_COOKIE);
    console.log('✅ Logged into Roblox');
  } catch (err) {
    console.error('❌ Failed to log in to Roblox:', err);
  }
}

// Fetch Roblox group roles
async function getGroupRoles() {
  try {
    const roles = await noblox.getRoles(process.env.GROUP_ID);
    // Sort ascending by rank
    return roles.sort((a, b) => a.rank - b.rank);
  } catch (err) {
    console.error('❌ Failed to fetch Roblox roles:', err);
    return [];
  }
}

// Register slash command dynamically
async function registerCommands() {
  const roles = await getGroupRoles();
  const rankChoices = roles.map(r => ({ name: r.name, value: r.rank }));

  const commands = [
    new SlashCommandBuilder()
      .setName('rank')
      .setDescription('Promote or demote a user in Roblox')
      .addUserOption(option => option.setName('user').setDescription('Discord user').setRequired(true))
      .addIntegerOption(option =>
        option
          .setName('rank')
          .setDescription('Rank to assign')
          .setRequired(true)
          .addChoices(...rankChoices)
      )
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
    console.log('✅ Slash command /rank registered');
  } catch (err) {
    console.error(err);
  }
}

// Handle rank command
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;
  if (interaction.commandName !== 'rank') return;

  const targetUser = interaction.options.getUser('user');
  const rank = interaction.options.getInteger('rank');

  try {
    // Roblox username of the promoter (discord user)
    const promoterRoblox = await noblox.getIdFromUsername(interaction.user.username);
    const promoterRank = await noblox.getRankInGroup(process.env.GROUP_ID, promoterRoblox);

    if (rank >= promoterRank) {
      return interaction.reply({ content: '❌ You cannot assign a rank equal or higher than your own!', ephemeral: true });
    }

    // Assign rank
    const targetRoblox = await noblox.getIdFromUsername(targetUser.username);
    await noblox.setRank(process.env.GROUP_ID, targetRoblox, rank);

    // Log in Discord
    const logsChannel = await client.channels.fetch(process.env.LOGS_CHANNEL_ID);
    logsChannel.send(`${interaction.user.tag} promoted/demoted ${targetUser.tag} to rank ${rank}`);

    await interaction.reply({ content: `✅ ${targetUser.tag} has been assigned rank ${rank}`, ephemeral: true });
  } catch (err) {
    console.error(err);
    await interaction.reply({ content: '❌ Failed to assign rank. Make sure Roblox usernames are correct.', ephemeral: true });
  }
});

// Discord login
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await loginRoblox();
  await registerCommands();
});

client.login(process.env.DISCORD_TOKEN);
