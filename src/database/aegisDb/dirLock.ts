/**
 * Exclusive lock on an AegisDB data directory, so two processes (or two
 * engines in one process) never replay and append to the same files.
 *
 * Node has no flock(), so the lock is a file created with O_EXCL that records
 * who holds it. A lock left behind by a process that is gone (a crash, or a
 * container restart that reused the same PID) is detected and taken over.
 */
import fs from "node:fs";
import path from "node:path";

interface LockOwner {
  pid: number;
  /** Process start time in clock ticks since boot (Linux), or null elsewhere. */
  start: string | null;
  /** Kernel boot id (Linux), or null elsewhere. */
  boot: string | null;
}

function readTrimmed(file: string): string | null {
  try {
    return fs.readFileSync(file, "utf8").trim();
  } catch {
    return null;
  }
}

function processStart(pid: number): string | null {
  const stat = readTrimmed(`/proc/${pid}/stat`);
  if (!stat) return null;
  // Field 22 (starttime); the command name in field 2 may contain spaces, so split after ")".
  const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
  return fields[19] ?? null;
}

function currentOwner(): LockOwner {
  return {
    pid: process.pid,
    start: processStart(process.pid),
    boot: readTrimmed("/proc/sys/kernel/random/boot_id"),
  };
}

function ownerAlive(owner: LockOwner): boolean {
  if (!Number.isInteger(owner.pid) || owner.pid <= 0) return false;
  const boot = readTrimmed("/proc/sys/kernel/random/boot_id");
  if (owner.boot && boot) {
    if (owner.boot !== boot) return false;
    const start = processStart(owner.pid);
    return start !== null && start === owner.start;
  }
  try {
    process.kill(owner.pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

export class DirLockError extends Error {
  constructor(dir: string, holder: number) {
    super(`AegisDB data directory ${dir} is locked by process ${holder}`);
    this.name = "DirLockError";
  }
}

export class DirLock {
  private released = false;

  private constructor(private readonly file: string, private readonly owner: LockOwner) {}

  static acquire(dir: string, fileName: string): DirLock {
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, fileName);
    const me = currentOwner();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const fd = fs.openSync(file, "wx");
        fs.writeSync(fd, JSON.stringify(me));
        fs.fsyncSync(fd);
        fs.closeSync(fd);
        return new DirLock(file, me);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      }
      let holder: LockOwner | null = null;
      try {
        holder = JSON.parse(fs.readFileSync(file, "utf8")) as LockOwner;
      } catch {
        holder = null; // unreadable or half-written: treat as stale
      }
      if (holder && ownerAlive(holder)) throw new DirLockError(dir, holder.pid);
      fs.rmSync(file, { force: true });
    }
    throw new Error(`AegisDB could not acquire lock ${file}`);
  }

  release(): void {
    if (this.released) return;
    this.released = true;
    try {
      const holder = JSON.parse(fs.readFileSync(this.file, "utf8")) as LockOwner;
      if (holder.pid === this.owner.pid && holder.start === this.owner.start) fs.rmSync(this.file, { force: true });
    } catch {
      // already gone
    }
  }
}
