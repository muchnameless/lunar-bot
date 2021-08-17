import { BridgeCommand } from '../../../commands/BridgeCommand.js';
// import { logger } from '../../../../functions/logger.js';


export default class KickBridgeCommand extends BridgeCommand {
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
	 * @param {import('../../HypixelMessage').HypixelMessage} hypixelMessage
	 */
	async runInGame(hypixelMessage) {
		const targetInput = hypixelMessage.commandData.args.shift();
		const { content } = await this.client.commands.get('guild')?.runKick({
			target: this.client.players.getByIgn(targetInput) ?? targetInput,
			executor: hypixelMessage.player,
			reason: hypixelMessage.commandData.args.join(' '),
			hypixelGuild: hypixelMessage.hypixelGuild,
		});

		return hypixelMessage.author.send(content);
	}
}
