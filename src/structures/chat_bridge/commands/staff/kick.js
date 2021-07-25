'use strict';

const { kick } = require('../../constants/commandResponses');
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
		const IGN_INPUT = message.commandData.args.shift();
		const target = this.client.players.getByIgn(IGN_INPUT);

		if (!target) return message.author.send(`no player with the IGN \`${IGN_INPUT}\` found`);

		const executor = message.player;

		if (!executor) return message.author.send('unable to find a linked player for your account');
		if (!executor.isStaff) return message.author.send('you need to have an in game staff rank for this command');
		if (target.guildRankPriority >= executor.guildRankPriority) return message.author.send(`your guild rank needs to be higher than ${target}'s`);

		return message.author.send(await message.guild.chatBridge.minecraft.command({
			command: `g kick ${target} ${message.commandData.args.join(' ')}`,
			abortRegExp: kick(target.ign, message.guild.chatBridge.bot.ign),
		}));
	}
};
