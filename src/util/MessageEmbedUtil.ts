import { EMBED_MAX_FIELDS } from '../constants';
import type { MessageEmbed } from 'discord.js';


export default class MessageEmbedUtil extends null {
	/**
	 * adds additional blank inline fields such that each line is filled with 'numberOfRows = 3' of them
	 * @param embed
	 * @param numberOfRows
	 */
	static padFields(embed: MessageEmbed, numberOfRows = 3) {
		if (embed.fields.length >= EMBED_MAX_FIELDS) return embed; // max number of embed fields already reached

		for (let index = (numberOfRows - (embed.fields.filter(({ inline }) => inline).length % numberOfRows)) % numberOfRows; --index >= 0;) {
			embed.addFields({
				name: '\u200B',
				value: '\u200B',
				inline: true,
			});
		}

		return embed;
	}
}
