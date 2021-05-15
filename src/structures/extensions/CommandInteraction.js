'use strict';

const { CommandInteraction } = require('discord.js');

// chooses the correct reply method
Object.defineProperty(CommandInteraction.prototype, 'followUpFixed', {
	async value(content, options) {
		if (options?.ephemeral && (this.replied || this.deferred)) await this.deleteReply();
		return this.followUp(content, options);
	},
});

Object.defineProperty(CommandInteraction.prototype, 'safeReply', {
	get() {
		if (this.replied || this.deferred) return this.editReply;
		return this.reply;
	},
});
