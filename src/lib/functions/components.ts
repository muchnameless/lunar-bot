import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { CustomIdKey, UnicodeEmoji } from '#constants';
import type { MessageActionRowComponentBuilder, Snowflake } from 'discord.js';

/**
 * returns a MessageButton which triggers deleting the Message it is attached to
 * @param userId
 */
export const buildDeleteButton = (userId: Snowflake) =>
	new ButtonBuilder()
		.setCustomId(`${CustomIdKey.Delete}:${userId}`)
		.setEmoji({ name: UnicodeEmoji.Delete })
		.setStyle(ButtonStyle.Danger);

/**
 * returns a MessageButton which triggers (un)pinning the Message it is attached to
 */
export const buildPinButton = () =>
	new ButtonBuilder() //
		.setCustomId(CustomIdKey.Pin)
		.setEmoji({ name: UnicodeEmoji.Pin })
		.setStyle(ButtonStyle.Secondary);

/**
 * returns a MessageButton which triggers changing the ephemeral state of the Message it is attached to
 */
export const buildVisibilityButton = () =>
	new ButtonBuilder()
		.setCustomId(CustomIdKey.Visibility)
		.setEmoji({ name: UnicodeEmoji.Eyes })
		.setStyle(ButtonStyle.Secondary);

type PaginationButtonOptions = Partial<{
	/** disable all but the reload button */
	disablePages: boolean;
	/** overwrite the first page number, defaults to 1 */
	firstPage: number;
	/** page button style */
	pageStyle: ButtonStyle;
	/** reload button style */
	reloadStyle: ButtonStyle;
}>;

/**
 * returns an ActionRow with pagination buttons
 * @param baseCustomId
 * @param currentPage
 * @param totalPages
 * @param options
 */
export function buildPaginationActionRow(
	baseCustomId: string,
	currentPage: number,
	totalPages: number,
	{
		disablePages = false,
		firstPage = 1,
		pageStyle = ButtonStyle.Primary,
		reloadStyle = ButtonStyle.Primary,
	}: PaginationButtonOptions = {},
) {
	const INVALID_PAGES = disablePages || Number.isNaN(currentPage) || Number.isNaN(totalPages);
	const DEC_DISABLED = currentPage === firstPage || INVALID_PAGES;
	const INC_DISABLED = currentPage === totalPages || INVALID_PAGES;

	// emojis are added to customIds to ensure they are unique, e.g. "firstPage" could equal "currentPage - 1"
	return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(`${baseCustomId}:${firstPage}:${UnicodeEmoji.DoubleLeft}`)
			.setEmoji({ name: UnicodeEmoji.DoubleLeft })
			.setStyle(pageStyle)
			.setDisabled(DEC_DISABLED),
		new ButtonBuilder()
			.setCustomId(`${baseCustomId}:${currentPage - 1}:${UnicodeEmoji.Left}`)
			.setEmoji({ name: UnicodeEmoji.Left })
			.setStyle(pageStyle)
			.setDisabled(DEC_DISABLED),
		new ButtonBuilder()
			.setCustomId(`${baseCustomId}:${currentPage + 1}:${UnicodeEmoji.Right}`)
			.setEmoji({ name: UnicodeEmoji.Right })
			.setStyle(pageStyle)
			.setDisabled(INC_DISABLED),
		new ButtonBuilder()
			.setCustomId(`${baseCustomId}:${totalPages}:${UnicodeEmoji.DoubleRight}`)
			.setEmoji({ name: UnicodeEmoji.DoubleRight })
			.setStyle(pageStyle)
			.setDisabled(INC_DISABLED),
		new ButtonBuilder()
			.setCustomId(`${baseCustomId}:${currentPage}:${UnicodeEmoji.Reload}`)
			.setEmoji({ name: UnicodeEmoji.Reload })
			.setStyle(reloadStyle),
	);
}
