'use strict';

const { stripIndent } = require('common-tags');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class UnmuteCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'unmute a single guild member or guild chat both ingame and for the chat bridge',
			args: true,
			usage: '[`ign`|`discord id`|`@mention` for a single member] [`guild`|`everyone` for the guild chat]',
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
		const { players } = client;
		const [ TARGET_INPUT ] = args;

		let target;
		let guild;

		if ([ 'guild', 'everyone' ].includes(TARGET_INPUT.toLowerCase())) {
			target = 'everyone';
			guild = players.getByID(message.author.id)?.guild;

			if (!guild) return message.reply('unable to find your guild.');
		} else {
			target = (message.mentions.users.size
				? players.getByID(message.mentions.users.first().id)
				: players.getByIGN(TARGET_INPUT))
				?? players.getByID(TARGET_INPUT);

			if (!target) return message.reply(`no player ${message.mentions.users.size
				? `linked to \`${message.guild
					? message.mentions.members.first().displayName
					: message.mentions.users.first().username
				}\``
				: `with the IGN \`${TARGET_INPUT}\``
			} found.`);

			guild = target.guild;

			if (!guild) return message.reply(`unable to find the guild for \`${target.ign}\``);
		}

		const chatBridge = guild.chatBridge;

		if (target instanceof players.model) {
			target.chatBridgeMutedUntil = 0;
			await target.save();
		} else {
			guild.chatMutedUntil = 0;
			await guild.save();
		}

		try {
			const result = await Promise.all([
				chatBridge.awaitMessages(
					msg => /^(?:\[.+\] )?\w+ has muted (?:(?:\[.+\] )?\w+|the guild chat) for/.test(msg.content),
					{ max: 1, time: 5_000 },
				),
				chatBridge.sendToMinecraftChat(`/g unmute ${target}`),
			]);

			message.reply(stripIndent`
				unmuted \`${target}\`
				 > ${result[0][0]?.content ?? 'no ingame result'}
			`);
		} catch (error) {
			logger.error(error);
			message.reply(`an unknown error occurred while unmuting \`${target}\`.`);
		}
	}
};
