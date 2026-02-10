import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { getProject, setAutoApprove } from "../../db/database.js";

export const data = new SlashCommandBuilder()
  .setName("auto-approve")
  .setDescription("Toggle auto-approve mode for tool use in this channel")
  .addStringOption((opt) =>
    opt
      .setName("mode")
      .setDescription("on or off")
      .setRequired(true)
      .addChoices(
        { name: "on", value: "on" },
        { name: "off", value: "off" },
      ),
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const channelId = interaction.channelId;
  const mode = interaction.options.getString("mode", true);
  const project = getProject(channelId);

  if (!project) {
    await interaction.editReply({
      content: "This channel is not registered to any project.",
    });
    return;
  }

  const enabled = mode === "on";
  setAutoApprove(channelId, enabled);

  await interaction.editReply({
    embeds: [
      {
        title: `Auto-approve: ${enabled ? "ON" : "OFF"}`,
        description: enabled
          ? "Claude will automatically approve all tool uses (Edit, Write, Bash, etc.)"
          : "Claude will ask for approval before using tools",
        color: enabled ? 0x00ff00 : 0xff6600,
      },
    ],
  });
}
