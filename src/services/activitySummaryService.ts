import { ModerationCaseModel, WarningModel, TicketModel, SuggestionModel, AutoResponderModel } from "../database/mongo";

export interface ActivitySummary {
  guildId: string;
  totalWarnings: number;
  totalCases: number;
  openTickets: number;
  closedTickets: number;
  totalSuggestions: number;
  approvedSuggestions: number;
  totalAutoResponders: number;
  recentCases: Array<{ action: string; count: number }>;
}

export async function getGuildActivitySummary(guildId: string, timeframeDays = 7): Promise<ActivitySummary> {
  const since = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000);

  const [
    totalWarnings,
    totalCases,
    openTickets,
    closedTickets,
    totalSuggestions,
    approvedSuggestions,
    totalAutoResponders,
    casesAggregate,
  ] = await Promise.all([
    WarningModel.countDocuments({ guildId, createdAt: { $gte: since } }),
    ModerationCaseModel.countDocuments({ guildId, createdAt: { $gte: since } }),
    TicketModel.countDocuments({ guildId, status: "open" }),
    TicketModel.countDocuments({ guildId, status: "closed", closedAt: { $gte: since } }),
    SuggestionModel.countDocuments({ guildId, createdAt: { $gte: since } }),
    SuggestionModel.countDocuments({ guildId, status: "approved", createdAt: { $gte: since } }),
    AutoResponderModel.countDocuments({ guildId, enabled: true }),
    ModerationCaseModel.aggregate([
      { $match: { guildId, createdAt: { $gte: since } } },
      { $group: { _id: "$action", count: { $sum: 1 } } },
    ]),
  ]);

  const recentCases = casesAggregate.map(item => ({
    action: String(item._id),
    count: Number(item.count),
  }));

  return {
    guildId,
    totalWarnings,
    totalCases,
    openTickets,
    closedTickets,
    totalSuggestions,
    approvedSuggestions,
    totalAutoResponders,
    recentCases,
  };
}
