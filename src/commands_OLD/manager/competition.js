'use strict';

const { commaListsOr } = require('common-tags');
const { autocorrect } = require('../../functions/util');
const { skills, dungeonTypes } = require('../../constants/skyblock');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class CompetitionCommand extends Command {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [ 'comp' ],
			description: 'WIP',
			guildOnly: false,
			args: false,
			usage: '',
			cooldown: 1,
		});
	}

	/**
	 * possible types for a competition
	 */
	static COMPETITION_TYPES = [ ...skills, 'slayer', ...dungeonTypes ];

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 */
	async run(message, args) { // eslint-disable-line no-unused-vars
		const collector = message.channel.createMessageCollector({
			filter: msg => msg.author.id === message.author.id,
			idle: 30_000,
		});

		let type;
		let startingTime;
		let endingTime;
		let retries = 0;

		try {
			await message.reply({
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

					message.reply({
						content: `\`${collected.content}\` is not a valid type`,
						saveReplyMessageId: false,
					});
				}
			} while (!type);

			await message.reply('starting time?');

			do {
				const collected = await collector.next;
				if (collected.content === 'cancel') throw new Error('command cancelled');

				const result = new Date(collected.content);

				if (!Number.isNaN(result.getTime())) {
					startingTime = result;
					retries = 0;
				} else {
					if (++retries >= this.config.get('USER_INPUT_MAX_RETRIES')) throw new Error('the command has been cancelled');

					message.reply({
						content: `\`${collected.content}\` is not a valid date`,
						saveReplyMessageId: false,
					});
				}
			} while (!startingTime);

			await message.reply({
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

					message.reply({
						content: `\`${collected.content}\` is not a valid date`,
						saveReplyMessageId: false,
					});
				}
			} while (!endingTime);

			await message.reply({
				content: `type: ${type}, starting time: ${startingTime.toUTCString()}, ending time: ${endingTime.toUTCString()}`,
				saveReplyMessageId: false,
			});
		} catch (error) {
			logger.error(error);
			message.reply('the command has been cancelled');
		} finally {
			collector.stop();
		}

		logger.debug({ type, startingTime, endingTime });
	}
};
