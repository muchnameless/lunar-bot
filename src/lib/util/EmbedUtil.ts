import { embedLength } from 'discord.js';
import { EmbedLimits } from '@sapphire/discord-utilities';
import type { APIEmbed, Embed, EmbedBuilder, JSONEncodable } from 'discord.js';

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
		if (!embed.data.fields || embed.data.fields.length >= EmbedLimits.MaximumFields) return embed; // max number of embed fields already reached

		for (
			let index =
				(numberOfRows - (embed.data.fields.filter(({ inline }) => inline).length % numberOfRows)) % numberOfRows;
			--index >= 0;

		) {
			embed.addFields({
				name: '\u200B',
				value: '\u200B',
				inline: true,
			});
		}

		return embed;
	}
}
