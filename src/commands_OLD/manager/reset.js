'use strict';

const { commaListsAnd } = require('common-tags');
const { autocorrect } = require('../../functions/util');
const Command = require('../../structures/commands/Command');
// const logger = require('../../functions/logger');


module.exports = class ResetCommand extends Command {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [],
			description: commaListsAnd`alternative way to call ${ResetCommand.TYPES.map(type => `${type}reset`)}`,
			args: true,
			usage: () => ResetCommand.TYPES.map(type => `[\`${type}\`] ${this.collection.getByName(`${type}reset`)?.usage}`).join('\n\n'),
			cooldown: 5,
		});
	}

	static TYPES = [ 'xp', 'tax' ];

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 */
	async run(message, args) { // eslint-disable-line no-unused-vars
		const TYPE = args.shift().toLowerCase();
		const { value, similarity } = autocorrect(TYPE, ResetCommand.TYPES);

		if (similarity < this.config.get('AUTOCORRECT_THRESHOLD')) return message.reply(`unknown type \`${TYPE}\`.`);

		return this.collection.getByName(`${value}reset`).run(message, args);
	}
};
