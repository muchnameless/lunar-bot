import { SlashCommandBuilder } from 'discord.js';
import { InteractionUtil } from '#utils';
import { logger } from '#logger';
import { getNetworth } from '#networth/networth';
import { UnicodeEmoji, FindProfileStrategy, PROFILE_NAMES } from '#constants';
import {
	includeAuctionsOption,
	includeAuctionsOptionName,
	skyblockFindProfileOptionName,
} from '#structures/commands/commonOptions';
import { autocorrect, formatError, seconds, shortenNumber, upperCaseFirstChar } from '#functions';
import BaseSkyBlockCommand, { type FetchedData } from './~base-skyblock-command';
import type { ParseArgsResult } from 'node:util';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { BaseSkyBlockSlashData } from './~base-skyblock-command';
import type { BridgeCommandData } from '#structures/commands/BridgeCommand';
import type { CommandContext } from '#structures/commands/BaseCommand';
import type { HypixelUserMessage } from '#chatBridge/HypixelMessage';

export default class NetworthCommand extends BaseSkyBlockCommand {
	constructor(context: CommandContext, slashData?: BaseSkyBlockSlashData, bridgeData?: BridgeCommandData) {
		super(
			context,
			{
				slash: new SlashCommandBuilder().setDescription("shows a player's networth, algorithm by Maro and SkyHelper"),
				additionalOptions: [includeAuctionsOption],
				cooldown: seconds(1),
				...slashData,
			},
			{
				aliases: ['nw'],
				parseArgsOptions: {
					auctions: {
						type: 'boolean',
						short: 'a',
					},
				},
				usage: '--auctions | -a',
				...bridgeData,
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
	override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
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

	/**
	 * execute the command
	 * @param hypixelMessage
	 */
	override async minecraftRun(hypixelMessage: HypixelUserMessage) {
		const {
			values: { profile, latest, auctions },
			positionals: [IGN, PROFILE_NAME_INPUT],
		} = hypixelMessage.commandData.args as ParseArgsResult & {
			values: { profile?: string; latest?: boolean; auctions?: boolean };
		};

		let profileName = (profile ?? PROFILE_NAME_INPUT)?.replace(/[^a-z]/gi, '');
		if (profileName) {
			let similarity: number;

			({ value: profileName, similarity } = autocorrect(profileName, PROFILE_NAMES));

			if (similarity < this.config.get('AUTOCORRECT_THRESHOLD')) {
				try {
					await hypixelMessage.awaitConfirmation({
						question: `'${upperCaseFirstChar(
							PROFILE_NAME_INPUT!,
						)}' is not a valid SkyBlock profile name, did you mean '${profileName}'?`,
						time: seconds(30),
					});
				} catch (error) {
					return logger.error({ err: error, msg: `[${this.name.toUpperCase()} CMD]` });
				}
			}
		}

		try {
			return hypixelMessage.reply(
				await this._generateReply(
					await this._fetchData(hypixelMessage, IGN, profileName, latest ? FindProfileStrategy.LastActive : null),
					auctions ?? false,
				),
			);
		} catch (error) {
			logger.error({ err: error, msg: `[${this.name.toUpperCase()} CMD]` });
			return hypixelMessage.reply(formatError(error));
		}
	}
}
