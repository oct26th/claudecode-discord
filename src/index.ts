import "dotenv/config";
import { loadConfig } from "./utils/config.js";
import { initDatabase } from "./db/database.js";
import { startBot } from "./bot/client.js";

async function main() {
  console.log("Starting Claude Code Discord Controller...");

  // Load and validate config
  loadConfig();
  console.log("Config loaded");

  // Initialize database
  initDatabase();
  console.log("Database initialized");

  // Start Discord bot
  await startBot();
  console.log("Bot is running!");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
