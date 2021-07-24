'use strict';

const BridgeCommand = require('../../../commands/BridgeCommand');
// const logger = require('../../../../functions/logger');


module.exports = class PingBridgeCommand extends BridgeCommand {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [ 'o/' ],
			description: 'ping the bot',
			args: false,
			usage: '',
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../HypixelMessage')} message
	 */
	async runInGame(message) {
		return message.reply('o/');
	}
};
