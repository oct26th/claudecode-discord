import {
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { getProject, setModel } from "../../db/database.js";
import { sessionManager } from "../../claude/session-manager.js";
import { L } from "../../utils/i18n.js";

export const data = new SlashCommandBuilder()
  .setName("model")
  .setDescription("Change the Claude model for this channel")
  .addStringOption((opt) =>
    opt
      .setName("model")
      .setDescription("Model name (use 'default' to reset)")
      .setRequired(true)
      .setAutocomplete(true),
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const channelId = interaction.channelId;
  const modelInput = interaction.options.getString("model", true);
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

  const model = modelInput === "default" ? null : modelInput;
  setModel(channelId, model);

  await interaction.editReply({
    embeds: [
      {
        title: L("Model Updated", "모델 변경됨"),
        description: model
          ? L(`Model set to: \`${model}\``, `모델 설정: \`${model}\``)
          : L(
              "Model reset to default. The CLI default model will be used.",
              "기본 모델로 재설정되었습니다. CLI 기본 모델이 사용됩니다.",
            ),
        color: model ? 0x5865f2 : 0x99aab5,
      },
    ],
  });
}

export async function autocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  const focused = interaction.options.getFocused().toLowerCase();

  const cachedModels = sessionManager.getCachedModels();
  const choices: { name: string; value: string }[] = [];

  // Always offer "default" option to reset
  if (!focused || "default".includes(focused)) {
    choices.push({
      name: L("default (reset to CLI default)", "default (CLI 기본 모델로 재설정)"),
      value: "default",
    });
  }

  if (cachedModels.length > 0) {
    // Use cached models from SDK
    const filtered = cachedModels
      .filter(
        (m) =>
          m.displayName.toLowerCase().includes(focused) ||
          m.value.toLowerCase().includes(focused),
      )
      .map((m) => ({
        name: `${m.displayName} (${m.value})`,
        value: m.value,
      }));
    choices.push(...filtered);
  } else {
    // Fallback: hardcoded common models
    const fallbackModels = [
      { name: "Claude Sonnet 4", value: "claude-sonnet-4-20250514" },
      { name: "Claude Opus 4", value: "claude-opus-4-20250514" },
      { name: "Claude Haiku 3.5", value: "claude-3-5-haiku-20241022" },
    ];
    const filtered = fallbackModels.filter(
      (m) =>
        m.name.toLowerCase().includes(focused) ||
        m.value.toLowerCase().includes(focused),
    );
    choices.push(
      ...filtered.map((m) => ({
        name: `${m.name} (${m.value})`,
        value: m.value,
      })),
    );
  }

  await interaction.respond(choices.slice(0, 25));
}
