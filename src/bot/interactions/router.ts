/**
 * A small customId router for buttons, select menus and modal submits.
 *
 * Each route matches a customId either by prefix (a string) or by regular
 * expression. The first matching route wins, so more specific routes go first
 * when two could match. customId formats are part of the bot's public surface:
 * buttons on messages posted months ago still carry the old IDs, so a route's
 * pattern must keep matching everything it matched before.
 */
import {
  MessageFlags,
  type AnySelectMenuInteraction,
  type ButtonInteraction,
  type ModalSubmitInteraction,
} from "discord.js";
import { logger } from "../../utils/logger";

export type ComponentInteraction =
  | ButtonInteraction
  | ModalSubmitInteraction
  | AnySelectMenuInteraction;

export interface ComponentRoute {
  /** Short name used in logs and tests, e.g. "poll". */
  name: string;
  /** A string matches as a customId prefix; a RegExp is tested against the whole customId. */
  match: string | RegExp;
  /** `match` is the RegExp result for RegExp routes and null for prefix routes. */
  handle(interaction: ComponentInteraction, match: RegExpMatchArray | null): Promise<void>;
}

export interface RouteHit {
  route: ComponentRoute;
  match: RegExpMatchArray | null;
}

/** The interaction surface the router itself touches (handlers get the full object). */
export interface RoutableInteraction {
  customId: string;
  replied: boolean;
  deferred: boolean;
  reply(options: { content: string; flags: MessageFlags.Ephemeral }): Promise<unknown>;
  editReply(options: { content: string }): Promise<unknown>;
}

const FAILURE_MESSAGE = "❌ An error occurred while processing this action. Please try again.";

export class InteractionRouter {
  private readonly routes: readonly ComponentRoute[];

  constructor(routes: readonly ComponentRoute[]) {
    this.routes = [...routes];
  }

  /** The route that would handle this customId, or null. */
  find(customId: string): RouteHit | null {
    for (const route of this.routes) {
      if (typeof route.match === "string") {
        if (customId.startsWith(route.match)) return { route, match: null };
        continue;
      }
      const match = customId.match(route.match);
      if (match) return { route, match };
    }
    return null;
  }

  /**
   * Run the matching handler. Returns false when no route matched (component
   * collectors inside commands handle their own IDs), true otherwise. A handler
   * that throws gets a generic ephemeral error so the user is never left with
   * "This interaction failed".
   */
  async dispatch(interaction: RoutableInteraction): Promise<boolean> {
    const customId = interaction.customId;
    if (!customId) return false;
    const hit = this.find(customId);
    if (!hit) return false;

    try {
      // Handlers get the full discord.js interaction; tests pass a stand-in.
      await hit.route.handle(interaction as unknown as ComponentInteraction, hit.match);
    } catch (err) {
      logger.error(`Component handler "${hit.route.name}" failed for customId "${customId}":`, err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: FAILURE_MESSAGE, flags: MessageFlags.Ephemeral }).catch(() => null);
      } else if (interaction.deferred && !interaction.replied) {
        await interaction.editReply({ content: FAILURE_MESSAGE }).catch(() => null);
      }
    }
    return true;
  }
}
