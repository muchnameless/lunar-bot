'use strict';

const Command = require('../../structures/Command');
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

	async run(client, config, message, args, flags, rawArgs) {
		const DELETED_AMOUNT = await client.players.sweepDb();

		message.reply(`removed \`${DELETED_AMOUNT}\` entr${DELETED_AMOUNT === 1 ? 'y' : 'ies'} from the player database.`);
	}
};
