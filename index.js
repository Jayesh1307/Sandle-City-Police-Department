// index.js

import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import noblox from "noblox.js";
import http from "http";

// 🔹 Fake HTTP server for Render
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Bot is running!\n");
}).listen(process.env.PORT || 3000, () => {
  console.log(`🌐 HTTP server listening on port ${process.env.PORT || 3000}`);
});

// 🔹 Discord + Roblox bot
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const GROUP_ID = process.env.GROUP_ID;
const ALLOWED_ROLE = process.env.ALLOWED_ROLE;

async function startApp() {
  await noblox.setCookie(process.env.ROBLOX_COOKIE);
  console.log("✅ Logged into Roblox successfully!");
}

startApp();

client.on("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (msg) => {
  if (!msg.content.startsWith("!")) return;
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

client.login(process.env.DISCORD_TOKEN);
