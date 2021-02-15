'use strict';

const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class SweepDbCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'sweep' ],
			description: 'deletes unused player db entries',
			args: false,
			usage: '',
			cooldown: 0,
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
		const DELETED_AMOUNT = await client.players.sweepDb();

		message.reply(`removed \`${DELETED_AMOUNT}\` entr${DELETED_AMOUNT === 1 ? 'y' : 'ies'} from the player database.`);
	}
};
