'use strict';

const BridgeCommand = require('../../../commands/BridgeCommand');
// const logger = require('../../../../functions/logger');


module.exports = class MyCommand extends BridgeCommand {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [],
			description: '',
			args: false,
			usage: '',
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../HypixelMessage')} message
	 */
	async runInGame(message) { // eslint-disable-line no-unused-vars
		// do stuff
	}
};
