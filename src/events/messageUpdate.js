'use strict';

const { MessageEmbed } = require('discord.js');
const { DM_KEY, REPLY_KEY } = require('../constants/redis');
const cache = require('../api/cache');
const commandHandler = require('../functions/commandHandler');
const logger = require('../functions/logger');


/**
 * messageUpdate
 * @param {import('../structures/LunarClient')} client
 * @param {import('../structures/extensions/Message')} oldMessage
 * @param {import('../structures/extensions/Message')} newMessage
 */
module.exports = async (client, oldMessage, newMessage) => {
	if (oldMessage.content === newMessage.content) return; // pin or added embed
	if (Date.now() - newMessage.createdTimestamp > 24 * 60 * 60 * 1_000) return; // ignore messages older than a day

	if (newMessage.guild && !oldMessage.shouldReplyInSameChannel && newMessage.shouldReplyInSameChannel) {
		const replyData = await newMessage.replyData;

		if (replyData) {
			try {
				const oldReplyChannel = client.channels.cache.get(replyData.channelID);

				if (Array.isArray(replyData.messageID)) {
					const newReplies = [];

					await Promise.all(replyData.messageID.map(async (id) => {
						const oldReply = await oldReplyChannel.messages.fetch(id);
						newReplies.push(await newMessage.channel.send(oldReply.content, { embed: oldReply.embeds.length ? new MessageEmbed(oldReply.embeds[0]) : null }));
						oldReply.delete().catch(error => logger.error(`[MESSAGE UPDATE]: ${error}`));
					}));

					newMessage.replyData = {
						channelID: newReplies[0].channel.id,
						messageID: newReplies.map(({ id }) => id),
					};

					return; // moved reply message(s) to newMessage's channel -> don't call commandHandler
				}

				const oldReply = await client.channels.cache.get(replyData.channelID).messages.fetch(replyData.messageID);
				const newReply = await newMessage.channel.send(oldReply.content, { embed: oldReply.embeds.length ? new MessageEmbed(oldReply.embeds[0]) : null });

				oldReply.delete().catch(error => logger.error(`[MESSAGE UPDATE]: ${error}`));

				newMessage.replyData = {
					channelID: newReply.channel.id,
					messageID: newReply.id,
				};

				client.chatBridges.handleDiscordMessage(newMessage, false);
				client.chatBridges.handleDiscordMessage(newReply, false);

				return; // moved reply message(s) to newMessage's channel -> don't call commandHandler
			} catch (error) {
				logger.error(`[MESSAGE UPDATE]: ${error}`);
				cache.delete(`${REPLY_KEY}:${newMessage.guild?.id ?? DM_KEY}:${newMessage.channel.id}:${newMessage.id}`);
			}
		}
	}

	commandHandler(newMessage);
};
