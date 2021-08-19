import { SlashCommandBuilder } from '@discordjs/builders';
import { commaListsOr } from 'common-tags';
import { autocorrect } from '../../functions/util.js';
import { skills, dungeonTypes } from '../../constants/skyblock.js';
import { InteractionUtil } from '../../util/InteractionUtil.js';
import { SlashCommand } from '../../structures/commands/SlashCommand.js';
import { logger } from '../../functions/logger.js';


export class CompetitionCommand extends SlashCommand {
	constructor(context) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('WIP'),
			cooldown: 1,
		});
	}

	/**
	 * possible types for a competition
	 */
	static COMPETITION_TYPES = [ ...skills, 'slayer', ...dungeonTypes ];

	/**
	 * execute the command
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async runSlash(interaction) {
		const collector = interaction.channel.createMessageCollector({
			filter: msg => msg.author.id === interaction.user.id,
			idle: 30_000,
		});

		let type;
		let startingTime;
		let endingTime;
		let retries = 0;

		try {
			await InteractionUtil.reply(interaction, commaListsOr`competition type? ${CompetitionCommand.COMPETITION_TYPES}`);

			do {
				const collected = await collector.next;
				if (collected.content === 'cancel') throw new Error('command cancelled');

				const result = autocorrect(collected.content, CompetitionCommand.COMPETITION_TYPES);

				if (result.similarity >= this.config.get('AUTOCORRECT_THRESHOLD')) {
					type = result.value;
					retries = 0;
				} else {
					if (++retries >= this.config.get('USER_INPUT_MAX_RETRIES')) throw new Error('the command has been cancelled');

					await InteractionUtil.reply(interaction, `\`${collected.content}\` is not a valid type`);
				}
			} while (!type);

			await InteractionUtil.reply(interaction, 'starting time?');

			do {
				const collected = await collector.next;
				if (collected.content === 'cancel') throw new Error('command cancelled');

				const result = new Date(collected.content);

				if (!Number.isNaN(result.getTime())) {
					startingTime = result;
					retries = 0;
				} else {
					if (++retries >= this.config.get('USER_INPUT_MAX_RETRIES')) throw new Error('the command has been cancelled');

					await InteractionUtil.reply(interaction, `\`${collected.content}\` is not a valid date`);
				}
			} while (!startingTime);

			await InteractionUtil.reply(interaction, 'ending time?');

			do {
				const collected = await collector.next;
				if (collected.content === 'cancel') throw new Error('command cancelled');

				const result = new Date(collected.content);

				if (!Number.isNaN(result.getTime())) {
					endingTime = result;
					retries = 0;
				} else {
					if (++retries >= this.config.get('USER_INPUT_MAX_RETRIES')) throw new Error('the command has been cancelled');

					await InteractionUtil.reply(interaction, `\`${collected.content}\` is not a valid date`);
				}
			} while (!endingTime);

			await InteractionUtil.reply(interaction, `type: ${type}, starting time: ${startingTime.toUTCString()}, ending time: ${endingTime.toUTCString()}`);
		} catch (error) {
			logger.error(error);
			await InteractionUtil.reply(interaction, 'the command has been cancelled');
		} finally {
			collector.stop();
		}

		logger.debug({ type, startingTime, endingTime });
	}
}
