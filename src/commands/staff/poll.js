'use strict';

const createPoll = require('../../functions/createPoll');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class PollCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'polls' ],
			description: 'create a poll for both ingame and discord guild chat',
			args: false,
			usage: '<\'time\'> ["option1" "option2" ...]',
			cooldown: 30,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/LunarClient')} client
	 * @param {import('../../structures/database/ConfigHandler')} config
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(client, config, message, args, flags, rawArgs) {
		const chatBridge = message.author.hypixelGuild?.chatBridge;

		if (!chatBridge) return message.reply(`unable to find a chat bridge for ${message.author.player?.guildName ?? 'unknown player'}`);

		createPoll(chatBridge, message, args, message.author.player.ign);
	}
};
