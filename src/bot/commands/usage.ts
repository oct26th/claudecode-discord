import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { getProject, getSession } from "../../db/database.js";
import { getConfig } from "../../utils/config.js";
import { L } from "../../utils/i18n.js";

export const data = new SlashCommandBuilder()
  .setName("usage")
  .setDescription("Show current session stats (turns, cost, uptime)");

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const channelId = interaction.channelId;
  const project = getProject(channelId);

  if (!project) {
    await interaction.editReply({
      content: L(
        "This channel is not registered to any project. Use `/register` first.",
        "이 채널은 어떤 프로젝트에도 등록되어 있지 않습니다. 먼저 `/register`를 사용하세요.",
      ),
    });
    return;
  }

  const session = getSession(channelId);

  if (!session || !session.session_id) {
    await interaction.editReply({
      content: L("No active session for this channel.", "이 채널에 활성 세션이 없습니다."),
    });
    return;
  }

  const config = getConfig();
  const now = Date.now();

  const createdAt = session.created_at
    ? new Date(session.created_at + "Z")
    : null;
  const lastActivity = session.last_activity
    ? new Date(session.last_activity + "Z")
    : null;

  const sessionAge = createdAt
    ? formatDuration(now - createdAt.getTime())
    : L("unknown", "알 수 없음");

  const idleTime = lastActivity
    ? formatDuration(now - lastActivity.getTime())
    : L("unknown", "알 수 없음");

  const turnDisplay =
    config.SESSION_MAX_TURNS > 0
      ? `${session.turn_count} / ${config.SESSION_MAX_TURNS}`
      : `${session.turn_count}`;

  const ttlDisplay =
    config.SESSION_TTL_HOURS > 0
      ? `${config.SESSION_TTL_HOURS}h`
      : L("disabled", "비활성화됨");

  const sessionIdShort = session.session_id.slice(0, 8);

  const fields = [
    {
      name: L("Session ID", "세션 ID"),
      value: `\`${sessionIdShort}…\``,
      inline: true,
    },
    {
      name: L("Session Age", "세션 나이"),
      value: sessionAge,
      inline: true,
    },
    {
      name: L("Idle For", "유휴 시간"),
      value: idleTime,
      inline: true,
    },
    {
      name: L("Turns", "대화 수"),
      value: turnDisplay,
      inline: true,
    },
    {
      name: L("TTL", "만료 시간"),
      value: ttlDisplay,
      inline: true,
    },
  ];

  if (config.SHOW_COST) {
    fields.push({
      name: L("Total Cost", "총 비용"),
      value: `$${session.total_cost_usd.toFixed(4)}`,
      inline: true,
    });
  }

  await interaction.editReply({
    embeds: [
      {
        title: L("Session Usage", "세션 사용량"),
        fields,
        color: 0x5865f2,
        footer: {
          text: `Project: ${project.project_path}`,
        },
      },
    ],
  });
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(" ");
}
