import { WarningModel } from "../database/mongo";

export interface Warning {
  _id: string;
  guildId: string;
  userId: string;
  moderatorId: string;
  reason: string;
  proofUrl?: string | null;
  revoked?: boolean;
  createdAt: Date;
}

/** Mongo filter that leaves out warnings reversed with the /warn Undo button. */
export const NOT_REVOKED = { revoked: { $ne: true } } as const;

export async function addWarning(
  guildId: string,
  userId: string,
  moderatorId: string,
  reason: string,
  proofUrl: string | null = null,
): Promise<Warning> {
  const warning = await WarningModel.create({
    guildId,
    userId,
    moderatorId,
    reason,
    proofUrl,
  });
  const obj = warning.toObject() as unknown as Warning;
  return { ...obj, _id: String(warning._id) };
}

/** Active (not revoked) warnings for a member, newest first. */
export async function getWarningsForUser(guildId: string, userId: string): Promise<Warning[]> {
  const warnings = await WarningModel.find({ guildId, userId, ...NOT_REVOKED }).sort({ createdAt: -1 }).lean();
  return warnings as unknown as Warning[];
}

export async function clearWarningsForUser(guildId: string, userId: string): Promise<number> {
  const result = await WarningModel.deleteMany({ guildId, userId });
  return result.deletedCount || 0;
}

/**
 * Every warning record for a member, newest first, revoked ones included.
 * This is the full set /clearwarnings deletes, so its confirmation can show
 * exactly what goes.
 */
export async function getWarningRecordsForUser(guildId: string, userId: string): Promise<Warning[]> {
  const warnings = await WarningModel.find({ guildId, userId }).sort({ createdAt: -1 }).lean();
  return warnings as unknown as Warning[];
}

/** Delete exactly these warning records (scoped to the guild and member). Returns how many were deleted. */
export async function deleteWarningsByIds(guildId: string, userId: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const result = await WarningModel.deleteMany({ guildId, userId, _id: { $in: ids } });
  return result.deletedCount || 0;
}

export interface WarningRecordCounts {
  active: number;
  revoked: number;
  total: number;
}

/** Split warning records into active and revoked (undone) ones. */
export function countWarningRecords(records: ReadonlyArray<{ revoked?: boolean | null }>): WarningRecordCounts {
  const revoked = records.filter(r => r.revoked === true).length;
  return { active: records.length - revoked, revoked, total: records.length };
}

/**
 * Human wording for a set of warning records, e.g. "**3** warning(s)" or
 * "**4** warning record(s) (**3** active, **1** revoked)". Pass `bold: false`
 * for plain text (case details).
 */
export function describeWarningRecords(c: WarningRecordCounts, bold = true): string {
  const b = (n: number) => (bold ? `**${n}**` : String(n));
  if (c.revoked === 0) return `${b(c.active)} warning(s)`;
  if (c.active === 0) return `${b(c.revoked)} revoked warning record(s)`;
  return `${b(c.total)} warning record(s) (${b(c.active)} active, ${b(c.revoked)} revoked)`;
}

/**
 * Count a member's active warnings. When `since` is given, only warnings
 * issued at or after that time count (used for escalation warning expiry).
 */
export async function getTotalWarningCount(guildId: string, userId: string, since: Date | null = null): Promise<number> {
  return await WarningModel.countDocuments({
    guildId,
    userId,
    ...NOT_REVOKED,
    ...(since ? { createdAt: { $gte: since } } : {}),
  });
}

export async function removeWarning(guildId: string, warningId: string): Promise<boolean> {
  const result = await WarningModel.findOneAndDelete({ _id: warningId, guildId });
  return result !== null;
}

/** Mark a warning revoked (kept for the record). Returns false if missing or already revoked. */
export async function revokeWarning(guildId: string, warningId: string, revokedBy: string): Promise<boolean> {
  const result = await WarningModel.findOneAndUpdate(
    { _id: warningId, guildId, ...NOT_REVOKED },
    { $set: { revoked: true, revokedBy, revokedAt: new Date() } },
  );
  return result !== null;
}
