import { Client, Collection } from "discord.js";
import { Command } from "../types/discord";

// Extend the Discord.js Client to hold our command collection
declare module "discord.js" {
  interface Client {
    commands: Collection<string, Command>;
  }
}
