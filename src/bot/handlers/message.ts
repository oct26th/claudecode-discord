import { Message, TextChannel } from "discord.js";
import { getProject } from "../../db/database.js";
import { isAllowedUser, checkRateLimit } from "../../security/guard.js";
import { sessionManager } from "../../claude/session-manager.js";

export async function handleMessage(message: Message): Promise<void> {
  // Ignore bots and DMs
  if (message.author.bot || !message.guild) return;

  // Check if channel is registered
  const project = getProject(message.channelId);
  if (!project) return;

  // Auth check
  if (!isAllowedUser(message.author.id)) {
    await message.reply("You are not authorized to use this bot.");
    return;
  }

  // Rate limit
  if (!checkRateLimit(message.author.id)) {
    await message.reply("Rate limit exceeded. Please wait a moment.");
    return;
  }

  const prompt = message.content.trim();
  if (!prompt) return;

  const channel = message.channel as TextChannel;

  // Send message to Claude session
  await sessionManager.sendMessage(channel, prompt);
}
