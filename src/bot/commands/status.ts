import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import { getAllProjects, getSession } from "../../db/database.js";

const STATUS_EMOJI: Record<string, string> = {
  online: "🟢",
  waiting: "🟡",
  idle: "⚪",
  offline: "🔴",
};

export const data = new SlashCommandBuilder()
  .setName("status")
  .setDescription("Show status of all registered project sessions");

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const guildId = interaction.guildId!;
  const projects = getAllProjects(guildId);

  if (projects.length === 0) {
    await interaction.editReply({
      content: "No projects registered. Use `/register` in a channel first.",
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle("Claude Code Sessions")
    .setColor(0x7c3aed)
    .setTimestamp();

  for (const project of projects) {
    const session = getSession(project.channel_id);
    const status = session?.status ?? "offline";
    const emoji = STATUS_EMOJI[status] ?? "🔴";
    const lastActivity = session?.last_activity ?? "never";

    embed.addFields({
      name: `${emoji} <#${project.channel_id}>`,
      value: [
        `\`${project.project_path}\``,
        `Status: **${status}**`,
        `Auto-approve: ${project.auto_approve ? "On" : "Off"}`,
        `Last activity: ${lastActivity}`,
      ].join("\n"),
      inline: false,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}
