import { TaskModel } from "../database/mongo";

export type TaskType = "reminder" | "scheduled";

export interface ScheduledTask {
  _id: string; // Mongo ID mapping
  id?: string; // Legacy mapping
  guildId: string;
  channelId: string;
  creatorId: string;
  type: TaskType;
  payload: string;
  executeAt: Date;
  createdAt: Date;
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
  
  const obj = task.toObject() as Omit<ScheduledTask, "id"> & { _id: unknown };
  return { ...obj, id: String(obj._id) } as ScheduledTask;
}

export async function getTask(guildId: string, id: string): Promise<ScheduledTask | null> {
  try {
    const doc = await TaskModel.findOne({ _id: id, guildId });
    if (!doc) return null;
    const obj = doc.toObject() as Omit<ScheduledTask, "id"> & { _id: unknown };
    return { ...obj, id: String(obj._id) } as ScheduledTask;
  } catch {
    return null; // For invalid ObjectIDs
  }
}

export async function getTasksForGuild(guildId: string, creatorId?: string): Promise<ScheduledTask[]> {
  const filter: { guildId: string; creatorId?: string } = { guildId };
  if (creatorId) filter.creatorId = creatorId;

  const docs = await TaskModel.find(filter).sort({ executeAt: 1 });
  return docs.map(doc => {
    const obj = doc.toObject() as Omit<ScheduledTask, "id"> & { _id: unknown };
    return { ...obj, id: String(obj._id) } as ScheduledTask;
  });
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
  return docs.map(doc => {
    const obj = doc.toObject() as any;
    obj.id = obj._id.toString();
    return obj as unknown as ScheduledTask;
  }) as ScheduledTask[];
}
