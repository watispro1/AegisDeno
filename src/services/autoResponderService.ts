import { Message } from "discord.js";
import { AutoResponderModel } from "../database/mongo";
import { logger } from "../utils/logger";

export interface AutoResponder {
  id: string;
  guildId: string;
  trigger: string;
  response: string;
  matchType: "exact" | "contains" | "startsWith";
  enabled: boolean;
  createdBy: string;
  createdAt: Date;
}

export async function addAutoResponder(input: {
  guildId: string;
  trigger: string;
  response: string;
  matchType: "exact" | "contains" | "startsWith";
  createdBy: string;
}): Promise<AutoResponder | null> {
  try {
    const id = `ar-${Math.random().toString(36).substring(2, 8)}`;
    const doc = await AutoResponderModel.create({
      id,
      guildId: input.guildId,
      trigger: input.trigger.toLowerCase().trim(),
      response: input.response,
      matchType: input.matchType,
      createdBy: input.createdBy,
    });
    return doc.toObject() as AutoResponder;
  } catch (err) {
    logger.error("Failed to add autoresponder:", err);
    return null;
  }
}

export async function removeAutoResponder(guildId: string, id: string): Promise<boolean> {
  try {
    const res = await AutoResponderModel.deleteOne({ guildId, id });
    return res.deletedCount > 0;
  } catch {
    return false;
  }
}

export async function getAutoResponders(guildId: string): Promise<AutoResponder[]> {
  try {
    const docs = await AutoResponderModel.find({ guildId }).sort({ createdAt: -1 });
    return docs.map(d => d.toObject() as AutoResponder);
  } catch {
    return [];
  }
}

export async function processAutoResponders(message: Message): Promise<boolean> {
  if (!message.guild || message.author.bot || !message.content) return false;

  try {
    const content = message.content.toLowerCase();
    const responders = await AutoResponderModel.find({ guildId: message.guild.id, enabled: true });

    for (const ar of responders) {
      const trigger = ar.trigger.toLowerCase();
      let matched = false;

      if (ar.matchType === "exact" && content === trigger) {
        matched = true;
      } else if (ar.matchType === "startsWith" && content.startsWith(trigger)) {
        matched = true;
      } else if (ar.matchType === "contains" && content.includes(trigger)) {
        matched = true;
      }

      if (matched) {
        const formattedResponse = ar.response
          .replace(/{user}/g, `<@${message.author.id}>`)
          .replace(/{username}/g, message.author.username)
          .replace(/{server}/g, message.guild.name)
          .replace(/{channel}/g, `<#${message.channelId}>`)
          .replace(/{member_count}/g, String(message.guild.memberCount));

        if ("send" in message.channel && typeof message.channel.send === "function") {
          await message.channel.send(formattedResponse).catch(() => null);
        }
        return true;
      }
    }

    return false;
  } catch (err) {
    logger.error("Error processing autoresponder:", err);
    return false;
  }
}
