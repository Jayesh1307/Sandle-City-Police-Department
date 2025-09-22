// index.js
import 'dotenv/config';
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import noblox from 'noblox.js';
import express from 'express';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ===== EXPRESS SERVER =====
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is running'));
app.listen(PORT, () => console.log(`Express server running on port ${PORT}`));

// ===== LOGIN TO ROBLOX =====
async function loginRoblox() {
    try {
        await noblox.cookieLogin(process.env.ROBLOX_COOKIE);
        console.log('✅ Logged into Roblox');
    } catch (err) {
        console.error('❌ Failed to log in to Roblox:', err);
    }
}

// ===== FETCH GROUP RANKS =====
async function getGroupRanks() {
    const ranks = await noblox.getRoles(process.env.GROUP_ID);
    return ranks.map(r => ({ name: r.name, value: r.rank }));
}

// ===== REGISTER SLASH COMMANDS =====
async function registerCommands() {
    const ranks = await getGroupRanks();
    const commands = [
        new SlashCommandBuilder()
            .setName('rank')
            .setDescription('Promote/demote user in Roblox group')
            .addUserOption(opt => opt.setName('target').setDescription('User to change rank').setRequired(true))
            .addStringOption(opt => 
                opt.setName('rank')
                   .setDescription('Select the rank')
                   .setRequired(true)
                   .addChoices(...ranks.map(r => ({ name: r.name, value: r.value.toString() })))
            )
            .toJSON()
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
    console.log('✅ Slash commands registered');
}

// ===== HANDLE SLASH COMMANDS =====
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'rank') {
        const target = interaction.options.getUser('target');
        const rankValue = parseInt(interaction.options.getString('rank'), 10);

        try {
            const callerId = await noblox.getIdFromUsername(interaction.user.username);
            const callerRank = await noblox.getRankInGroup(process.env.GROUP_ID, callerId);

            if (callerRank <= rankValue) {
                return interaction.reply({ content: '❌ You cannot promote/demote to a rank equal or above yours!', ephemeral: true });
            }

            const targetId = await noblox.getIdFromUsername(target.username);
            const targetRank = await noblox.getRankInGroup(process.env.GROUP_ID, targetId);

            if (rankValue >= callerRank) {
                return interaction.reply({ content: '❌ You cannot set a rank higher than your own!', ephemeral: true });
            }

            await noblox.setRank(process.env.GROUP_ID, targetId, rankValue);

            // Send success message
            await interaction.reply(`✅ ${target.username} has been set to rank ${rankValue}`);

            // Log to Discord
            const logChannel = await client.channels.fetch(process.env.LOGS_CHANNEL_ID);
            logChannel.send(`📢 **Rank Change:** ${interaction.user.tag} set ${target.username} to rank ${rankValue}`);
        } catch (err) {
            console.error(err);
            interaction.reply({ content: '❌ An error occurred while changing the rank.', ephemeral: true });
        }
    }
});

// ===== READY EVENT =====
client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    await loginRoblox();
    await registerCommands();
});

// ===== LOGIN TO DISCORD =====
client.login(process.env.DISCORD_TOKEN);
