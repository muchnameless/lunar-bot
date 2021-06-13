'use strict';

const Command = require('../../structures/commands/Command');
// const logger = require('../../functions/logger');


module.exports = class SweepDbCommand extends Command {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [ 'sweep' ],
			description: 'deletes unused player db entries',
			args: false,
			usage: '',
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 */
	async run(message, args) { // eslint-disable-line no-unused-vars
		const DELETED_AMOUNT = await this.client.players.sweepDb();

		message.reply(`removed \`${DELETED_AMOUNT}\` entr${DELETED_AMOUNT === 1 ? 'y' : 'ies'} from the player database`);
	}
};
