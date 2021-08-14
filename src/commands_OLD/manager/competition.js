import { commaListsOr } from 'common-tags';
import { autocorrect } from '../../functions/util.js';
import { skills, dungeonTypes } from '../../constants/skyblock.js';
import { SlashCommand } from '../../structures/commands/SlashCommand.js';
import { logger } from '../../functions/logger.js';


export class CompetitionCommand extends SlashCommand {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'WIP',
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
	async run(interaction) {
		const collector = interaction.channel.createMessageCollector({
			filter: msg => msg.author.id === interaction.user.id,
			idle: 30_000,
		});

		let type;
		let startingTime;
		let endingTime;
		let retries = 0;

		try {
			await interaction.reply({
				content: commaListsOr`competition type? ${CompetitionCommand.COMPETITION_TYPES}`,
				saveReplyMessageId: false,
			});

			do {
				const collected = await collector.next;
				if (collected.content === 'cancel') throw new Error('command cancelled');

				const result = autocorrect(collected.content, CompetitionCommand.COMPETITION_TYPES);

				if (result.similarity >= this.config.get('AUTOCORRECT_THRESHOLD')) {
					type = result.value;
					retries = 0;
				} else {
					if (++retries >= this.config.get('USER_INPUT_MAX_RETRIES')) throw new Error('the command has been cancelled');

					await interaction.reply({
						content: `\`${collected.content}\` is not a valid type`,
						saveReplyMessageId: false,
					});
				}
			} while (!type);

			await interaction.reply('starting time?');

			do {
				const collected = await collector.next;
				if (collected.content === 'cancel') throw new Error('command cancelled');

				const result = new Date(collected.content);

				if (!Number.isNaN(result.getTime())) {
					startingTime = result;
					retries = 0;
				} else {
					if (++retries >= this.config.get('USER_INPUT_MAX_RETRIES')) throw new Error('the command has been cancelled');

					await interaction.reply({
						content: `\`${collected.content}\` is not a valid date`,
						saveReplyMessageId: false,
					});
				}
			} while (!startingTime);

			await interaction.reply({
				content: 'ending time?',
				saveReplyMessageId: false,
			});

			do {
				const collected = await collector.next;
				if (collected.content === 'cancel') throw new Error('command cancelled');

				const result = new Date(collected.content);

				if (!Number.isNaN(result.getTime())) {
					endingTime = result;
					retries = 0;
				} else {
					if (++retries >= this.config.get('USER_INPUT_MAX_RETRIES')) throw new Error('the command has been cancelled');

					await interaction.reply({
						content: `\`${collected.content}\` is not a valid date`,
						saveReplyMessageId: false,
					});
				}
			} while (!endingTime);

			await interaction.reply({
				content: `type: ${type}, starting time: ${startingTime.toUTCString()}, ending time: ${endingTime.toUTCString()}`,
				saveReplyMessageId: false,
			});
		} catch (error) {
			logger.error(error);
			await interaction.reply('the command has been cancelled');
		} finally {
			collector.stop();
		}

		logger.debug({ type, startingTime, endingTime });
	}
}
