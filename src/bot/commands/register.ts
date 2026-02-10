import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
} from "discord.js";
import path from "node:path";
import { registerProject, getProject } from "../../db/database.js";
import { validateProjectPath } from "../../security/guard.js";
import { getConfig } from "../../utils/config.js";

export const data = new SlashCommandBuilder()
  .setName("register")
  .setDescription("Register this channel to a project directory")
  .addStringOption((opt) =>
    opt
      .setName("path")
      .setDescription("Project folder name (under BASE_PROJECT_DIR)")
      .setRequired(true),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const input = interaction.options.getString("path", true);
  const config = getConfig();
  // If input is absolute path, use as-is; otherwise join with base dir
  const projectPath = path.isAbsolute(input)
    ? input
    : path.join(config.BASE_PROJECT_DIR, input);
  const channelId = interaction.channelId;
  const guildId = interaction.guildId!;

  // Check if already registered
  const existing = getProject(channelId);
  if (existing) {
    await interaction.editReply({
      content: `This channel is already registered to \`${existing.project_path}\`. Use \`/unregister\` first.`,
    });
    return;
  }

  // Validate path
  const error = validateProjectPath(projectPath);
  if (error) {
    await interaction.editReply({ content: `Invalid path: ${error}` });
    return;
  }

  registerProject(channelId, projectPath, guildId);

  await interaction.editReply({
    embeds: [
      {
        title: "Project Registered",
        description: `This channel is now linked to:\n\`${projectPath}\``,
        color: 0x00ff00,
        fields: [
          { name: "Status", value: "🔴 Offline", inline: true },
          { name: "Auto-approve", value: "Off", inline: true },
        ],
      },
    ],
  });
}
