import { embedLength } from 'discord.js';
import { EMBED_MAX_FIELDS } from '../constants';
import type { Embed, EmbedBuilder, JSONEncodable } from 'discord.js';
import type { APIEmbed } from 'discord-api-types/v10';

export class EmbedUtil extends null {
	/**
	 * total length of all embeds
	 * @param embeds
	 */
	static totalLength(embeds: (JSONEncodable<APIEmbed> | APIEmbed)[]) {
		return embeds.reduce((acc, cur) => acc + embedLength((cur as Embed | EmbedBuilder).data ?? cur), 0);
	}

	/**
	 * adds additional blank inline fields such that each line is filled with 'numberOfRows = 3' of them
	 * @param embed
	 * @param numberOfRows
	 */
	static padFields(embed: EmbedBuilder, numberOfRows = 3) {
		if (!embed.data.fields || embed.data.fields.length >= EMBED_MAX_FIELDS) return embed; // max number of embed fields already reached

		for (
			let index =
				(numberOfRows - (embed.data.fields.filter(({ inline }) => inline).length % numberOfRows)) % numberOfRows;
			--index >= 0;

		) {
			embed.addFields([
				{
					name: '\u200B',
					value: '\u200B',
					inline: true,
				},
			]);
		}

		return embed;
	}
}
