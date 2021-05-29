'use strict';

module.exports = class MissingPermissionsError extends Error {
	/**
	 * @param {string} message
	 * @param {{ interaction: import('discord.js').CommandInteraction, requiredRoles: string[] }} data
	 */
	constructor(message, { interaction, requiredRoles }) {
		super(message);

		this.name = 'MissingPermissionsError';
		this.interaction = interaction;
		this.requiredRoles = requiredRoles;
	}

	get command() {
		const firstOption = this.interaction.options?.[0];

		return `${this.interaction.commandName}${firstOption?.type === 'SUB_COMMAND' || firstOption?.type === 'SUB_COMMAND_GROUP' ? ` ${firstOption.name}` : ''}`;
	}
};
