import { SlashCommandBuilder } from 'discord.js';
import { Op } from 'sequelize';
import { InteractionUtil } from '#utils';
import { optionalPlayerOption } from '#structures/commands/commonOptions';
import { ApplicationCommand } from '#structures/commands/ApplicationCommand';
import { Offset } from '#constants';
import { seconds } from '#functions';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandContext } from '#structures/commands/BaseCommand';

export default class XpResetCommand extends ApplicationCommand {
	constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder()
				.setDescription('reset the competition xp gained')
				.addStringOption(optionalPlayerOption),
			cooldown: seconds(5),
		});
	}

	static OFFSET_TO_RESET = Offset.CompetitionStart;

	/**
	 * execute the command
	 * @param interaction
	 */
	override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		const { players } = this.client;
		const PLAYER_INPUT = interaction.options.getString('player');

		let result: string;

		// individual player
		if (PLAYER_INPUT) {
			const player =
				InteractionUtil.getPlayer(interaction) ??
				(await players.fetch({
					guildId: null,
					ign: { [Op.iLike]: PLAYER_INPUT },
					cache: false,
				}));

			if (!player) return InteractionUtil.reply(interaction, `\`${PLAYER_INPUT}\` is not in the player db`);

			await InteractionUtil.awaitConfirmation(interaction, `reset xp gained from \`${player}\`?`);

			await player.resetXp({ offsetToReset: XpResetCommand.OFFSET_TO_RESET });

			result = `reset xp gained from \`${player}\``;

			// all players
		} else {
			const PLAYER_COUNT = players.cache.size;

			await InteractionUtil.awaitConfirmation(
				interaction,
				`reset competition xp gained from ${PLAYER_COUNT} guild members?`,
			);

			// delete players who left the guild
			await players.sweepDb();

			// reset xp
			await players.resetXp({ offsetToReset: XpResetCommand.OFFSET_TO_RESET });

			result = `reset the competition xp gained from ${PLAYER_COUNT} guild members`;
		}

		// logging
		void this.client.log(
			this.client.defaultEmbed
				.setTitle('XP Tracking')
				.setDescription(`${interaction.user.tag} | ${interaction.user} ${result}`),
		);

		return InteractionUtil.reply(interaction, result);
	}
}
