import { TaskModel } from "../database/mongo";

export type TaskType = "reminder" | "scheduled";

export interface ScheduledTask {
  _id: string;
  id?: string;
  guildId: string;
  channelId: string;
  creatorId: string;
  type: TaskType;
  payload: string;
  executeAt: Date;
  createdAt: Date;
}

function toTask(doc: unknown): ScheduledTask {
  const obj = doc as Record<string, unknown>;
  const id = String(obj._id);
  return {
    _id: id,
    id,
    guildId: String(obj.guildId),
    channelId: String(obj.channelId),
    creatorId: String(obj.creatorId),
    type: obj.type as TaskType,
    payload: String(obj.payload),
    executeAt: new Date(obj.executeAt as string | number | Date),
    createdAt: new Date(obj.createdAt as string | number | Date),
  };
}

export async function createTask(
  guildId: string,
  channelId: string,
  creatorId: string,
  type: TaskType,
  payload: string,
  executeAt: Date,
): Promise<ScheduledTask> {
  const task = await TaskModel.create({
    guildId,
    channelId,
    creatorId,
    type,
    payload,
    executeAt,
  });

  return toTask(task.toObject());
}

export async function getTask(guildId: string, id: string): Promise<ScheduledTask | null> {
  try {
    const doc = await TaskModel.findOne({ _id: id, guildId });
    if (!doc) return null;
    return toTask(doc.toObject());
  } catch {
    return null;
  }
}

export async function getTasksForGuild(guildId: string, creatorId?: string): Promise<ScheduledTask[]> {
  const filter: { guildId: string; creatorId?: string } = { guildId };
  if (creatorId) filter.creatorId = creatorId;

  const docs = await TaskModel.find(filter).sort({ executeAt: 1 });
  return docs.map(doc => toTask(doc.toObject()));
}

export async function deleteTask(guildId: string, id: string): Promise<boolean> {
  try {
    const res = await TaskModel.deleteOne({ _id: id, guildId });
    return res.deletedCount > 0;
  } catch {
    return false;
  }
}

export async function getAllPendingTasks(): Promise<ScheduledTask[]> {
  const docs = await TaskModel.find();
  return docs.map(doc => toTask(doc.toObject()));
}