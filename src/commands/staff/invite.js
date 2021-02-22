'use strict';

const { stripIndent } = require('common-tags');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class InviteCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'invite someone into the guild',
			args: true,
			usage: () => `[\`IGN\`] <${this.client.hypixelGuilds.guildNameFlags}>`,
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

		/**
		 * @type {import('../../structures/database/models/HypixelGuild')}
		 */
		const guild = client.hypixelGuilds.getFromArray(flags) ?? playerInviting.guild;

		if (!guild) return message.reply('unable to find your guild.');

		const chatBridge = guild.chatBridge;
		const [ ign ] = args;

		try {
			const result = await Promise.all([
				Promise.race([
					chatBridge.awaitMessages(
						msg => /^You invited (?:\[.+?\] )?\w+ to your guild\. They have 5 minutes to accept\.$|^You sent an offline invite to (?:\[.+?\] )?\w+! They will have 5 minutes to accept once they come online!$/.test(msg.content),
						{ max: 1, time: 5_000 },
					),
					chatBridge.awaitMessages(
						msg => /^You've already invited (?:\[.+?\] )?\w+ to your guild! Wait for them to accept!$|^(?:\[.+?\] )?\w+ is already in another guild!$/.test(msg.content),
						{ max: 1, time: 5_000 },
					),
				]),
				chatBridge.queueForMinecraftChat(`/g invite ${ign}`),
			]);

			message.reply(stripIndent`
				invited \`${ign}\` into \`${guild.name}\`
				 > ${result[0][0]?.content ?? 'no ingame result'}
			`);
		} catch (error) {
			logger.error(error);
			message.reply(`an unknown error occurred while inviting \`${ign}\` into \`${guild.name}\`.`);
		}
	}
};
