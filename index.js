// index.js
import 'dotenv/config';
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import noblox from 'noblox.js';
import express from 'express';

// Load environment variables
const {
  DISCORD_TOKEN,
  CLIENT_ID,
  GUILD_ID,
  LOGS_CHANNEL_ID,
  ROBLOX_COOKIE,
  ALLOWED_ROLE
} = process.env;

// Express setup to keep bot alive
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is running'));
app.listen(PORT, () => console.log(`Express server running on port ${PORT}`));

// Discord client setup
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Roblox login
async function loginRoblox() {
  try {
    await noblox.cookieLogin(ROBLOX_COOKIE); // updated function
    console.log('✅ Logged into Roblox');
  } catch (err) {
    console.error('❌ Failed to log in to Roblox:', err);
  }
}

// Slash command: /rank
const commands = [
  new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Promote or demote a Roblox user')
    .addStringOption(option => option.setName('username').setDescription('Roblox username').setRequired(true))
    .addStringOption(option => option.setName('rank').setDescription('New rank name').setRequired(true))
    .toJSON()
];

// Register commands
const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
(async () => {
  try {
    console.log('Registering commands...');
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ Slash commands registered.');
  } catch (err) {
    console.error(err);
  }
})();

// Handle interactions
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'rank') {
    const username = interaction.options.getString('username');
    const newRank = interaction.options.getString('rank');

    // Check role
    if (!interaction.member.roles.cache.some(r => r.name === ALLOWED_ROLE)) {
      return interaction.reply({ content: '❌ You are not allowed to use this command.', ephemeral: true });
    }

    try {
      const userId = await noblox.getIdFromUsername(username);
      const currentRank = await noblox.getRankInGroup(parseInt(process.env.GROUP_ID), userId);

      const roles = await noblox.getRoles(process.env.GROUP_ID);
      const targetRank = roles.find(r => r.name.toLowerCase() === newRank.toLowerCase());

      if (!targetRank) return interaction.reply({ content: '❌ Invalid rank.', ephemeral: true });
      if (currentRank.rank >= targetRank.rank) return interaction.reply({ content: '❌ Cannot promote to equal or lower rank.', ephemeral: true });

      const executorRank = await noblox.getRankInGroup(parseInt(process.env.GROUP_ID), await noblox.getIdFromUsername(interaction.user.username));
      if (executorRank.rank <= targetRank.rank) return interaction.reply({ content: '❌ You cannot promote to this rank.', ephemeral: true });

      await noblox.setRank(process.env.GROUP_ID, userId, targetRank.rank);

      interaction.reply({ content: `✅ ${username} has been promoted to ${targetRank.name}.` });

      // Log promotion
      const logsChannel = await client.channels.fetch(LOGS_CHANNEL_ID);
      logsChannel.send(`📢 **${interaction.user.tag}** promoted **${username}** to **${targetRank.name}**`);
    } catch (err) {
      console.error(err);
      interaction.reply({ content: '❌ Failed to assign rank. Make sure Roblox usernames are correct.', ephemeral: true });
    }
  }
});

// Start bot
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await loginRoblox();
});

client.login(DISCORD_TOKEN);
