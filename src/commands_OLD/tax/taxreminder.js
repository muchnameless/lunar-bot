'use strict';

const { Permissions } = require('discord.js');
const { escapeIgn } = require('../../functions/util');
const { validateNumber } = require('../../functions/stringValidators');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class TaxReminderCommand extends Command {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [],
			description: 'ping all who have not paid',
			guildOnly: true,
			args: false,
			usage: () => `<\`-g\`|\`--ghostping\` to ghost ping> <\`IGNs\`|\`IDs\` to exclude from the ping> <${this.client.hypixelGuilds.guildNames}>`,
			cooldown: 60,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 */
	async run(message, args) { // eslint-disable-line no-unused-vars
		try {
			const SHOULD_GHOST_PING = flags.some(arg => [ 'g', 'ghostping' ].includes(arg));
			const hypixelGuild = this.client.hypixelGuilds.getFromArray(args);
			const playersToRemind = (hypixelGuild ? hypixelGuild.players : this.client.players.inGuild)
				.filter(({ paid, discordID, ign }) => !paid && !args.includes(discordID) && !args.some(arg => arg.toLowerCase() === ign.toLowerCase()));
			const [ playersPingable, playersOnlyIgn ] = playersToRemind.partition(({ inDiscord, discordID }) => inDiscord && validateNumber(discordID));
			const AMOUNT_TO_PING = playersPingable.size;

			if (!this.force(flags)) {
				const ANSWER = await message.awaitReply(
					`${SHOULD_GHOST_PING ? 'ghost' : ''}ping \`${AMOUNT_TO_PING}\` member${AMOUNT_TO_PING !== 1 ? 's' : ''} from ${hypixelGuild?.name ?? 'all guilds'}?`,
					60,
					{ sameChannel: true },
				);

				if (!this.config.getArray('REPLY_CONFIRMATION').includes(ANSWER?.toLowerCase())) return message.reply({
					content: 'the command has been cancelled.',
					sameChannel: true,
				});
			}

			message.channel.startTyping();

			let pingMessage = '';

			for (const player of playersPingable) pingMessage += ` <@${player.discordID}>`;
			for (const player of playersOnlyIgn) pingMessage += ` ${escapeIgn(player.ign)}`;

			// send ping message and split between pings if too many chars
			await message.reply({
				content: pingMessage,
				sameChannel: true,
				split: { char: ' ' },
			});

			// optional ghost ping (delete ping message(s))
			if (!SHOULD_GHOST_PING) return message.channel.stopTyping(true);

			const fetched = await message.channel.messages.fetch({ after: message.id }).catch(error => logger.error('[TAX REMINDER]: ghost ping', error));

			if (!fetched) return;
			if (message.channel.botPermissions.has(Permissions.FLAGS.MANAGE_MESSAGES)) {
				return message.channel.bulkDelete([ message.id, ...fetched.filter(({ author: { id } }) => [ this.client.user.id, message.author.id ].includes(id)).keys() ]).catch(logger.error);
			}

			for (const msg of fetched.values()) {
				if (msg.me) msg.delete().catch(logger.error);
			}
		} finally {
			message.channel.stopTyping(true);
		}
	}
};
