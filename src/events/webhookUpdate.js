'use strict';

const { Permissions } = require('discord.js');
const logger = require('../functions/logger');


/**
 * webhookUpdate
 * @param {import('../structures/LunarClient')} client
 * @param {import('../structures/extensions/TextChannel')} channel
 */
module.exports = async (client, channel) => {
	if (channel.id !== client.webhook?.channelID) return;
	if (!channel.checkBotPermissions(Permissions.FLAGS.MANAGE_WEBHOOKS)) return logger.error(`[WEBHOOK UPDATE]: missing 'MANAGE_WEBHOOKS' in #${channel.name}`);

	const webhooks = await channel.fetchWebhooks().catch(logger.error);

	if (!webhooks || webhooks.has(client.webhook.id)) return;

	client.webhook = null;
	client.config.set('WEBHOOK_DELETED', 'true');

	logger.warn('[WEBHOOK UPDATE]: logging webhook has been deleted');
};
