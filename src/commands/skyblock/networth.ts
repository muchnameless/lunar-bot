import { SlashCommandBuilder } from '@discordjs/builders';
import {
	includeAuctionsOption,
	includeAuctionsOptionName,
	skyblockFindProfileOptionName,
} from '../../structures/commands/commonOptions';
import { formatError, seconds, shortenNumber } from '../../functions';
import { getNetworth } from '../../structures/networth/networth';
import { UnicodeEmoji } from '../../constants';
import { InteractionUtil } from '../../util';
import { logger } from '../../logger';
import BaseSkyBlockCommand, { type FetchedData } from './~base-skyblock-command';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { FindProfileStrategy } from '../../constants';
import type { BaseSkyBlockSlashData } from './~base-skyblock-command';
import type { BridgeCommandData } from '../../structures/commands/BridgeCommand';
import type { CommandContext } from '../../structures/commands/BaseCommand';

export default class NetworthCommand extends BaseSkyBlockCommand {
	constructor(context: CommandContext, slashData?: BaseSkyBlockSlashData, bridgeData?: BridgeCommandData) {
		super(
			context,
			slashData ?? {
				slash: new SlashCommandBuilder().setDescription("shows a player's networth, algorithm by Maro and SkyHelper"),
				additionalOptions: [includeAuctionsOption],
				cooldown: seconds(1),
			},
			bridgeData ?? {
				aliases: ['nw'],
			},
		);
	}

	/**
	 * data -> reply
	 * @param data
	 */
	// @ts-expect-error
	override async _generateReply({ ign, uuid, profile }: FetchedData, addAuctions: boolean) {
		const { networth, bankingAPIEnabled, inventoryAPIEnabled } = await getNetworth(profile, uuid, {
			addAuctions,
		});

		const reply = [`${ign} (${profile.cute_name}): ${shortenNumber(networth)}`];
		if (!bankingAPIEnabled) reply.push(`${UnicodeEmoji.X} Banking API disabled`);
		if (!inventoryAPIEnabled) reply.push(`${UnicodeEmoji.X} Inventory API disabled`);

		return reply.join(' | ');
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async runSlash(interaction: ChatInputCommandInteraction) {
		try {
			return InteractionUtil.reply(
				interaction,
				await this._generateReply(
					await this._fetchData(
						interaction,
						interaction.options.getString('ign'),
						interaction.options.getString('profile'),
						interaction.options.getString(skyblockFindProfileOptionName) as FindProfileStrategy | null,
					),
					interaction.options.getBoolean(includeAuctionsOptionName) ?? false,
				),
			);
		} catch (error) {
			logger.error({ err: error, msg: `[${this.name.toUpperCase()} CMD]` });
			return InteractionUtil.reply(interaction, formatError(error));
		}
	}
}
