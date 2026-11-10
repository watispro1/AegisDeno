/** Answers for /roleinfo and /channelinfo about what Aegis itself can do. Kept pure so they can be tested. */

export interface RoleAssignInput {
  isEveryone: boolean;
  managed: boolean;
  rolePosition: number;
  botHighestPosition: number | null;
  botHasManageRoles: boolean;
}

/** Text for the "Bot can assign" field. Managed roles belong to a bot or integration and can never be given by hand. */
export function roleAssignLabel(input: RoleAssignInput): string {
  if (input.isEveryone) return "No (@everyone)";
  if (input.managed) return "No (managed by a bot or integration)";
  if (input.botHighestPosition === null) return "No";
  if (!input.botHasManageRoles) return "No (missing Manage Roles)";
  if (input.botHighestPosition <= input.rolePosition) return "No (role is above or equal to Aegis's highest role)";
  return "Yes";
}

export type PermissionName = "ViewChannel" | "SendMessages" | "SendMessagesInThreads" | "ManageThreads";

export interface PostAccessInput {
  isThread: boolean;
  isPrivateThread: boolean;
  botInThread: boolean;
  locked: boolean;
  /** Permissions Aegis has in the channel. For a thread these come from its parent channel. */
  has: (permission: PermissionName) => boolean;
}

/** Text for the "Aegis can send" field, using the permission Discord checks for that kind of channel. */
export function postAccessLabel(input: PostAccessInput): string {
  if (!input.has("ViewChannel")) return input.isThread ? "No (can't view the parent channel)" : "No (can't view)";
  if (!input.isThread) return input.has("SendMessages") ? "Yes" : "No (missing Send Messages)";
  if (!input.has("SendMessagesInThreads")) return "No (missing Send Messages in Threads)";
  const canManage = input.has("ManageThreads");
  if (input.isPrivateThread && !input.botInThread && !canManage) return "No (not added to this private thread)";
  if (input.locked && !canManage) return "No (thread is locked)";
  return "Yes";
}
