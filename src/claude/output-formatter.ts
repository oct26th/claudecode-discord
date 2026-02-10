import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

const MAX_DISCORD_LENGTH = 1900; // leave room for formatting

export function formatStreamChunk(text: string): string {
  if (text.length <= MAX_DISCORD_LENGTH) return text;
  return text.slice(0, MAX_DISCORD_LENGTH) + "\n... (truncated)";
}

export function splitMessage(text: string): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= MAX_DISCORD_LENGTH) {
      chunks.push(remaining);
      break;
    }

    // Try to split at a newline
    let splitAt = remaining.lastIndexOf("\n", MAX_DISCORD_LENGTH);
    if (splitAt === -1 || splitAt < MAX_DISCORD_LENGTH / 2) {
      splitAt = MAX_DISCORD_LENGTH;
    }

    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }

  return chunks;
}

export function createToolApprovalEmbed(
  toolName: string,
  input: Record<string, unknown>,
  requestId: string,
): { embed: EmbedBuilder; row: ActionRowBuilder<ButtonBuilder> } {
  const embed = new EmbedBuilder()
    .setTitle(`🔧 Tool Use: ${toolName}`)
    .setColor(0xffa500)
    .setTimestamp();

  // Add relevant fields based on tool type
  if (toolName === "Edit" || toolName === "Write") {
    const filePath = (input.file_path as string) ?? "unknown";
    embed.addFields({ name: "File", value: `\`${filePath}\``, inline: false });

    if (input.old_string && input.new_string) {
      const diff = `\`\`\`diff\n- ${String(input.old_string).slice(0, 500)}\n+ ${String(input.new_string).slice(0, 500)}\n\`\`\``;
      embed.addFields({ name: "Changes", value: diff, inline: false });
    } else if (input.content) {
      const preview = String(input.content).slice(0, 500);
      embed.addFields({
        name: "Content Preview",
        value: `\`\`\`\n${preview}\n\`\`\``,
        inline: false,
      });
    }
  } else if (toolName === "Bash") {
    const command = (input.command as string) ?? "unknown";
    const description = (input.description as string) ?? "";
    embed.addFields(
      { name: "Command", value: `\`\`\`bash\n${command}\n\`\`\``, inline: false },
    );
    if (description) {
      embed.addFields({ name: "Description", value: description, inline: false });
    }
  } else {
    // Generic tool display
    const summary = JSON.stringify(input, null, 2).slice(0, 800);
    embed.addFields({
      name: "Input",
      value: `\`\`\`json\n${summary}\n\`\`\``,
      inline: false,
    });
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`approve:${requestId}`)
      .setLabel("Approve")
      .setStyle(ButtonStyle.Success)
      .setEmoji("✅"),
    new ButtonBuilder()
      .setCustomId(`deny:${requestId}`)
      .setLabel("Deny")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("❌"),
    new ButtonBuilder()
      .setCustomId(`approve-all:${requestId}`)
      .setLabel("Auto-approve All")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("⚡"),
  );

  return { embed, row };
}

export function createResultEmbed(
  result: string,
  costUsd: number,
  durationMs: number,
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("✅ Task Complete")
    .setDescription(result.slice(0, 4000))
    .setColor(0x00ff00)
    .addFields(
      { name: "Cost", value: `$${costUsd.toFixed(4)}`, inline: true },
      {
        name: "Duration",
        value: `${(durationMs / 1000).toFixed(1)}s`,
        inline: true,
      },
    )
    .setTimestamp();
}
