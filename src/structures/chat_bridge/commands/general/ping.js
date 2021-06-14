'use strict';

const BridgeCommand = require('../../../commands/BridgeCommand');
// const logger = require('../../../../functions/logger');


module.exports = class PingBridgeCommand extends BridgeCommand {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [ 'o/', '( ﾟ◡ﾟ)/' ],
			description: 'ping the bot',
			args: false,
			usage: '',
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../HypixelMessage')} message message that triggered the command
	 * @param {string[]} args command arguments
	 */
	async runInGame(message, args) { // eslint-disable-line no-unused-vars
		message.reply('o/');
	}
};
