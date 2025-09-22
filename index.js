// index.js
import 'dotenv/config';
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import express from 'express';
import noblox from 'noblox.js';

// ---------- EXPRESS SERVER ----------
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is online!'));
app.listen(PORT, () => console.log(`Express server running on port ${PORT}`));

// ---------- DISCORD BOT ----------
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Roblox login
async function loginRoblox() {
    try {
        await noblox.setCookie(process.env.ROBLOX_COOKIE);
        console.log('✅ Logged into Roblox');
    } catch (err) {
        console.error('❌ Failed to log in to Roblox:', err);
    }
}

// Fetch group ranks for dropdown
async function getGroupRanks() {
    const ranks = await noblox.getRoles(process.env.GROUP_ID);
    return ranks.map(r => ({ label: r.name, value: r.rank.toString() }));
}

// Register slash command
const commands = [
    new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Assign a rank to a Roblox user')
        .addStringOption(option =>
            option.setName('username')
                .setDescription('Roblox username')
                .setRequired(true))
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function registerCommands() {
    try {
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );
        console.log('✅ Slash commands registered.');
    } catch (err) {
        console.error('❌ Error registering commands:', err);
    }
}

// Handle interactions
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu()) return;

    // Check role
    if (interaction.member && !interaction.member.roles.cache.has(process.env.ALLOWED_ROLE)) {
        await interaction.reply({ content: '❌ You are not allowed to use this command.', ephemeral: true });
        return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === 'rank') {
        const username = interaction.options.getString('username');

        // Get ranks dropdown
        const rankOptions = await getGroupRanks();
        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`rank_select_${username}`)
                .setPlaceholder('Select a rank')
                .addOptions(rankOptions)
        );

        await interaction.reply({ content: `Select a rank for **${username}**:`, components: [row], ephemeral: true });
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('rank_select_')) {
        const username = interaction.customId.replace('rank_select_', '');
        const rank = parseInt(interaction.values[0]);

        try {
            const userId = await noblox.getIdFromUsername(username);
            await noblox.setRank(process.env.GROUP_ID, userId, rank);

            await interaction.update({ content: `✅ Successfully set **${username}** to rank **${rank}**`, components: [] });

            // Log the action
            const logChannel = await client.channels.fetch(process.env.LOGS_CHANNEL_ID);
            logChannel.send(`**${interaction.user.tag}** set **${username}** to rank **${rank}**`);
        } catch (err) {
            console.error(err);
            await interaction.update({ content: `❌ Failed to assign rank. Make sure Roblox usernames are correct.`, components: [] });
        }
    }
});

// Start bot
client.once('clientReady', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    await loginRoblox();
});
registerCommands();
client.login(process.env.DISCORD_TOKEN);
