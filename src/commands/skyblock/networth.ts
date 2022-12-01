import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import BaseSkyBlockCommand, {
	type baseParseArgsOptions,
	type BaseSkyBlockSlashData,
	type FetchedData,
} from './~base-skyblock-command.js';
import { type HypixelUserMessage, type ParseArgsConfigOptions } from '#chatBridge/HypixelMessage.js';
import { FindProfileStrategy, NON_LETTER_REGEXP, PROFILE_NAMES, UnicodeEmoji } from '#constants';
import { autocorrect, formatError, seconds, shortenNumber, upperCaseFirstChar } from '#functions';
import { logger } from '#logger';
import { getNetworth } from '#networth/networth.js';
import { type CommandContext } from '#structures/commands/BaseCommand.js';
import { type BridgeCommandData } from '#structures/commands/BridgeCommand.js';
import {
	includeAuctionsOption,
	includeAuctionsOptionName,
	skyblockFindProfileOptionName,
} from '#structures/commands/commonOptions.js';
import { InteractionUtil } from '#utils';

const parseArgsOptions = {
	auctions: {
		type: 'boolean',
		short: 'a',
	},
} as const satisfies ParseArgsConfigOptions;

export default class NetworthCommand extends BaseSkyBlockCommand {
	public constructor(context: CommandContext, slashData?: BaseSkyBlockSlashData, bridgeData?: BridgeCommandData) {
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
				parseArgsOptions,
				usage: '--auctions | -a',
				...bridgeData,
			},
		);
	}

	/**
	 * data -> reply
	 *
	 * @param data
	 */
	// @ts-expect-error override
	protected override async _generateReply({ ign, uuid, profile }: FetchedData, addAuctions: boolean) {
		const { networth, bankingAPIEnabled, inventoryAPIEnabled } = await getNetworth(profile, uuid, {
			addAuctions,
		});

		const reply = [shortenNumber(networth)];
		if (!bankingAPIEnabled) reply.push(`${UnicodeEmoji.X} Banking API disabled`);
		if (!inventoryAPIEnabled) reply.push(`${UnicodeEmoji.X} Inventory API disabled`);

		return { ign, profile, reply: reply.join(' | ') };
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 */
	public override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		try {
			return InteractionUtil.reply(
				interaction,
				this._finalizeReply(
					await this._generateReply(
						await this._fetchData(
							interaction,
							interaction.options.getString('ign'),
							interaction.options.getString('profile'),
							interaction.options.getString(skyblockFindProfileOptionName) as FindProfileStrategy | null,
						),
						interaction.options.getBoolean(includeAuctionsOptionName) ?? false,
					),
				),
			);
		} catch (error) {
			logger.error(error, '[NETWORTH CMD]');
			return InteractionUtil.reply(interaction, formatError(error));
		}
	}

	/**
	 * execute the command
	 *
	 * @param hypixelMessage
	 */
	public override async minecraftRun(hypixelMessage: HypixelUserMessage) {
		const {
			values: { profile, latest, auctions },
			positionals: [IGN, PROFILE_NAME_INPUT],
		} = hypixelMessage.commandData.parseArgs<typeof baseParseArgsOptions & typeof parseArgsOptions>();

		let profileName = (profile ?? PROFILE_NAME_INPUT)?.replace(NON_LETTER_REGEXP, '');
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
					return logger.error(error, '[NETWORTH CMD]');
				}
			}
		}

		try {
			return hypixelMessage.reply(
				this._finalizeReply(
					await this._generateReply(
						await this._fetchData(hypixelMessage, IGN, profileName, latest ? FindProfileStrategy.LastActive : null),
						auctions ?? false,
					),
				),
			);
		} catch (error) {
			logger.error(error, '[NETWORTH CMD]');
			return hypixelMessage.reply(formatError(error));
		}
	}
}
