'use strict';

const { MessageEmbed } = require('discord.js');
const { DM_KEY, REPLY_KEY } = require('../constants/redis');
const { replyPingRegExp } = require('../constants/bot');
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
						oldReply.delete().catch(error => logger.error('[MESSAGE UPDATE]', error));
					}));

					newMessage.replyData = {
						channelID: newReplies[0].channel.id,
						messageID: newReplies.map(({ id }) => id),
					};

					return; // moved reply message(s) to newMessage's channel -> don't call commandHandler
				}

				/** @type {import('../structures/extensions/Message')} */
				const oldReply = await client.channels.cache.get(replyData.channelID).messages.fetch(replyData.messageID);
				const pingMatched = oldReply.content.match(replyPingRegExp);
				/** @type {import('../structures/extensions/Message')} */
				const newReply = await newMessage.channel.send(
					pingMatched
						? oldReply.content.slice(pingMatched[0].length)
						: oldReply.content,
					{
						reply: pingMatched
							? {
								messageReference: newMessage,
								failIfNotExists: false,
							}
							: null,
						embed: oldReply.embeds.length
							? oldReply.embeds[0]
							: null,
					},
				);

				newReply.react(...oldReply.reactions.cache.filter(({ me }) => me).map(({ emoji }) => emoji.identifier));
				oldReply.delete().catch(error => logger.error('[MESSAGE UPDATE]', error));

				newMessage.replyData = {
					channelID: newReply.channel.id,
					messageID: newReply.id,
				};

				if (newReply.content.length) {
					client.chatBridges.handleDiscordMessage(newMessage, { checkifNotFromBot: false });
					client.chatBridges.handleDiscordMessage(newReply, { checkifNotFromBot: false });
				}

				return; // moved reply message(s) to newMessage's channel -> don't call commandHandler
			} catch (error) {
				logger.error('[MESSAGE UPDATE]', error);
				cache.delete(`${REPLY_KEY}:${newMessage.guild?.id ?? DM_KEY}:${newMessage.channel.id}:${newMessage.id}`);
			}
		}
	}

	if (newMessage.me) client.chatBridges.handleDiscordMessage(newMessage, { checkifNotFromBot: false });

	commandHandler(newMessage);
};
