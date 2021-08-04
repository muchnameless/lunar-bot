'use strict';

const BridgeCommand = require('../../../commands/BridgeCommand');
// const logger = require('../../../../functions/logger');


module.exports = class KickBridgeCommand extends BridgeCommand {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [],
			description: 'kick a player from the guild',
			args: 2,
			usage: '[`IGN`] [`reason`]',
			cooldown: 60,
			requiredRoles: () => [ this.config.get('MODERATOR_ROLE_ID'), this.config.get('DANKER_STAFF_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ],
		});
	}

	/**
	 * execute the command
	 * @param {import('../../HypixelMessage')} message
	 */
	async runInGame(message) {
		const targetInput = message.commandData.args.shift();
		const { content } = await this.client.commands.get('guild')?.runKick({
			target: this.client.players.getByIgn(targetInput) ?? targetInput,
			executor: message.player,
			reason: message.commandData.args.join(' '),
			hypixelGuild: message.hypixelGuild,
		});

		return message.author.send(content);
	}
};
