import { Message } from "discord.js";
import { AutoResponderModel } from "../database/mongo";
import { logger } from "../utils/logger";
import { TtlCache } from "../utils/ttlCache";
import { getGuildConfig } from "./configuration";
import { DISCORD_LIMITS, truncate } from "../utils/safeText";

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

/** The fields the message path needs, with the trigger already lower-cased. */
interface ActiveResponder {
  trigger: string;
  response: string;
  matchType: AutoResponder["matchType"];
}

/** Enabled responders per guild, read on every message. Add/remove invalidate. */
const responderCache = new TtlCache<ActiveResponder[]>(30_000);

async function loadActiveResponders(guildId: string): Promise<ActiveResponder[]> {
  const docs = await AutoResponderModel.find({ guildId, enabled: true })
    .select("-_id trigger response matchType")
    .lean();
  return docs.map((d) => ({
    trigger: String(d.trigger).toLowerCase(),
    response: String(d.response),
    matchType: d.matchType as AutoResponder["matchType"],
  }));
}

export async function addAutoResponder(input: {
  guildId: string;
  trigger: string;
  response: string;
  matchType: "exact" | "contains" | "startsWith";
  createdBy: string;
}): Promise<AutoResponder | null> {
  try {
    responderCache.delete(input.guildId);
    const id = `ar-${crypto.randomUUID()}`;
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
    responderCache.delete(guildId);
    const res = await AutoResponderModel.deleteOne({ guildId, id });
    return res.deletedCount > 0;
  } catch {
    return false;
  }
}

/** Turns one responder on or off. False when it does not exist in this server. */
export async function setAutoResponderEnabled(guildId: string, id: string, enabled: boolean): Promise<boolean> {
  try {
    responderCache.delete(guildId);
    const res = await AutoResponderModel.updateOne({ guildId, id }, { $set: { enabled } });
    return res.matchedCount > 0;
  } catch {
    return false;
  }
}

/** Whether the server already has a responder with this trigger and match type (triggers are stored lower-cased). */
export async function autoResponderExists(guildId: string, trigger: string, matchType: AutoResponder["matchType"]): Promise<boolean> {
  try {
    return (await AutoResponderModel.countDocuments({ guildId, trigger: trigger.toLowerCase().trim(), matchType })) > 0;
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
    const guildId = message.guild.id;
    // The server-wide switch (dashboard Autoresponders page); cached with the guild config.
    if ((await getGuildConfig(guildId)).autorespondersEnabled === false) return false;
    const responders = await responderCache.getOrLoad(guildId, () => loadActiveResponders(guildId));
    if (responders.length === 0) return false;
    const content = message.content.toLowerCase();

    for (const ar of responders) {
      const trigger = ar.trigger;
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
          .replace(/{tag}/g, message.author.tag)
          .replace(/{user_id}/g, message.author.id)
          .replace(/{server}/g, message.guild.name)
          .replace(/{server_id}/g, message.guild.id)
          .replace(/{channel}/g, `<#${message.channelId}>`)
          .replace(/{channel_id}/g, message.channelId)
          .replace(/{member_count}/g, String(message.guild.memberCount));

        if ("send" in message.channel && typeof message.channel.send === "function") {
          await message.channel.send({
            content: truncate(formattedResponse, DISCORD_LIMITS.content),
            allowedMentions: { parse: ["users"] },
          }).catch(() => null);
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
