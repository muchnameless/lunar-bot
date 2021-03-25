'use strict';

const { MessageEmbed } = require('discord.js');
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

	if (newMessage.guild && newMessage.replyMessageID && !oldMessage.shouldReplyInSameChannel && newMessage.shouldReplyInSameChannel) {
		try {
			const oldReplyChannel = client.channels.cache.get(newMessage.replyChannelID);

			if (Array.isArray(newMessage.replyMessageID)) {
				const newReplies = [];

				await Promise.all(newMessage.replyMessageID.map(async (id) => {
					const oldReply = await oldReplyChannel.messages.fetch(id);
					newReplies.push(await newMessage.channel.send(oldReply.content, { embed: oldReply.embeds.length ? new MessageEmbed(oldReply.embeds[0]) : null }));
					oldReply.delete().catch(error => logger.error(`[MESSAGE UPDATE]: ${error.name}: ${error.message}`));
				}));

				newMessage.replyChannelID = newReplies[0].channel.id;
				newMessage.replyMessageID = newReplies.map(({ id }) => id);

				return; // moved reply message(s) to newMessage's channel -> don't call commandHandler
			}

			const oldReply = await client.channels.cache.get(newMessage.replyChannelID).messages.fetch(newMessage.replyMessageID);
			const newReply = await newMessage.channel.send(oldReply.content, { embed: oldReply.embeds.length ? new MessageEmbed(oldReply.embeds[0]) : null });

			oldReply.delete().catch(error => logger.error(`[MESSAGE UPDATE]: ${error.name}: ${error.message}`));
			newMessage.replyChannelID = newReply.channel.id;
			newMessage.replyMessageID = newReply.id;

			return; // moved reply message(s) to newMessage's channel -> don't call commandHandler
		} catch (error) {
			logger.error(`[MESSAGE UPDATE]: ${error.name}: ${error.message}`);
			newMessage.replyChannelID = null;
			newMessage.replyMessageID = null;
		}
	}

	commandHandler(newMessage);
};
