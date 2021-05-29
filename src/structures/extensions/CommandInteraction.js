'use strict';

const { CommandInteraction } = require('discord.js');

// chooses the correct reply method
Object.defineProperty(CommandInteraction.prototype, 'followUpFixed', {
	async value(content, options) {
		if (options?.ephemeral && (this.deferred || this.replied)) await this.deleteReply();
		return this.followUp(content, options);
	},
});

Object.defineProperty(CommandInteraction.prototype, 'safeReply', {
	async value(content, options) {
		if (this.deferred || this.replied) {
			if (!options?.ephemeral) return this.editReply(content, options);
			await this.deleteReply();
			return this.followUp(content, options);
		}
		return this.reply(content, options);
	},
});
