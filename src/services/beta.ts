import { BetaFeedbackModel, BetaProgramModel } from "../database/mongo";
import { BETA_GUILD_ID } from "../config/env";

export const BETA_FEATURES = {
  "beta-feedback": {
    label: "Beta Feedback System",
    description: "Structured feedback collection with categorization, severity triage, and staff resolution workflows.",
    category: "Operations",
  },
  "experimental-automod": {
    label: "Experimental AutoMod (Caps & Flood)",
    description: "Heuristic caps detection and repetitive character flooding filters with fine-grained thresholds.",
    category: "Safety",
  },
  "command-lab": {
    label: "Command Lab & Rule Simulator",
    description: "Interactive safety playground to simulate caps, regex, invite link leaks, and mention velocity safely.",
    category: "Diagnostics",
  },
  "smart-anti-raid": {
    label: "Smart Anti-Raid Shield",
    description: "Adaptive join velocity analysis with auto-lockdown triggers and member arrival telemetry.",
    category: "Security",
  },
  "ai-moderation-preview": {
    label: "Heuristic Toxicity & Spam Analyzer",
    description: "Statistical pattern matching and token entropy analyzer for identifying bot spam and evasion.",
    category: "AI & Heuristics",
  },
  "starboard-custom-rules": {
    label: "Starboard Multi-Emoji & Custom Tiers",
    description: "Advanced tiered starboards with multiple trigger emojis, role-based star multipliers, and custom embed themes.",
    category: "Community",
  },
} as const;

export type BetaFeatureKey = keyof typeof BETA_FEATURES;
export type BetaFeedbackCategory = "bug" | "feature" | "improvement" | "question";
export type BetaFeedbackSeverity = "low" | "medium" | "high" | "critical";
export type BetaFeedbackStatus = "open" | "investigating" | "resolved" | "declined";

export interface BetaProgram {
  guildId: string;
  testerIds: string[];
  enabledFeatures: BetaFeatureKey[];
  enrolledGuilds: string[];
}

function normalize(guildId: string, source?: { testerIds?: unknown; enabledFeatures?: unknown; enrolledGuilds?: unknown }): BetaProgram {
  return {
    guildId,
    testerIds: Array.isArray(source?.testerIds)
      ? [...new Set(source.testerIds.filter((id): id is string => typeof id === "string" && Boolean(id)))]
      : [],
    enabledFeatures: (Array.isArray(source?.enabledFeatures) ? source.enabledFeatures : ["beta-feedback", "command-lab"])
      .filter((feature): feature is BetaFeatureKey => typeof feature === "string" && feature in BETA_FEATURES),
    enrolledGuilds: Array.isArray(source?.enrolledGuilds)
      ? [...new Set(source.enrolledGuilds.filter((id): id is string => typeof id === "string" && Boolean(id)))]
      : [],
  };
}

export async function getBetaProgram(guildId: string = BETA_GUILD_ID): Promise<BetaProgram> {
  const doc = await BetaProgramModel.findOne({ guildId }).lean();
  return normalize(guildId, doc ?? undefined);
}

/** Check if a guild is authorized for beta participation (root beta guild or enrolled guild). */
export async function isBetaGuild(guildId: string): Promise<boolean> {
  if (guildId === BETA_GUILD_ID) return true;
  const rootProgram = await getBetaProgram(BETA_GUILD_ID);
  return rootProgram.enrolledGuilds.includes(guildId);
}

/** Enroll an additional guild into the managed beta program. */
export async function enrollGuild(guildId: string, updatedBy: string): Promise<BetaProgram> {
  const doc = await BetaProgramModel.findOneAndUpdate(
    { guildId: BETA_GUILD_ID },
    { $addToSet: { enrolledGuilds: guildId }, $set: { updatedBy, updatedAt: new Date() } },
    { new: true, upsert: true }
  ).lean();
  return normalize(BETA_GUILD_ID, doc ?? undefined);
}

/** Unenroll a guild from the managed beta program. */
export async function unenrollGuild(guildId: string, updatedBy: string): Promise<BetaProgram> {
  const doc = await BetaProgramModel.findOneAndUpdate(
    { guildId: BETA_GUILD_ID },
    { $pull: { enrolledGuilds: guildId }, $set: { updatedBy, updatedAt: new Date() } },
    { new: true, upsert: true }
  ).lean();
  return normalize(BETA_GUILD_ID, doc ?? undefined);
}

export async function setTester(guildId: string, userId: string, enabled: boolean, updatedBy: string): Promise<BetaProgram> {
  const targetGuild = guildId === BETA_GUILD_ID ? BETA_GUILD_ID : guildId;
  const operator = enabled ? "$addToSet" : "$pull";
  const doc = await BetaProgramModel.findOneAndUpdate(
    { guildId: targetGuild },
    { [operator]: { testerIds: userId }, $set: { updatedBy, updatedAt: new Date() }, $setOnInsert: { enabledFeatures: ["beta-feedback", "command-lab"] } },
    { new: true, upsert: true },
  ).lean();
  return normalize(targetGuild, doc ?? undefined);
}

export async function setFeature(guildId: string, feature: BetaFeatureKey, enabled: boolean, updatedBy: string): Promise<BetaProgram> {
  const targetGuild = guildId === BETA_GUILD_ID ? BETA_GUILD_ID : guildId;
  const operator = enabled ? "$addToSet" : "$pull";
  const doc = await BetaProgramModel.findOneAndUpdate(
    { guildId: targetGuild },
    { [operator]: { enabledFeatures: feature }, $set: { updatedBy, updatedAt: new Date() } },
    { new: true, upsert: true },
  ).lean();
  return normalize(targetGuild, doc ?? undefined);
}

export async function canUseBetaFeature(guildId: string, userId: string, feature: BetaFeatureKey): Promise<boolean> {
  const isAuthorized = await isBetaGuild(guildId);
  if (!isAuthorized) return false;

  const program = await getBetaProgram(guildId);
  const rootProgram = guildId !== BETA_GUILD_ID ? await getBetaProgram(BETA_GUILD_ID) : program;

  const isTester = program.testerIds.includes(userId) || rootProgram.testerIds.includes(userId);
  const isEnabled = program.enabledFeatures.includes(feature) || rootProgram.enabledFeatures.includes(feature);

  return isTester && isEnabled;
}

/** Runtime gate for guild-wide beta behavior, independent of an individual tester. */
export async function isBetaFeatureEnabled(guildId: string, feature: BetaFeatureKey): Promise<boolean> {
  const isAuthorized = await isBetaGuild(guildId);
  if (!isAuthorized) return false;

  const program = await getBetaProgram(guildId);
  const rootProgram = guildId !== BETA_GUILD_ID ? await getBetaProgram(BETA_GUILD_ID) : program;
  return program.enabledFeatures.includes(feature) || rootProgram.enabledFeatures.includes(feature);
}

/* ── Structured Feedback Engine ────────────────────────────────────── */

export async function createBetaFeedback(input: {
  guildId: string;
  authorId: string;
  feature: BetaFeatureKey;
  content: string;
  category?: BetaFeedbackCategory;
  severity?: BetaFeedbackSeverity;
}): Promise<string> {
  const shortId = `BETA-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  await BetaFeedbackModel.create({
    id: shortId,
    guildId: input.guildId,
    authorId: input.authorId,
    feature: input.feature,
    category: input.category || "bug",
    severity: input.severity || "medium",
    status: "open",
    content: input.content,
  });
  return shortId;
}

export async function getRecentBetaFeedback(guildId?: string, filter?: { status?: BetaFeedbackStatus; category?: BetaFeedbackCategory; limit?: number }) {
  const query: Record<string, unknown> = {};
  if (guildId && guildId !== BETA_GUILD_ID) query.guildId = guildId;
  if (filter?.status) query.status = filter.status;
  if (filter?.category) query.category = filter.category;

  const limit = Math.min(filter?.limit || 10, 50);
  return BetaFeedbackModel.find(query).sort({ createdAt: -1 }).limit(limit).lean();
}

export async function getBetaFeedbackById(id: string) {
  return BetaFeedbackModel.findOne({ id }).lean();
}

export async function updateFeedbackStatus(
  id: string,
  status: BetaFeedbackStatus,
  resolvedBy: string,
  staffNote?: string
) {
  return BetaFeedbackModel.findOneAndUpdate(
    { id },
    {
      $set: {
        status,
        resolvedBy,
        staffNote: staffNote || null,
        resolvedAt: status === "resolved" || status === "declined" ? new Date() : null,
      },
    },
    { new: true }
  ).lean();
}

export async function getTesterStats(userId: string) {
  const allFeedback = await BetaFeedbackModel.find({ authorId: userId }).lean();
  const resolved = allFeedback.filter(f => f.status === "resolved").length;
  const bugs = allFeedback.filter(f => f.category === "bug").length;

  const badges: string[] = ["🧪 Beta Pioneer"];
  if (allFeedback.length >= 5) badges.push("🎖️ Active Tester");
  if (bugs >= 3) badges.push("🐛 Bug Hunter");
  if (resolved >= 3) badges.push("🏆 Verified Contributor");
  if (allFeedback.length >= 15) badges.push("💎 Master Diagnostician");

  return {
    totalSubmitted: allFeedback.length,
    resolved,
    bugs,
    badges,
  };
}

export async function getBetaLeaderboard(limit = 10) {
  const agg = await BetaFeedbackModel.aggregate([
    { $group: { _id: "$authorId", count: { $sum: 1 }, resolved: { $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] } } } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);
  return agg.map(a => ({
    userId: String(a._id),
    count: Number(a.count),
    resolved: Number(a.resolved),
  }));
}

/* ── Interactive Command Lab Simulation Engine ─────────────────────── */

export interface SimulationResult {
  rule: string;
  triggered: boolean;
  score: number; // 0 (Safe) to 100 (Critical)
  details: string;
  recommendation: string;
}

export function analyzeCaps(message: string, threshold = 80): SimulationResult {
  const letters = message.match(/[a-z]/gi) ?? [];
  const uppercase = letters.filter(letter => letter === letter.toUpperCase()).length;
  const percentage = letters.length ? Math.round((uppercase / letters.length) * 100) : 0;
  const eligible = letters.length >= 8;
  const triggered = eligible && percentage >= threshold;

  const score = eligible ? Math.min(100, Math.round((percentage / 100) * 85)) : 10;

  return {
    rule: "Excessive Caps Detection",
    triggered,
    score: triggered ? Math.max(score, 75) : score,
    details: `${uppercase}/${letters.length} uppercase letters (${percentage}%). Minimum length: 8 (current: ${letters.length}). Threshold: ${threshold}%.`,
    recommendation: triggered
      ? "Message exceeds threshold. AutoMod action: Warning or message purge."
      : "Message passed caps inspection.",
  };
}

export function analyzeFlood(message: string, minConsecutive = 4): SimulationResult {
  const runMatches = message.match(new RegExp(`(.)\\1{${minConsecutive - 1},}`, "gi")) ?? [];
  let maxRun = 0;
  let sampleRun = "";

  for (const match of runMatches) {
    if (match.length > maxRun) {
      maxRun = match.length;
      sampleRun = match;
    }
  }

  const triggered = maxRun >= minConsecutive;
  const score = triggered ? Math.min(100, 40 + (maxRun * 8)) : 5;

  return {
    rule: "Character Flood & Spam Runs",
    triggered,
    score,
    details: triggered
      ? `Found ${runMatches.length} character spam run(s). Longest streak: "${sampleRun.slice(0, 10)}${sampleRun.length > 10 ? "..." : ""}" (${maxRun} chars).`
      : "No repetitive character floods detected.",
    recommendation: triggered
      ? "Repetitive flood detected. AutoMod action: Rate-limit or delete message."
      : "Normal character distribution.",
  };
}

export function analyzeInvites(message: string): SimulationResult {
  const rawInviteRegex = /(?:discord\.gg|discord(?:app)?\.com\/invite)\/([a-zA-Z0-9-]+)/gi;
  const rawMatches = [...message.matchAll(rawInviteRegex)];

  // Zero-width / obfuscation scan
  const sanitized = message.replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, "");
  const obfuscated = /(?:discord\.gg|discord(?:app)?\.com\/invite)/i.test(sanitized) && rawMatches.length === 0;

  const triggered = rawMatches.length > 0 || obfuscated;
  const inviteCodes = rawMatches.map(m => m[1]);

  return {
    rule: "Discord Invite Shield",
    triggered,
    score: triggered ? (obfuscated ? 95 : 80) : 0,
    details: triggered
      ? obfuscated
        ? "Detected obfuscated / zero-width space disguised Discord invite link!"
        : `Detected ${rawMatches.length} Discord invite(s): ${inviteCodes.map(c => `\`${c}\``).join(", ")}.`
      : "No Discord invite links found in payload.",
    recommendation: triggered
      ? "Unauthorized server link. AutoMod action: Immediate purge & staff alert."
      : "Payload is free of external server invites.",
  };
}

export function analyzeMentions(message: string, maxAllowed = 5): SimulationResult {
  const userMentions = (message.match(/<@!?\d+>/g) ?? []).length;
  const roleMentions = (message.match(/<@&\d+>/g) ?? []).length;
  const hasBroadcast = /@(everyone|here)/i.test(message);
  const total = userMentions + roleMentions + (hasBroadcast ? 5 : 0);

  const triggered = total >= maxAllowed;
  const score = triggered ? Math.min(100, 50 + (total * 8)) : (total > 0 ? total * 10 : 0);

  return {
    rule: "Mass Mention / Ping Velocity",
    triggered,
    score,
    details: `Users: ${userMentions}, Roles: ${roleMentions}, Broadcast: ${hasBroadcast ? "Yes (@everyone/@here)" : "No"}. Total weight: ${total} (Limit: ${maxAllowed}).`,
    recommendation: triggered
      ? "Mass mention threshold breached. AutoMod action: Instant timeout & message deletion."
      : "Mention count is within safe thresholds.",
  };
}

export function analyzeEntropy(message: string): SimulationResult {
  if (message.length < 10) {
    return {
      rule: "Token Entropy & Statistical Spam Heuristics",
      triggered: false,
      score: 10,
      details: "Message too short for meaningful entropy analysis.",
      recommendation: "Passes heuristic check.",
    };
  }

  // Calculate Shannon entropy: H = -sum(p * log2(p))
  const frequencies = new Map<string, number>();
  for (const ch of message) {
    frequencies.set(ch, (frequencies.get(ch) || 0) + 1);
  }

  const len = message.length;
  let entropy = 0;
  for (const count of frequencies.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }

  // Normal readable English text typically has entropy ~3.0 - 4.5
  // Extremely low entropy (< 1.8) indicates heavy copy-paste repetition
  // Extremely high entropy (> 5.2) on moderate strings indicates base64 / token leaks / obfuscation
  const isTooRepetitive = entropy < 2.0 && len > 20;
  const isHighEntropyGibberish = entropy > 4.8 && len > 35;
  const triggered = isTooRepetitive || isHighEntropyGibberish;

  const score = isHighEntropyGibberish ? 75 : isTooRepetitive ? 65 : 15;

  return {
    rule: "Token Entropy & Statistical Spam Heuristics",
    triggered,
    score,
    details: `Shannon entropy: ${entropy.toFixed(2)} bits/char (${frequencies.size} distinct characters across ${len} total chars).`,
    recommendation: isTooRepetitive
      ? "Abnormally low entropy (heavy repetition pattern). Possible spam script."
      : isHighEntropyGibberish
      ? "Abnormally high entropy (possible random token, encrypted payload, or evasion string)."
      : "Natural human linguistic entropy detected.",
  };
}

export function runFullLabSuite(message: string): {
  overallRisk: "SAFE" | "LOW RISK" | "SUSPICIOUS" | "HIGH RISK" | "CRITICAL";
  compositeScore: number;
  results: SimulationResult[];
} {
  const results = [
    analyzeCaps(message),
    analyzeFlood(message),
    analyzeInvites(message),
    analyzeMentions(message),
    analyzeEntropy(message),
  ];

  const maxScore = Math.max(...results.map(r => r.score));
  const avgScore = Math.round(results.reduce((acc, r) => acc + r.score, 0) / results.length);
  const compositeScore = Math.max(maxScore, avgScore);

  let overallRisk: "SAFE" | "LOW RISK" | "SUSPICIOUS" | "HIGH RISK" | "CRITICAL" = "SAFE";
  if (compositeScore >= 85) overallRisk = "CRITICAL";
  else if (compositeScore >= 70) overallRisk = "HIGH RISK";
  else if (compositeScore >= 45) overallRisk = "SUSPICIOUS";
  else if (compositeScore >= 20) overallRisk = "LOW RISK";

  return {
    overallRisk,
    compositeScore,
    results,
  };
}
