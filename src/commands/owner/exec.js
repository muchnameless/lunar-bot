'use strict';

const { promisify } = require('util');
const { exec } = require('child_process');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class ExecCommand extends Command {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [ 'ex' ],
			description: 'executes bash code',
			args: true,
			usage: '[`code` to execute]',
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
	async run(message, args, flags, rawArgs) { // eslint-disable-line no-unused-vars
		try {
			const { stdout, stderr } = await promisify(exec)(rawArgs.join(' '));

			if (stdout) {
				logger.info(stdout);
				message.reply(stdout, {
					code: 'bash',
					editPreviousMessage: true,
				});
			}

			if (stderr) {
				logger.error(stderr);
				message.reply(`${stderr.name}: ${stderr.message}`, {
					code: 'xl',
					editPreviousMessage: false,
				});
			}
		} catch (error) {
			logger.error(error); // should contain code (exit code) and signal (that caused the termination)
			message.reply(`${error}`, { code: 'xl' });
		}
	}
};
