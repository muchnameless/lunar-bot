'use strict';

const { MessageEmbed } = require('discord.js');
const { EMBED_MAX_FIELDS } = require('../../constants/discord');


// adds additional blank inline fields such that each line is filled with 'numberOfRows = 3' of them
MessageEmbed.prototype.padFields = function(numberOfRows = 3) {
	if (this.fields.length >= EMBED_MAX_FIELDS) return; // max number of embed fields already reached

	for (let index = 1 + ((numberOfRows - (this.fields.filter(({ inline }) => inline).length % numberOfRows)) % numberOfRows); --index;) {
		this.addField('\u200b', '\u200b', true);
	}

	return this;
};
