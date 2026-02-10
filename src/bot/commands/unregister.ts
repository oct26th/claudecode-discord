import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { unregisterProject, getProject } from "../../db/database.js";
import { sessionManager } from "../../claude/session-manager.js";

export const data = new SlashCommandBuilder()
  .setName("unregister")
  .setDescription("Unregister this channel from its project")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const channelId = interaction.channelId;
  const project = getProject(channelId);

  if (!project) {
    await interaction.editReply({
      content: "This channel is not registered to any project.",
    });
    return;
  }

  // Stop active session if any
  await sessionManager.stopSession(channelId);

  unregisterProject(channelId);

  await interaction.editReply({
    embeds: [
      {
        title: "Project Unregistered",
        description: `Removed link to \`${project.project_path}\``,
        color: 0xff0000,
      },
    ],
  });
}
