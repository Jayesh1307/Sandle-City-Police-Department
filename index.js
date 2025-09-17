require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const noblox = require("noblox.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const noblox = require("noblox.js");


const GROUP_ID = process.env.GROUP_ID;
const ALLOWED_ROLE = process.env.ALLOWED_ROLE;

async function startApp() {
  await noblox.setCookie(process.env.ROBLOX_COOKIE);
  console.log("✅ Logged in to Roblox");
}

startApp();


client.on("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (msg) => {
  if (!msg.content.startsWith("!")) return;

  // check role
  if (!msg.member.roles.cache.some(r => r.name === ALLOWED_ROLE)) {
    return msg.reply("❌ You don't have permission to use ranking commands.");
  }

  const args = msg.content.slice(1).split(" ");
  const command = args.shift().toLowerCase();

  if (command === "promote") {
    let username = args[0];
    try {
      const userId = await noblox.getIdFromUsername(username);
      await noblox.promote(GROUP_ID, userId);
      msg.reply(`✅ Promoted ${username} in the group!`);
    } catch (err) {
      msg.reply("❌ Error promoting user: " + err);
    }
  }

  if (command === "demote") {
    let username = args[0];
    try {
      const userId = await noblox.getIdFromUsername(username);
      await noblox.demote(GROUP_ID, userId);
      msg.reply(`✅ Demoted ${username} in the group!`);
    } catch (err) {
      msg.reply("❌ Error demoting user: " + err);
    }
  }
});
