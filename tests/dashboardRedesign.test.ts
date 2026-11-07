import { test } from "node:test";
import assert from "node:assert/strict";
import { renderOverview, type OverviewModel } from "../src/web/dashboard/views/overview";
import { shell, serverSwitcher, type GuildContext, type Viewer } from "../src/web/dashboard/views/layout";
import type { OverviewData } from "../src/web/dashboard/data";
import type { SiteConfig } from "../src/web/pages";
import { discordBotView, cachedBotView, type BotView, type ChannelOption, type RoleOption, type ViewerRoleLimit } from "../src/web/dashboard/botView";
import { auditLabel, renderActivity } from "../src/web/dashboard/views/activity";
import type { AuditEntry } from "../src/web/dashboard/audit";
import type { Client } from "discord.js";

const site: SiteConfig = {
  inviteUrl: "https://discord.com/oauth2/authorize?client_id=1",
  supportUrl: "",
  version: "3.8.0",
  contactEmail: "contact@example.com",
  assetVersion: "test",
};

const USER = "900000000000000001";
const USER_2 = "900000000000000002";
const GUILD = "800000000000000001";
const GUILD_2 = "800000000000000002";

const viewer: Viewer = {
  userId: USER,
  username: "testmod",
  globalName: "Test Mod",
  csrf: "test-csrf-token",
  avatarUrl: null,
};

const ctx: GuildContext = {
  guild: { id: GUILD, name: "Test Server", memberCount: 42, iconUrl: null },
  viewer,
  nameOf: () => null,
  servers: [
    { id: GUILD, name: "Test Server", iconUrl: null },
    { id: GUILD_2, name: "Second Server", iconUrl: null },
  ],
};

const sampleData: OverviewData = {
  cases7: 5,
  cases30: 20,
  warnings7: 2,
  warnings30: 8,
  openTicketCount: 1,
  openTickets: [],
  pendingAppeals: 0,
  recentCases: [],
};

test("overview: bot latency card is rendered when pingMs is provided", () => {
  const modelWithPing: OverviewModel = {
    pingMs: 48,
  };
  const html = renderOverview(site, ctx, sampleData, modelWithPing);
  assert.ok(html.includes("Bot latency"), "renders 'Bot latency' label");
  assert.ok(html.includes("<dd>48 <small>ms</small></dd>"), "renders latency value with ms unit");
});

test("overview: bot latency card is omitted when pingMs is null or negative", () => {
  const htmlNull = renderOverview(site, ctx, sampleData, { pingMs: null });
  assert.ok(!htmlNull.includes("Bot latency"), "omits card when pingMs is null");

  const htmlNeg = renderOverview(site, ctx, sampleData, { pingMs: -1 });
  assert.ok(!htmlNeg.includes("Bot latency"), "omits card when pingMs is negative");
});

test("discordBotView: pingMs returns rounded positive ping or null", () => {
  const fakeClientWithPing = {
    guilds: { cache: new Map() },
    ws: { ping: 37.4 },
  } as unknown as Client;
  const view = discordBotView(fakeClientWithPing);
  assert.equal(view.pingMs?.(), 37);

  const fakeClientNoPing = {
    guilds: { cache: new Map() },
    ws: { ping: -1 },
  } as unknown as Client;
  const viewNoPing = discordBotView(fakeClientNoPing);
  assert.equal(viewNoPing.pingMs?.(), null);
});

test("serverSwitcher: renders header switcher dropdown and other servers", () => {
  const switcherHtml = serverSwitcher(ctx, "top-switcher");
  assert.ok(switcherHtml.includes('class="top-switcher"'), "renders top-switcher class");
  assert.ok(switcherHtml.includes("Switch server, current: Test Server"), "summary aria-label");
  assert.ok(switcherHtml.includes("/dashboard/800000000000000002"), "lists second server link");
  assert.ok(switcherHtml.includes("Second Server"), "includes other server name");
  assert.ok(switcherHtml.includes('href="/dashboard">All servers</a>'), "all servers link");
});

test("shell & layout: header includes switcher, theme toggle and drawer backdrop", () => {
  const html = shell(site, {
    title: "Test Overview",
    path: `/dashboard/${GUILD}`,
    body: "<p>Dashboard body</p>",
    viewer,
    guild: ctx,
    active: "overview",
  });

  // Server switcher in header
  assert.ok(html.includes('class="app-top-switcher"'), "header contains app-top-switcher");
  assert.ok(html.includes("Test Server"), "shows current server in switcher");

  // System/Light/Dark theme toggle in header
  assert.ok(html.includes('class="icon-btn theme-toggle"'), "header contains theme-toggle button");
  assert.ok(html.includes('class="icon-system"'), "includes system theme icon");
  assert.ok(html.includes('class="icon-sun"'), "includes light theme icon");
  assert.ok(html.includes('class="icon-moon"'), "includes dark theme icon");

  // User menu theme options
  assert.ok(html.includes('data-set-theme="system"'), "user menu has system theme option");
  assert.ok(html.includes('data-set-theme="light"'), "user menu has light theme option");
  assert.ok(html.includes('data-set-theme="dark"'), "user menu has dark theme option");

  // Mobile drawer controls
  assert.ok(html.includes('class="drawer-close"'), "sidebar has drawer-close button");
  assert.ok(html.includes('class="drawer-backdrop"'), "sidebar has drawer-backdrop overlay");

  // Grouped folding navigation
  assert.ok(html.includes('details class="nav-group-details"'), "nav groups use details elements");
  assert.ok(html.includes('class="nav-caret"'), "nav group titles include folding carets");
  assert.ok(html.includes('data-nav-group="General"'), "nav group has data-nav-group attribute");
  assert.ok(html.includes('data-active-group=""'), "active group is marked with data-active-group");
});

// --- Caching layer tests ---

test("cachedBotView: textChannels caches results per guild within TTL", () => {
  let callCount = 0;
  const sampleChannels: ChannelOption[] = [{ id: "c1", name: "general", parent: null }];

  const inner: BotView = {
    hasGuild: () => true,
    guild: () => null,
    memberCanManage: async () => true,
    memberHasPermission: async () => true,
    textChannels: (guildId) => {
      callCount++;
      return guildId === GUILD ? sampleChannels : [];
    },
    hiddenChannelIds: () => new Set(),
    roles: () => [],
    viewerRoleLimit: async () => ({ ownerId: null, topPosition: null }),
    userName: () => null,
  };

  const cached = cachedBotView(inner, 5_000);

  // First call hits inner
  assert.deepEqual(cached.textChannels(GUILD), sampleChannels);
  assert.equal(callCount, 1);

  // Second call returns cached without invoking inner
  assert.deepEqual(cached.textChannels(GUILD), sampleChannels);
  assert.equal(callCount, 1);

  // Different guild hits inner again (cross-server isolation)
  assert.deepEqual(cached.textChannels(GUILD_2), []);
  assert.equal(callCount, 2);
});

test("cachedBotView: roles caches results per guild within TTL", () => {
  let callCount = 0;
  const sampleRoles: RoleOption[] = [{ id: "r1", name: "Mod", position: 5, assignable: true }];

  const inner: BotView = {
    hasGuild: () => true,
    guild: () => null,
    memberCanManage: async () => true,
    memberHasPermission: async () => true,
    textChannels: () => [],
    hiddenChannelIds: () => new Set(),
    roles: (guildId) => {
      callCount++;
      return guildId === GUILD ? sampleRoles : [];
    },
    viewerRoleLimit: async () => ({ ownerId: null, topPosition: null }),
    userName: () => null,
  };

  const cached = cachedBotView(inner, 5_000);

  assert.deepEqual(cached.roles(GUILD), sampleRoles);
  assert.equal(callCount, 1);

  assert.deepEqual(cached.roles(GUILD), sampleRoles);
  assert.equal(callCount, 1);

  assert.deepEqual(cached.roles(GUILD_2), []);
  assert.equal(callCount, 2);
});

test("cachedBotView: memberCanManage caches per guildId + userId and isolates users/guilds", async () => {
  let callCount = 0;

  const inner: BotView = {
    hasGuild: () => true,
    guild: () => null,
    memberCanManage: async (guildId, userId) => {
      callCount++;
      // Only USER can manage GUILD
      return guildId === GUILD && userId === USER;
    },
    memberHasPermission: async () => true,
    textChannels: () => [],
    hiddenChannelIds: () => new Set(),
    roles: () => [],
    viewerRoleLimit: async () => ({ ownerId: null, topPosition: null }),
    userName: () => null,
  };

  const cached = cachedBotView(inner, 5_000);

  // First call for USER in GUILD -> true
  assert.equal(await cached.memberCanManage(GUILD, USER), true);
  assert.equal(callCount, 1);

  // Second call for same user/guild is cached
  assert.equal(await cached.memberCanManage(GUILD, USER), true);
  assert.equal(callCount, 1);

  // USER_2 in GUILD is checked separately (not cached from USER) -> false
  assert.equal(await cached.memberCanManage(GUILD, USER_2), false);
  assert.equal(callCount, 2);

  // Same USER in GUILD_2 is checked separately (cross-server isolation) -> false
  assert.equal(await cached.memberCanManage(GUILD_2, USER), false);
  assert.equal(callCount, 3);
});

test("cachedBotView: memberHasPermission caches per guildId + userId + permission", async () => {
  let callCount = 0;

  const inner: BotView = {
    hasGuild: () => true,
    guild: () => null,
    memberCanManage: async () => true,
    memberHasPermission: async (guildId, userId, permission) => {
      callCount++;
      return guildId === GUILD && userId === USER && permission === "BanMembers";
    },
    textChannels: () => [],
    hiddenChannelIds: () => new Set(),
    roles: () => [],
    viewerRoleLimit: async () => ({ ownerId: null, topPosition: null }),
    userName: () => null,
  };

  const cached = cachedBotView(inner, 5_000);

  assert.equal(await cached.memberHasPermission(GUILD, USER, "BanMembers"), true);
  assert.equal(callCount, 1);

  // Cached
  assert.equal(await cached.memberHasPermission(GUILD, USER, "BanMembers"), true);
  assert.equal(callCount, 1);

  // Different permission -> hits inner
  assert.equal(await cached.memberHasPermission(GUILD, USER, "ManageRoles"), false);
  assert.equal(callCount, 2);
});

test("cachedBotView: viewerRoleLimit caches per guildId + userId", async () => {
  let callCount = 0;
  const limit: ViewerRoleLimit = { ownerId: USER, topPosition: 10 };

  const inner: BotView = {
    hasGuild: () => true,
    guild: () => null,
    memberCanManage: async () => true,
    memberHasPermission: async () => true,
    textChannels: () => [],
    hiddenChannelIds: () => new Set(),
    roles: () => [],
    viewerRoleLimit: async (guildId, userId) => {
      callCount++;
      return guildId === GUILD && userId === USER ? limit : { ownerId: null, topPosition: null };
    },
    userName: () => null,
  };

  const cached = cachedBotView(inner, 5_000);

  assert.deepEqual(await cached.viewerRoleLimit(GUILD, USER), limit);
  assert.equal(callCount, 1);

  assert.deepEqual(await cached.viewerRoleLimit(GUILD, USER), limit);
  assert.equal(callCount, 1);
});

test("cachedBotView: passes through non-cached methods unchanged", () => {
  const inner: BotView = {
    hasGuild: (id) => id === GUILD,
    guild: (id) => (id === GUILD ? { id: GUILD, name: "Test Server", memberCount: 10 } : null),
    memberCanManage: async () => true,
    memberHasPermission: async () => true,
    textChannels: () => [],
    hiddenChannelIds: (id) => new Set([`hidden-${id}`]),
    roles: () => [],
    viewerRoleLimit: async () => ({ ownerId: null, topPosition: null }),
    userName: (id) => (id === USER ? "TestUser" : null),
    pingMs: () => 42,
    botMissingPermissions: () => ["ManageRoles"],
  };

  const cached = cachedBotView(inner, 5_000);

  assert.equal(cached.hasGuild(GUILD), true);
  assert.equal(cached.hasGuild(GUILD_2), false);
  assert.deepEqual(cached.guild(GUILD), { id: GUILD, name: "Test Server", memberCount: 10 });
  assert.deepEqual(cached.hiddenChannelIds(GUILD), new Set([`hidden-${GUILD}`]));
  assert.equal(cached.userName(USER), "TestUser");
  assert.equal(cached.pingMs?.(), 42);
  assert.deepEqual(cached.botMissingPermissions?.(GUILD), ["ManageRoles"]);
});

test("cachedBotView: viewerChannelIds caches when present and defaults to empty set when absent", async () => {
  // Absent on inner
  const innerWithout: BotView = {
    hasGuild: () => true,
    guild: () => null,
    memberCanManage: async () => true,
    memberHasPermission: async () => true,
    textChannels: () => [],
    hiddenChannelIds: () => new Set(),
    roles: () => [],
    viewerRoleLimit: async () => ({ ownerId: null, topPosition: null }),
    userName: () => null,
  };
  const cachedWithout = cachedBotView(innerWithout, 5_000);
  assert.deepEqual(await cachedWithout.viewerChannelIds?.(GUILD, USER), new Set());

  // Present on inner
  let channelFetchCount = 0;
  const innerWith: BotView = {
    ...innerWithout,
    viewerChannelIds: async (guildId, userId) => {
      channelFetchCount++;
      return new Set([`chan-${guildId}-${userId}`]);
    },
  };
  const cachedWith = cachedBotView(innerWith, 5_000);
  const result1 = await cachedWith.viewerChannelIds?.(GUILD, USER);
  assert.deepEqual(result1, new Set([`chan-${GUILD}-${USER}`]));
  assert.equal(channelFetchCount, 1);

  // Cached
  const result2 = await cachedWith.viewerChannelIds?.(GUILD, USER);
  assert.deepEqual(result2, new Set([`chan-${GUILD}-${USER}`]));
  assert.equal(channelFetchCount, 1);
});

test("cachedBotView: cache entries expire after TTL", async () => {
  let callCount = 0;
  const inner: BotView = {
    hasGuild: () => true,
    guild: () => null,
    memberCanManage: async () => {
      callCount++;
      return true;
    },
    memberHasPermission: async () => true,
    textChannels: () => [],
    hiddenChannelIds: () => new Set(),
    roles: () => [],
    viewerRoleLimit: async () => ({ ownerId: null, topPosition: null }),
    userName: () => null,
  };

  // TTL of 20ms
  const cached = cachedBotView(inner, 20);
  assert.equal(await cached.memberCanManage(GUILD, USER), true);
  assert.equal(callCount, 1);

  // Still cached immediately
  assert.equal(await cached.memberCanManage(GUILD, USER), true);
  assert.equal(callCount, 1);

  // Wait for TTL to expire
  await new Promise((resolve) => setTimeout(resolve, 35));

  // Should re-fetch
  assert.equal(await cached.memberCanManage(GUILD, USER), true);
  assert.equal(callCount, 2);
});

// --- Activity labels & rendering tests ---

test("auditLabel: translates all new and known actions to clear labels", () => {
  assert.equal(auditLabel("giveaway.cancel"), "Cancelled a giveaway");
  assert.equal(auditLabel("incident.start"), "Started Incident Mode");
  assert.equal(auditLabel("incident.end"), "Ended Incident Mode");
  assert.equal(auditLabel("incident.settings"), "Changed Incident Mode settings");
  assert.equal(auditLabel("trust.settings"), "Changed Trust Score settings");
  assert.equal(auditLabel("modmail.settings"), "Changed ModMail settings");
  assert.equal(auditLabel("digest.settings"), "Changed staff digest settings");
  assert.equal(auditLabel("modules.save"), "Saved module switches");
  assert.equal(auditLabel("settings.export"), "Exported server settings");
  assert.equal(auditLabel("settings.import"), "Imported server settings");
  assert.equal(auditLabel("member.action"), "Moderated a member");
  assert.equal(auditLabel("member.note.add"), "Added a staff note");
  // Existing actions still work
  assert.equal(auditLabel("case.revoke"), "Revoked a case");
  assert.equal(auditLabel("unknown.custom.action"), "unknown.custom.action");
});

test("renderActivity: renders audit entries with escaped text and correct labels", () => {
  const items: AuditEntry[] = [
    {
      id: "entry-1",
      guildId: GUILD,
      userId: USER,
      username: "testmod",
      action: "incident.start",
      target: null,
      summary: "Duration: 2h",
      createdAt: new Date("2026-11-07T12:00:00Z"),
    },
    {
      id: "entry-2",
      guildId: GUILD,
      userId: USER,
      username: "testmod",
      action: "member.note.add",
      target: "500000000000000001",
      summary: "Added note: Warning given",
      createdAt: new Date("2026-11-07T12:05:00Z"),
    },
  ];

  const html = renderActivity(site, ctx, 1, { items, total: 2 }, 10);
  assert.ok(html.includes("Started Incident Mode"), "renders incident.start label");
  assert.ok(html.includes("Added a staff note"), "renders member.note.add label");
  assert.ok(html.includes("Duration: 2h"), "renders summary");
  assert.ok(html.includes("500000000000000001"), "renders target ID");
});
