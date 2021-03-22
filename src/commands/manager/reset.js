'use strict';

const { commaListsAnd } = require('common-tags');
const { autocorrect } = require('../../functions/util');
const Command = require('../../structures/commands/Command');
// const logger = require('../../functions/logger');

const types = [ 'xp', 'tax' ];


module.exports = class resetCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [],
			description: commaListsAnd`alternative way to call ${types.map(type => `${type}reset`)}`,
			args: true,
			usage: () => types.map(type => `[\`${type}\`] ${this.commandCollection.getByName(`${type}reset`)?.usage}`).join('\n\n'),
			cooldown: 5,
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
		const TYPE = args.shift().toLowerCase();
		const { value, similarity } = autocorrect(TYPE, types);

		if (similarity < this.config.get('AUTOCORRECT_THRESHOLD')) return message.reply(`unknown type \`${TYPE}\`.`);

		return this.commandCollection.getByName(`${value}reset`).run(message, args, flags, rawArgs);
	}
};
