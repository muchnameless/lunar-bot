'use strict';

const { stripIndents } = require('common-tags');
const Command = require('../../structures/commands/Command');
// const logger = require('../../functions/logger');


module.exports = class ConfigCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'c', 'settings' ],
			description: 'show and edit the bot\'s config',
			usage: stripIndents`
				no args to show all configs
				<\`query\`> to show search results from all entries
				<\`key\`> <\`value\`> to upsert a key-value-pair
				<\`-r\`|\`-d\`|\`--remove\`|\`--delete\`> <\`key\`> to remove a key-value-pair
			`,
			cooldown: 1,
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
		// list all config entries
		if (!args.length) {
			return message.reply(
				this.config.cache
					.sorted(({ key: keyA }, { key: keyB }) => keyA.localeCompare(keyB))
					.map(({ key, value }) => `${key}: ${value}`)
					.join('\n'),
				{ code: 'apache', split: { char: '\n' } },
			);
		}

		// search the config
		if (args.length === 1) {
			// delete an existing entry
			if (flags.some(flag => [ 'r', 'remove', 'd', 'delete' ].includes(flag))) {
				const KEY = args[0].toUpperCase();
				const VALUE = this.config.get(KEY);

				if (VALUE === null) return message.reply(`\`${KEY}\` is not in the config.`);

				await this.config.remove(KEY);
				return message.reply(`removed \`${KEY}\`: \`${VALUE}\``);
			}

			const queryRegex = new RegExp(args[0], 'i');
			const configEntries = this.config.cache.filter(({ key, value }) => queryRegex.test(key) || queryRegex.test(value));

			return message.reply(
				configEntries
					.sorted(({ key: keyA }, { key: keyB }) => keyA.localeCompare(keyB))
					.map(({ key, value }) => `${key}: ${value}`)
					.join('\n')
					|| `no config entries for '${args[0]}' found`,
				{ code: 'apache', split: { char: '\n' } },
			);
		}

		// set a config entry
		const KEY = args.shift().toUpperCase();
		const OLD_VALUE = this.config.get(KEY);
		const entry = await this.config.set(KEY, args.join(' '));

		return message.reply(
			`${entry.key}: ${OLD_VALUE !== null ? `'${OLD_VALUE}' -> ` : ''}'${entry.value}'`,
			{ code: 'apache' },
		);
	}
};
