'use strict';


module.exports = {
	description: 'deletes unused player db entries',
	aliases: [ 'sweep' ],
	// args: true,
	// usage: '',
	cooldown: 0,
	execute: async (message, args, flags) => {
		const DELETED_AMOUNT = await message.client.players.sweepDb();

		message.reply(`removed \`${DELETED_AMOUNT}\` entr${DELETED_AMOUNT === 1 ? 'y' : 'ies'} from the player database.`);
	},
};
