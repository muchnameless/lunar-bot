'use strict';

const { basename } = require('path');
const { Structures, CommandInteraction } = require('discord.js');
// const logger = require('../../functions/logger');


class LunarCommandInteraction extends CommandInteraction {
	constructor(...args) {
		super(...args);

		/**
		 * wether the first reply was ephemeral
		 */
		this.ephemeral = null;
		/**
		 * deferring promise
		 */
		this._deferring = null;
	}

	/**
	 * @param {import('discord.js').CommandInteractionOption[]} options
	 */
	static stringifyOptions(options) {
		return options
			?.reduce(
				(acc, cur) => {
					if (cur.type === 'SUB_COMMAND' || cur.type === 'SUB_COMMAND_GROUP') {
						return `${acc} ${cur.name}${this.stringifyOptions(cur.options)}`;
					}

					return `${acc} ${cur.name}: ${cur.value}`;
				},
				'',
			)
			?? '';
	}

	get logInfo() {
		return `${this.commandName}${LunarCommandInteraction.stringifyOptions(this.options)}`;
	}

	/**
	 * @param {import('discord.js').InteractionDeferOptions} options
	 */
	async defer(options) {
		this.ephemeral = options?.ephemeral ?? false;

		return this._deferring = super.defer(options);
	}

	/**
	 *
	 * @param {string} content
	 * @param {import('discord.js').InteractionReplyOptions} options
	 */
	async reply(content, options) {
		await this._deferring;

		if (this.deferred) {
			// ephemeral defer
			if (this.ephemeral) {
				if (options?.ephemeral) return this.editReply(content, options);

				// ephemeral defer and non-ephemeral followUp
				await this.deleteReply();
				return this.followUp(content, options);
			}

			// non-ephemeral defer
			if (options?.ephemeral) {
				await this.deleteReply();
				return this.followUp(content, options);
			}

			return this.editReply(content, options);
		}

		if (this.replied) return this.followUp(content, options);

		this.ephemeral = options?.ephemeral ?? false;

		return this.reply(content, options);
	}
}

Structures.extend(basename(__filename, '.js'), () => LunarCommandInteraction);

module.exports = LunarCommandInteraction;
