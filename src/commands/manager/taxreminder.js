'use strict';

const { escapeIgn } = require('../../functions/util');
const { validateNumber } = require('../../functions/stringValidators');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class TaxReminderCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'reminder' ],
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
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(message, args, flags, rawArgs) { // eslint-disable-line no-unused-vars
		try {
			const SHOULD_GHOST_PING = flags.some(arg => [ 'g', 'ghostping' ].includes(arg));
			const hypixelGuild = this.client.hypixelGuilds.getFromArray(args);
			const playersToRemind = (hypixelGuild ? hypixelGuild.players : this.client.players.inGuild).filter(({ paid, discordID, ign }) => !paid && !args.includes(discordID) && !args.some(arg => arg.toLowerCase() === ign.toLowerCase()));
			const [ playersPingable, playersOnlyIgn ] = playersToRemind.partition(({ inDiscord, discordID }) => inDiscord && validateNumber(discordID));
			const AMOUNT_TO_PING = playersPingable.size;

			if (!this.force(flags)) {
				const ANSWER = await message.awaitReply(
					`${SHOULD_GHOST_PING ? 'ghost' : ''}ping \`${AMOUNT_TO_PING}\` member${AMOUNT_TO_PING !== 1 ? 's' : ''} from ${hypixelGuild?.name ?? 'all guilds'}?`,
					60,
					{ sameChannel: true },
				);

				if (!this.client.config.getArray('REPLY_CONFIRMATION').includes(ANSWER?.toLowerCase())) return message.reply(
					'the command has been cancelled.',
					{ sameChannel: true },
				);
			}

			message.channel.startTyping();

			let pingMessage = '';

			playersPingable.forEach(player => pingMessage += ` <@${player.discordID}>`);
			playersOnlyIgn.forEach(player => pingMessage += ` ${escapeIgn(player.ign)}`);

			// send ping message and split between pings if too many chars
			await message.reply(pingMessage, { reply: false, sameChannel: true, split: { char: ' ' } });

			// optional ghost ping (delete ping message(s))
			if (!SHOULD_GHOST_PING) return message.channel.stopTyping(true);

			const fetched = await message.channel.messages.fetch({ after: message.id }).catch(error => logger.error(`[TAX REMINDER]: ghost ping: ${error.name}: ${error.message}`));

			if (!fetched) return;
			if (!message.channel.checkBotPermissions('MANAGE_MESSAGES')) return fetched.filter(({ author: { id } }) => id === this.client.user.id).forEach(msg => msg.delete().catch(logger.error));

			message.channel.bulkDelete([ message.id, ...fetched.filter(({ author: { id } }) => [ this.client.user.id, message.author.id ].includes(id)).keys() ]).catch(logger.error);
		} finally {
			message.channel.stopTyping(true);
		}
	}
};
