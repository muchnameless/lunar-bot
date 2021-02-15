'use strict';

const { commaListsOr } = require('common-tags');
const { autocorrect } = require('../../functions/util');
const { SKILLS, DUNGEON_TYPES } = require('../../constants/skyblock');
const Command = require('../../structures/Command');
const logger = require('../../functions/logger');

const COMPETITION_TYPES = [ ...SKILLS, 'slayer', ...DUNGEON_TYPES ];


module.exports = class CompetitionCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'comp' ],
			description: 'WIP',
			guildOnly: false,
			args: false,
			usage: '',
			cooldown: 1,
		});
	}

	/**
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 */
	async getUserInput(message) {
		let type;

		let retries = 0;

		do {
			const ANSWER = await message.awaitReply(commaListsOr`competition type? ${COMPETITION_TYPES}`);

			if (ANSWER) {
				const result = autocorrect(ANSWER, COMPETITION_TYPES);

				if (result.similarity >= this.client.config.get('AUTOCORRECT_THRESHOLD')) {
					type = result.value;
				} else {
					if (++retries >= this.client.config.get('USER_INPUT_MAX_RETRIES')) throw new Error('the command has been cancelled.');

					message.reply(`${ANSWER} is not a valid type`);
				}
			} else if (++retries >= this.client.config.get('USER_INPUT_MAX_RETRIES')) {
				throw new Error('the command has been cancelled.');
			}
		} while (!type);

		return type;
	}

	/**
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string} question
	 */
	async getDateInput(message, question) {
		let userInput;
		let retries = 0;

		do {
			const ANSWER = await message.awaitReply(question);

			if (ANSWER) {
				const result = new Date(ANSWER);

				if (!isNaN(result)) {
					userInput = result;
				} else {
					if (++retries >= this.client.config.get('USER_INPUT_MAX_RETRIES')) throw new Error('the command has been cancelled.');

					message.reply(`${ANSWER} is not a valid date`);
				}
			} else if (++retries >= this.client.config.get('USER_INPUT_MAX_RETRIES')) {
				throw new Error('the command has been cancelled.');
			}
		} while (!userInput);

		return userInput;
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
		const collector = message.channel.createMessageCollector(
			msg => msg.author.id === message.author.id && msg.content.toLowerCase() === 'cancel',
			{ max: 1 },
		);

		const MAX_RETRIES = 3;

		try {
			let retries;

			collector.on('collect', () => {
				throw new Error('the command has been cancelled.');
			});

			// type
			let type;

			retries = 0;

			do {
				const ANSWER = await message.awaitReply(commaListsOr`competition type? ${COMPETITION_TYPES}`);

				if (ANSWER) {
					const result = autocorrect(ANSWER, COMPETITION_TYPES);

					if (result.similarity >= config.get('AUTOCORRECT_THRESHOLD')) {
						type = result.value;
					} else {
						if (++retries >= MAX_RETRIES) throw new Error('the command has been cancelled.');

						message.reply(`${ANSWER} is not a valid type`);
					}
				} else if (++retries >= MAX_RETRIES) {
					throw new Error('the command has been cancelled.');
				}
			} while (!type);


			// starting time
			const startingTime = await this.getDateInput(message, 'starting time?');
			const endingTime = await this.getDateInput(message, 'ending time?');

			message.reply([ startingTime.toUTCString(), endingTime.toUTCString(), type ].join('\n'));
		} catch (error) {
			message.reply(error.message);
		} finally {
			collector.stop();
		}
	}
};
