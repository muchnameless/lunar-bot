'use strict';

const { commaListsOr } = require('common-tags');
const { autocorrect } = require('../../functions/util');
const { SKILLS, DUNGEON_TYPES } = require('../../constants/skyblock');
const Command = require('../../structures/commands/Command');
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
	 * execute the command
	 * @param {import('../../structures/LunarClient')} client
	 * @param {import('../../structures/database/ConfigHandler')} config
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(client, config, message, args, flags, rawArgs) {
		return message.reply('WIP');

		const collector = message.channel.createMessageCollector(
			msg => msg.author.id === message.author.id,
			{ time: 60_000 },
		);

		let type;
		let startingTime;
		let endingTime;
		let retries = 0;

		try {
			await message.reply(commaListsOr`competition type? ${COMPETITION_TYPES}`);

			for await (const collected of collector) {
				collector.resetTimer();

				if (collected.content === 'cancel') throw new Error('command cancelled');

				if (!type) {
					const result = autocorrect(collected.content, COMPETITION_TYPES);

					if (result.similarity >= config.get('AUTOCORRECT_THRESHOLD')) {
						type = result.value;
						retries = 0;
						await message.awaitReply('starting time?');
					} else {
						if (++retries >= config.get('USER_INPUT_MAX_RETRIES')) throw new Error('the command has been cancelled.');

						message.reply(`\`${collected.content}\` is not a valid type`);
					}
				} else if (!startingTime) {
					const result = new Date(collected.content);

					if (!isNaN(result)) {
						startingTime = result;
						retries = 0;
						await message.awaitReply('ending time?');
					} else {
						if (++retries >= config.get('USER_INPUT_MAX_RETRIES')) throw new Error('the command has been cancelled.');

						message.reply(`\`${collected.content}\` is not a valid date`);
					}
				} else if (!endingTime) {
					const result = new Date(collected.content);

					if (!isNaN(result)) {
						endingTime = result;
						retries = 0;
					} else {
						if (++retries >= config.get('USER_INPUT_MAX_RETRIES')) throw new Error('the command has been cancelled.');

						message.reply(`\`${collected.content}\` is not a valid date`);
					}
				}
			}
		} catch (error) {
			message.reply('the command has been cancelled.');
		} finally {
			collector.stop();
		}

		logger.debug({ type, startingTime, endingTime });
	}
};
