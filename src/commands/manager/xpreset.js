import { SlashCommandBuilder } from '@discordjs/builders';
import pkg from 'sequelize';
const { Op } = pkg;
import { OFFSET_FLAGS } from '../../constants/index.js';
import { optionalPlayerOption } from '../../structures/commands/commonOptions.js';
import { InteractionUtil } from '../../util/index.js';
import { safePromiseAll } from '../../functions/index.js';
import { SlashCommand } from '../../structures/commands/SlashCommand.js';


export default class XpResetCommand extends SlashCommand {
	constructor(context) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('reset the competition xp gained')
				.addStringOption(optionalPlayerOption),
			cooldown: 5,
		});
	}

	static OFFSET_TO_RESET = OFFSET_FLAGS.COMPETITION_START;

	/**
	 * execute the command
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async runSlash(interaction) {
		const { players } = this.client;
		const PLAYER_INPUT = interaction.options.getString('player');

		let result;

		// individual player
		if (PLAYER_INPUT) {
			/** @type {import('../../structures/database/models/Player').Player} */
			const player = InteractionUtil.getPlayer(interaction)
				?? await players.fetch({
					guildId: null,
					ign: { [Op.iLike]: PLAYER_INPUT },
					cache: false,
				});


			if (!player) return await InteractionUtil.reply(interaction, `\`${PLAYER_INPUT}\` is not in the player db`);

			await InteractionUtil.awaitConfirmation(interaction, `reset xp gained from \`${player}\`?`);

			await player.resetXp({ offsetToReset: XpResetCommand.OFFSET_TO_RESET });

			result = `reset xp gained from \`${player}\``;

		// all players
		} else {
			const PLAYER_COUNT = players.size;

			await InteractionUtil.awaitConfirmation(interaction, `reset competition xp gained from all ${PLAYER_COUNT} guild members?`);

			// delete players who left the guild
			await players.sweepDb();

			await safePromiseAll([
				...players.cache.map(async (player) => {
					if (player.notes === 'skill api disabled') player.notes = null;
					return player.resetXp({ offsetToReset: XpResetCommand.OFFSET_TO_RESET });
				}),
				this.config.set('COMPETITION_START_TIME', Date.now()),
			]);

			result = `reset the competition xp gained from all ${PLAYER_COUNT} guild members`;
		}

		// logging
		this.client.log(this.client.defaultEmbed
			.setTitle('XP Tracking')
			.setDescription(`${interaction.user.tag} | ${interaction.user} ${result}`),
		);

		return await InteractionUtil.reply(interaction, result);
	}
}
