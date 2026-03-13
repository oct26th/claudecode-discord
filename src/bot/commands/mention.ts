import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { getProject, setMentionOnly } from "../../db/database.js";
import { L } from "../../utils/i18n.js";

export const data = new SlashCommandBuilder()
  .setName("mention")
  .setDescription("Toggle mention-only mode: bot responds only when @mentioned")
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
      content: L(
        "This channel is not registered to any project.",
        "이 채널은 어떤 프로젝트에도 등록되어 있지 않습니다.",
      ),
    });
    return;
  }

  const enabled = mode === "on";
  setMentionOnly(channelId, enabled);

  await interaction.editReply({
    embeds: [
      {
        title: L(
          `Mention-only: ${enabled ? "ON" : "OFF"}`,
          `멘션 전용: ${enabled ? "ON" : "OFF"}`,
        ),
        description: enabled
          ? L(
              "Bot will only respond when @mentioned in this channel.",
              "이 채널에서 @멘션할 때만 봇이 응답합니다.",
            )
          : L(
              "Bot will respond to all messages in this channel.",
              "이 채널의 모든 메시지에 봇이 응답합니다.",
            ),
        color: enabled ? 0xffa500 : 0x00ff00,
      },
    ],
  });
}
