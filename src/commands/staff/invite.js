'use strict';

const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class InviteCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'invite someone into the guild',
			args: true,
			usage: '[`IGN`]',
			cooldown: 0,
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
		const playerInviting = client.players.getByID(message.author.id);

		if (!playerInviting) return message.reply('unable to find you in the player database, so the guild to invite to could not be determined.');

		const guild = playerInviting.guild;

		if (!guild) return message.reply('unable to find your guild.');

		const chatBridge = guild.chatBridge;

		if (!chatBridge) return message.reply(`no chat bridge for \`${guild.name}\` found.`);
		if (!chatBridge.ready) return message.reply(`the chat bridge for \`${guild.name}\` is currently not online.`);

		await chatBridge.chat(`/g invite ${args[0]}`);
		message.reply(`invited \`${args[0]}\` into \`${guild.name}\`.`);
	}
};
