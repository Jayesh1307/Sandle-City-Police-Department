import { Client, GatewayIntentBits, SlashCommandBuilder, Routes, REST, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import 'dotenv/config';
import noblox from 'noblox.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Roblox login
async function loginRoblox() {
    try {
        await noblox.cookieLogin(process.env.ROBLOX_COOKIE);
        console.log('✅ Logged in to Roblox!');
    } catch (err) {
        console.error('❌ Failed to log in to Roblox:', err);
    }
}

// Sync Discord slash commands
async function registerCommands() {
    const commands = [
        new SlashCommandBuilder()
            .setName('rank')
            .setDescription('Promote or demote a user in the Roblox group')
            .addUserOption(option => 
                option.setName('target')
                    .setDescription('The Roblox account to change rank')
                    .setRequired(true))
            .addStringOption(option => 
                option.setName('rank')
                    .setDescription('Select the rank to assign')
                    .setRequired(true))
            .toJSON()
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands }
    );

    console.log('✅ Slash commands registered.');
}

// Get Roblox group ranks for dropdown
async function getGroupRanks() {
    const ranks = await noblox.getRoles(process.env.GROUP_ID);
    return ranks.map(r => ({ label: r.name, value: r.rank.toString() }));
}

// Handle /rank command
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'rank') {
        const targetUser = interaction.options.getUser('target');
        const rankValue = parseInt(interaction.options.getString('rank'));

        // Check Discord role rank permission
        const memberRank = await noblox.getRank(parseInt(process.env.GROUP_ID), interaction.user.id);
        if (rankValue >= memberRank) {
            return interaction.reply({ content: '❌ You cannot promote to a rank equal or higher than your own.', ephemeral: true });
        }

        try {
            const targetRobloxId = await noblox.getIdFromUsername(targetUser.username);
            await noblox.setRank(process.env.GROUP_ID, targetRobloxId, rankValue);

            interaction.reply(`✅ Successfully set ${targetUser.username}'s rank to ${rankValue}`);

            // Log in your logs channel
            const logChannel = await client.channels.fetch(process.env.LOGS_CHANNEL_ID);
            logChannel.send(`**${interaction.user.tag}** promoted/demoted **${targetUser.tag}** to rank **${rankValue}**`);
        } catch (err) {
            console.error(err);
            interaction.reply({ content: '❌ Failed to set rank. Make sure the user exists in Roblox group.', ephemeral: true });
        }
    }
});

// Start bot
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    await loginRoblox();
    await registerCommands();
});

client.login(process.env.DISCORD_TOKEN);
