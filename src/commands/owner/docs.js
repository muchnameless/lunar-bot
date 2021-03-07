'use strict';

const fetch = require('node-fetch');
const { autocorrect } = require('../../functions/util');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');

const projects = [ 'stable', 'master', 'commando', 'rpc', 'akairo', 'akairo-master', 'collection' ];


module.exports = class DocsCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'search discord.js docs',
			args: true,
			usage: `[\`query\`] <\`-${projects.join('`|`')}\` to use another source than 'stable'>`,
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(message, args, flags) {
		let project;

		for (const flag of flags) {
			const result = autocorrect(flag, projects);

			if (result.similarity < this.client.config.get('AUTOCORRECT_THRESHOLD')) continue;

			project = result.value;
			break;
		}

		project ??= projects[0];

		const embed = await fetch(`https://djsdocs.sorta.moe/v2/embed?src=${project}&q=${args.join('.').replace(/#/g, '.')}`).then(
			res => res.json(),
			logger.error,
		);

		message.reply(embed ?? 'no response from the discord.js-docs-api.');
	}
};
