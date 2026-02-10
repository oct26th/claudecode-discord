import path from "node:path";
import fs from "node:fs";
import { getConfig } from "../utils/config.js";

// Rate limit: track requests per user
const requestCounts = new Map<string, { count: number; resetAt: number }>();

export function isAllowedUser(userId: string): boolean {
  const config = getConfig();
  return config.ALLOWED_USER_IDS.includes(userId);
}

export function checkRateLimit(userId: string): boolean {
  const config = getConfig();
  const now = Date.now();
  const windowMs = 60_000; // 1 minute

  let entry = requestCounts.get(userId);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    requestCounts.set(userId, entry);
  }

  entry.count++;
  return entry.count <= config.RATE_LIMIT_PER_MINUTE;
}

export function validateProjectPath(projectPath: string): string | null {
  const resolved = path.resolve(projectPath);

  // Block path traversal
  if (projectPath.includes("..")) {
    return "Path must not contain '..'";
  }

  // Check existence
  if (!fs.existsSync(resolved)) {
    return `Path does not exist: ${resolved}`;
  }

  // Check it's a directory
  if (!fs.statSync(resolved).isDirectory()) {
    return `Path is not a directory: ${resolved}`;
  }

  return null; // valid
}
