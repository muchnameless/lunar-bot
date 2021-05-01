'use strict';

const fetch = require('node-fetch');
const { autocorrect } = require('../../functions/util');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class DocsCommand extends Command {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [],
			description: 'search discord.js docs',
			args: true,
			usage: `[\`query\`] <\`-${DocsCommand.PROJECTS.join('`|`')}\` to use another source than 'stable'>`,
			cooldown: 0,
		});
	}

	static PROJECTS = [ 'stable', 'master', 'commando', 'rpc', 'akairo', 'akairo-master', 'collection' ];

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(message, args, flags, rawArgs) { // eslint-disable-line no-unused-vars
		let project;

		for (const flag of flags) {
			const result = autocorrect(flag, DocsCommand.PROJECTS);

			if (result.similarity < this.config.get('AUTOCORRECT_THRESHOLD')) continue;

			project = result.value;
			break;
		}

		project ??= DocsCommand.PROJECTS[0];

		const embed = await fetch(`https://djsdocs.sorta.moe/v2/embed?src=${project}&q=${args.join('.').replace(/#/g, '.')}`).then(
			res => res.json(),
			logger.error,
		);

		message.reply(embed ?? 'no response from the discord.js-docs-api.');
	}
};
