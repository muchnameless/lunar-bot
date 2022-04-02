import { ButtonComponent, ButtonStyle, ActionRow } from 'discord.js';
import {
	DELETE_EMOJI,
	DELETE_KEY,
	DOUBLE_LEFT_EMOJI,
	DOUBLE_RIGHT_EMOJI,
	LEFT_EMOJI,
	RELOAD_EMOJI,
	RIGHT_EMOJI,
} from '../constants';
import type { User } from 'discord.js';

/**
 * returns a MessageButton which triggers deleting the Message it is attached to
 * @param user
 */
export const buildDeleteButton = (user: User) =>
	new ButtonComponent()
		.setCustomId(`${DELETE_KEY}:${user.id}`)
		.setEmoji({ name: DELETE_EMOJI })
		.setStyle(ButtonStyle.Danger);

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

	return new ActionRow().addComponents(
		new ButtonComponent()
			.setCustomId(`${baseCustomId}:${firstPage}:${DOUBLE_LEFT_EMOJI}`)
			.setEmoji({ name: DOUBLE_LEFT_EMOJI })
			.setStyle(pageStyle)
			.setDisabled(DEC_DISABLED),
		new ButtonComponent()
			.setCustomId(`${baseCustomId}:${currentPage - 1}:${LEFT_EMOJI}`)
			.setEmoji({ name: LEFT_EMOJI })
			.setStyle(pageStyle)
			.setDisabled(DEC_DISABLED),
		new ButtonComponent()
			.setCustomId(`${baseCustomId}:${currentPage + 1}:${RIGHT_EMOJI}`)
			.setEmoji({ name: RIGHT_EMOJI })
			.setStyle(pageStyle)
			.setDisabled(INC_DISABLED),
		new ButtonComponent()
			.setCustomId(`${baseCustomId}:${totalPages}:${DOUBLE_RIGHT_EMOJI}`)
			.setEmoji({ name: DOUBLE_RIGHT_EMOJI })
			.setStyle(pageStyle)
			.setDisabled(INC_DISABLED),
		new ButtonComponent()
			.setCustomId(`${baseCustomId}:${currentPage}:${RELOAD_EMOJI}`)
			.setEmoji({ name: RELOAD_EMOJI })
			.setStyle(reloadStyle),
	);
}
