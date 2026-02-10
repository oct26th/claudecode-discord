import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { getProject } from "../../db/database.js";
import { sessionManager } from "../../claude/session-manager.js";

export const data = new SlashCommandBuilder()
  .setName("stop")
  .setDescription("Stop the active Claude Code session in this channel");

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

  const stopped = await sessionManager.stopSession(channelId);
  if (stopped) {
    await interaction.editReply({
      embeds: [
        {
          title: "Session Stopped",
          description: `Stopped Claude Code session for \`${project.project_path}\``,
          color: 0xff6600,
        },
      ],
    });
  } else {
    await interaction.editReply({
      content: "No active session in this channel.",
    });
  }
}
