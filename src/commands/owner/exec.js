'use strict';

const { promisify } = require('util');
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
		try {
			const { stdout, stderr } = await promisify(exec)(rawArgs.join(' '));

			if (stdout) {
				logger.info(stdout);
				message.reply(stdout, { code: 'bash' });
			}

			if (stderr) {
				logger.error(stderr);
				message.reply(`${stderr.name}: ${stderr.message}`, { code: 'xl' });
			}
		} catch (error) {
			logger.error(error); // should contain code (exit code) and signal (that caused the termination)
			message.reply(`${error.name}: ${error.message}`, { code: 'xl' });
		}
	}
};
