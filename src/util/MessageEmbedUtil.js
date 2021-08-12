'use strict';

const { EMBED_MAX_FIELDS } = require('../constants/discord');
// const logger = require('../functions/logger');


module.exports = class MessageEmbedUtil extends null {
	/**
	 * adds additional blank inline fields such that each line is filled with 'numberOfRows = 3' of them
	 * @param {import('discord.js').MessageEmbed} embed
	 * @param {number} [numberOfRows=3]
	 */
	static padFields(embed, numberOfRows = 3) {
		if (embed.fields.length >= EMBED_MAX_FIELDS) return; // max number of embed fields already reached

		for (let index = (numberOfRows - (embed.fields.filter(({ inline }) => inline).length % numberOfRows)) % numberOfRows; --index >= 0;) {
			embed.addFields({
				name: '\u200b',
				value: '\u200b',
				inline: true,
			});
		}

		return embed;
	}
};
