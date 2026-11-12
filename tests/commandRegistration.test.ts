/**
 * Registration payload: guild-only commands must be offered in servers only,
 * so Discord hides them from the DM slash menu, while commands that work in
 * DMs (like /help) keep their own contexts.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { ApplicationCommandType, InteractionContextType } from "discord.js";
import { commands, loadCommands } from "../src/commands/loader";
import { commandRegistrationData } from "../src/commands/registration";
import { contextMenus, reportLogEmbed, reportReply } from "../src/commands/contextMenus";

before(async () => { await loadCommands(); });

test("guild-only commands are registered for servers only", () => {
  const data = commandRegistrationData();
  assert.equal(data.length, commands.size + contextMenus.size, "slash commands plus context menus");
  assert.equal(new Set(data.map(d => d.name)).size, data.length, "no duplicate names");

  const byName = new Map(data.map(d => [d.name, d]));
  for (const [name, cmd] of commands) {
    const payload = byName.get(name);
    assert.ok(payload, `/${name} is registered`);
    if (cmd.guildOnly) {
      assert.deepEqual(payload.contexts, [InteractionContextType.Guild], `/${name} is hidden in DMs`);
    }
  }
});

test("DM-capable commands keep their contexts", () => {
  const byName = new Map(commandRegistrationData().map(d => [d.name, d]));
  assert.deepEqual(byName.get("help")?.contexts, [InteractionContextType.Guild, InteractionContextType.BotDM]);
  assert.deepEqual(byName.get("daily")?.contexts, [InteractionContextType.Guild]);
  assert.equal(byName.get("about")?.contexts, undefined, "a command that works anywhere is left untagged");
});

test("context menus: User Info, Avatar and Report Message are registered for servers only", () => {
  const menus = commandRegistrationData().filter(d => d.type === ApplicationCommandType.User || d.type === ApplicationCommandType.Message);
  assert.deepEqual(menus.map(m => m.name).sort(), ["Avatar", "Report Message", "User Info"]);
  for (const m of menus) assert.deepEqual(m.contexts, [InteractionContextType.Guild], `${m.name} is hidden in DMs`);
  assert.equal(menus.find(m => m.name === "Report Message")?.type, ApplicationCommandType.Message);
  for (const menu of contextMenus.values()) assert.ok(menu.description.length > 0 && menu.description.length < 200);
});

test("Report Message: log entry names author, reporter and channel; reporter replies cover every outcome", () => {
  const embed = reportLogEmbed(
    { id: "9", content: "x".repeat(3000), url: "https://discord.com/channels/1/2/9", channelId: "2", createdTimestamp: 1_700_000_000_000,
      author: { id: "5", tag: "spammer" }, attachments: { size: 2 } },
    { id: "6", tag: "helper" },
  );
  assert.ok(embed.description!.length < 1100, "long content is truncated");
  assert.match(embed.description!, /Jump to message/);
  const fields = Object.fromEntries(embed.fields!.map(f => [f.name, f.value]));
  assert.match(fields.Author, /<@5>/);
  assert.match(fields["Reported by"], /<@6>/);
  assert.equal(fields.Channel, "<#2>");
  assert.equal(fields.Attachments, "2");
  assert.match(reportReply("sent"), /reported/);
  assert.match(reportReply("no-log"), /no log channel/);
  assert.match(reportReply("own"), /your own/);
});
