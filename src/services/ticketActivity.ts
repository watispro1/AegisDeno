/**
 * Keeps an open ticket's `lastActivityAt` current for the inactivity auto-close
 * without writing to MongoDB on every message.
 *
 * Auto-close works in hours, so one write per ticket channel per minute is
 * plenty. Channels that turned out not to be open tickets are remembered for a
 * while too, so ordinary chat channels cost one cheap write every few minutes
 * instead of one per message. A ticket gets a brand-new channel, so a channel
 * never becomes a ticket after being seen as a non-ticket.
 */
import { TicketModel } from "../database/mongo";
import { logger } from "../utils/logger";

export const TICKET_TOUCH_INTERVAL_MS = 60_000;
export const NON_TICKET_RECHECK_MS = 10 * 60_000;
const MAX_TRACKED_CHANNELS = 20_000;

/** Pure throttle: decides whether a channel's activity should be written now. */
export class ActivityThrottle {
  private readonly nextWriteAt = new Map<string, number>();

  constructor(
    private readonly intervalMs = TICKET_TOUCH_INTERVAL_MS,
    private readonly idleMs = NON_TICKET_RECHECK_MS,
    private readonly maxEntries = MAX_TRACKED_CHANNELS,
  ) {}

  /** True when a write is due; reserves the slot so concurrent messages don't also write. */
  shouldWrite(channelId: string, now: number): boolean {
    const due = this.nextWriteAt.get(channelId);
    if (due !== undefined && now < due) return false;
    this.set(channelId, now + this.intervalMs);
    return true;
  }

  /** Record the write's outcome: a channel with no open ticket is skipped for longer. */
  settle(channelId: string, matchedTicket: boolean, now: number): void {
    this.set(channelId, now + (matchedTicket ? this.intervalMs : this.idleMs));
  }

  /** Forget a channel, e.g. when its ticket closes. */
  forget(channelId: string): void {
    this.nextWriteAt.delete(channelId);
  }

  get size(): number {
    return this.nextWriteAt.size;
  }

  private set(channelId: string, at: number): void {
    this.nextWriteAt.delete(channelId);
    this.nextWriteAt.set(channelId, at);
    if (this.nextWriteAt.size > this.maxEntries) {
      const oldest = this.nextWriteAt.keys().next().value;
      if (oldest !== undefined) this.nextWriteAt.delete(oldest);
    }
  }
}

const throttle = new ActivityThrottle();

export function touchTicketActivity(guildId: string, channelId: string, now = Date.now()): void {
  if (!throttle.shouldWrite(channelId, now)) return;
  TicketModel.updateOne(
    { channelId, guildId, status: "open" },
    { $set: { lastActivityAt: new Date(now) } },
  )
    .then((res) => throttle.settle(channelId, res.matchedCount > 0, Date.now()))
    .catch((err) => {
      throttle.forget(channelId);
      logger.debug(`Ticket activity write failed for channel ${channelId}:`, err);
    });
}
