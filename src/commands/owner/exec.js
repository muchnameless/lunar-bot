'use strict';

const { exec } = require('child_process');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class ExecCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'ex' ],
			description: 'executes bash code',
			args: true,
			usage: '[`command name` to reload, `all`|`commands` for all commands, `database`|`db` cache, `cooldown(s)`]',
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/LunarClient')} client
	 * @param {import('../../structures/database/managers/ConfigManager')} config
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(client, config, message, args, flags, rawArgs) {
		exec(`${rawArgs.join(' ')}`, (err, stdout, stderr) => {
			if (err) {
				logger.error(err);
				return message.reply(stderr, { code: 'xl' });
			}

			logger.debug(stdout);
			message.reply(stdout, { code: 'bash' });
		});
	}
};
