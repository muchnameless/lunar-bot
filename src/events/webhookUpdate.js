'use strict';

const logger = require('../functions/logger');


/**
 * webhookUpdate
 * @param {import('../structures/LunarClient')} client
 * @param {import('../structures/extensions/TextChannel')} channel
 */
module.exports = async (client, channel) => {
	if (channel.id !== client.webhook?.channelID) return;
	if (!channel.checkBotPermissions('MANAGE_WEBHOOKS')) return logger.warn(`[WEBHOOK UPDATE]: missing 'MANAGE_WEBHOOKS' in #${channel.name}`);

	const webhooks = await channel.fetchWebhooks().catch(logger.error);

	if (!webhooks || webhooks.has(client.webhook.id)) return;

	client.webhook = null;
	client.config.set('WEBHOOK_DELETED', 'true');

	logger.warn('[WEBHOOK UPDATE]: logging webhook has been deleted');
};
