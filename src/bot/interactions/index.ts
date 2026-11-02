import { InteractionRouter, type ComponentRoute } from "./router";
import { communityRoutes } from "./community";
import { ticketRoutes } from "./tickets";
import { roleRoutes } from "./roles";
import { verificationRoutes } from "./verification";
import { reminderRoutes } from "./reminders";
import { modmailRoutes } from "./modmail";

/** Every persistent component route, in match order. */
export const componentRoutes: readonly ComponentRoute[] = [
  ...communityRoutes,
  ...ticketRoutes,
  ...roleRoutes,
  ...verificationRoutes,
  ...reminderRoutes,
  ...modmailRoutes,
];

export const componentRouter = new InteractionRouter(componentRoutes);

export { InteractionRouter } from "./router";
export type { ComponentInteraction, ComponentRoute } from "./router";
