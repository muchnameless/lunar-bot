'use strict';

const { stripIndents } = require('common-tags');
const Command = require('../../structures/Command');
const logger = require('../../functions/logger');


module.exports = class MyCommand extends Command {
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

	async run(client, config, message, args, flags, rawArgs) {
		// list all config entries
		if (!args.length) {
			return message.reply(
				config.sort((a, b) => a.key.localeCompare(b.key)).map(cfg => `${cfg.key}: ${cfg.value}`).join('\n'),
				{ code: 'apache', split: { char: '\n' } },
			);
		}

		// search the config
		if (args.length === 1) {

			// delete an existing entry
			if (flags.some(flag => [ 'r', 'remove', 'd', 'delete' ].includes(flag))) {
				const KEY = args[0].toUpperCase();
				const VALUE = config.get(KEY);

				if (VALUE === null) return message.reply(`\`${KEY}\` is not in the config.`);

				await config.delete(KEY);
				return message.reply(`removed \`${KEY}\`: \`${VALUE}\``);
			}

			const QUERY_REGEX = new RegExp(args[0], 'i');
			const configEntries = config.filter(cfg => QUERY_REGEX.test(cfg.key) || QUERY_REGEX.test(cfg.value));

			return message.reply(
				configEntries.sort((a, b) => a.key.localeCompare(b.key)).map(cfg => `${cfg.key}: ${cfg.value}`).join('\n') || `no config entries for '${args[0]}' found`,
				{ code: 'apache', split: { char: '\n' } },
			);
		}

		// set a config entry
		const KEY = args.shift().toUpperCase();
		const OLD_VALUE = config.get(KEY);
		const entry = await config.set(KEY, args.join(' '));
		return message.reply(
			`${entry.key}: ${OLD_VALUE !== null ? `'${OLD_VALUE}' -> ` : ''}'${entry.value}'`,
			{ code: 'apache' },
		);
	}
};
