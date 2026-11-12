/**
 * Payload sent to Discord's command-registration endpoints.
 *
 * Commands marked `guildOnly` are tagged with the Guild context so Discord
 * hides them in the DM slash menu; commands that work in DMs keep whatever
 * contexts they set themselves. Doing it here, rather than on every builder,
 * keeps the bot's startup registration, `npm run deploy` and `/sync` identical.
 * Right-click (Apps) context menus are appended after the slash commands.
 */
import {
  InteractionContextType,
  type RESTPostAPIApplicationCommandsJSONBody,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";
import { commands } from "./loader";
import { contextMenuRegistrationData } from "./contextMenus";

export function commandRegistrationData(): RESTPostAPIApplicationCommandsJSONBody[] {
  return [...slashCommandRegistrationData(), ...contextMenuRegistrationData()];
}

export function slashCommandRegistrationData(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
  return Array.from(commands.values(), (command) => {
    // The CommandData union also covers subcommand builders, which are never
    // registered on their own; every loaded command is a top-level chat input.
    const data = command.data.toJSON() as RESTPostAPIChatInputApplicationCommandsJSONBody;
    if (command.guildOnly) {
      if (!data.contexts) {
        data.contexts = [InteractionContextType.Guild];
      }
      data.dm_permission = false;
    }
    return data;
  });
}
