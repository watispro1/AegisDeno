/**
 * Registration payload: guild-only commands must be offered in servers only,
 * so Discord hides them from the DM slash menu, while commands that work in
 * DMs (like /help) keep their own contexts.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { InteractionContextType } from "discord.js";
import { commands, loadCommands } from "../src/commands/loader";
import { commandRegistrationData } from "../src/commands/registration";

before(async () => { await loadCommands(); });

test("guild-only commands are registered for servers only", () => {
  const data = commandRegistrationData();
  assert.equal(data.length, commands.size);
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
