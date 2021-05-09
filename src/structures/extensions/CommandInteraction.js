'use strict';

const { CommandInteraction } = require('discord.js');

// chooses the correct reply method
Object.defineProperty(CommandInteraction.prototype, 'safeReply', {
	get() {
		if (this.replied || this.deferred) return this.editReply;
		return this.reply;
	},
});
