import { ButtonInteraction, StringSelectMenuInteraction } from "discord.js";
import { isAllowedUser } from "../../security/guard.js";
import { sessionManager } from "../../claude/session-manager.js";
import { upsertSession } from "../../db/database.js";

export async function handleButtonInteraction(
  interaction: ButtonInteraction,
): Promise<void> {
  if (!isAllowedUser(interaction.user.id)) {
    await interaction.reply({
      content: "You are not authorized.",
      ephemeral: true,
    });
    return;
  }

  const customId = interaction.customId;
  const [action, requestId] = customId.split(":");

  if (!requestId) {
    await interaction.reply({
      content: "Invalid button interaction.",
      ephemeral: true,
    });
    return;
  }

  let decision: "approve" | "deny" | "approve-all";
  if (action === "approve") {
    decision = "approve";
  } else if (action === "deny") {
    decision = "deny";
  } else if (action === "approve-all") {
    decision = "approve-all";
  } else {
    return;
  }

  const resolved = sessionManager.resolveApproval(requestId, decision);
  if (!resolved) {
    await interaction.reply({
      content: "This approval request has expired.",
      ephemeral: true,
    });
    return;
  }

  const labels: Record<string, string> = {
    approve: "✅ Approved",
    deny: "❌ Denied",
    "approve-all": "⚡ Auto-approve enabled for this channel",
  };

  await interaction.update({
    content: labels[decision],
    components: [], // remove buttons
  });
}

export async function handleSelectMenuInteraction(
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  if (!isAllowedUser(interaction.user.id)) {
    await interaction.reply({
      content: "You are not authorized.",
      ephemeral: true,
    });
    return;
  }

  if (interaction.customId === "session-select") {
    const selectedSessionId = interaction.values[0];
    const channelId = interaction.channelId;

    // Store the selected session ID in DB so next message will resume it
    const { randomUUID } = await import("node:crypto");
    upsertSession(randomUUID(), channelId, selectedSessionId, "idle");

    await interaction.update({
      embeds: [
        {
          title: "Session Selected",
          description: [
            `Session: \`${selectedSessionId.slice(0, 8)}...\``,
            "",
            "Next message you send will resume this conversation.",
          ].join("\n"),
          color: 0x00ff00,
        },
      ],
      components: [],
    });
  }
}
