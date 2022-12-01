import { type Components } from '@zikeji/hypixel';
import { type Awaitable, type ChatInputCommandInteraction, type SlashCommandBuilder } from 'discord.js';
import { getSkyBlockProfiles } from '#api';
import { type HypixelUserMessage, type ParseArgsConfigOptions } from '#chatBridge/HypixelMessage.js';
import { FindProfileStrategy, NON_LETTER_REGEXP, PROFILE_NAMES } from '#constants';
import {
	autocorrect,
	commaListOr,
	escapeIgn,
	findSkyBlockProfile,
	formatError,
	formatSkyBlockProfileName,
	getUuidAndIgn,
	seconds,
	upperCaseFirstChar,
} from '#functions';
import { logger } from '#logger';
import { type ApplicationCommandData, type SlashCommandOption } from '#structures/commands/ApplicationCommand.js';
import { type CommandContext } from '#structures/commands/BaseCommand.js';
import { type BridgeCommandData } from '#structures/commands/BridgeCommand.js';
import { DualCommand } from '#structures/commands/DualCommand.js';
import {
	optionalIgnOption,
	skyblockFindProfileOption,
	skyblockFindProfileOptionName,
	skyblockProfileOption,
} from '#structures/commands/commonOptions.js';
import { InteractionUtil } from '#utils';

export type FetchedData = Awaited<ReturnType<BaseSkyBlockCommand['_fetchData']>>;

export type BaseSkyBlockSlashData = ApplicationCommandData & { additionalOptions?: SlashCommandOption[] };

export const baseParseArgsOptions = {
	profile: {
		type: 'string',
		short: 'p',
	},
	latest: {
		type: 'boolean',
		short: 'l',
	},
} as const satisfies ParseArgsConfigOptions;

interface ReplyData {
	ign: string;
	profile: NonNullable<Components.Schemas.SkyBlockProfileCuteName>;
	reply: string;
}

export default class BaseSkyBlockCommand extends DualCommand {
	public constructor(
		context: CommandContext,
		{ additionalOptions, ...slashData }: BaseSkyBlockSlashData,
		bridgeData: BridgeCommandData = {},
	) {
		if (!(slashData.slash as SlashCommandBuilder).options.length) {
			(slashData.slash as SlashCommandBuilder)
				.addStringOption(optionalIgnOption)
				.addStringOption(skyblockProfileOption)
				.addStringOption(skyblockFindProfileOption);
		}

		if (additionalOptions) {
			(slashData.slash as SlashCommandBuilder).options.push(...additionalOptions);
		}

		bridgeData.parseArgsOptions = {
			...baseParseArgsOptions,
			...bridgeData.parseArgsOptions,
		};

		if (typeof bridgeData.usage !== 'function') {
			bridgeData.usage = bridgeData.usage
				? `<\`IGN\`> <\`profile\` name> | --profile mango | -p mango | --latest | -l | ${bridgeData.usage.trimStart()}`
				: '<`IGN`> <`profile` name> | --profile mango | -p mango | --latest | -l';
		}

		super(context, slashData, bridgeData);
	}

	/**
	 * @param ctx
	 * @param ignOrUuid
	 */
	protected async _fetchData(
		ctx: ChatInputCommandInteraction<'cachedOrDM'> | HypixelUserMessage,
		ignOrUuid: string | null | undefined,
		profileName: string | null | undefined,
		findProfileStrategy: FindProfileStrategy | null,
	) {
		const { uuid, ign } = await getUuidAndIgn(ctx, ignOrUuid);
		const profiles = await getSkyBlockProfiles(uuid);

		if (!profiles?.length) throw `\`${ign}\` has no SkyBlock profiles`;

		let profile: Components.Schemas.SkyBlockProfileCuteName | undefined;

		if (profileName) {
			profile = this._findProfileByName(profiles, profileName, ign);
		} else {
			profile = findSkyBlockProfile(profiles, uuid, findProfileStrategy);

			if (!profile) throw `\`${ign}\` has no SkyBlock profiles`;
		}

		return {
			ign,
			uuid,
			profile,
		};
	}

	/**
	 * find the profile by name, else throw an error message
	 *
	 * @param profiles
	 * @param profileName
	 * @param ign
	 */
	protected _findProfileByName(
		profiles: NonNullable<Components.Schemas.SkyBlockProfileCuteName>[],
		profileName: string,
		ign: string,
	) {
		const profile = profiles.find(({ cute_name }) => cute_name === profileName);

		if (!profile) {
			const availableProfiles = profiles.map(({ cute_name }) => `\`${upperCaseFirstChar(cute_name)}\``);

			throw `\`${ign}\` has no profile named \`${upperCaseFirstChar(profileName)}\`, available options: ${commaListOr(
				availableProfiles,
			)}`;
		}

		return profile;
	}

	/**
	 * data -> reply
	 *
	 * @param data
	 */
	protected _generateReply(data: FetchedData): Awaitable<ReplyData> {
		throw new Error('not implemented');
	}

	/**
	 * adds ign, profile and game mode indicators to the reply
	 *
	 * @param data
	 */
	protected _finalizeReply({ ign, profile, reply }: ReplyData): string {
		return `${escapeIgn(ign)} (${formatSkyBlockProfileName(profile)}): ${reply}`;
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
					),
				),
			);
		} catch (error) {
			logger.error({ err: error, msg: `[${this.name.toUpperCase()} CMD]` });
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
			values: { profile, latest },
			positionals: [IGN, PROFILE_NAME_INPUT],
		} = hypixelMessage.commandData.parseArgs<typeof baseParseArgsOptions>();

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
					return logger.error({ err: error, msg: `[${this.name.toUpperCase()} CMD]` });
				}
			}
		}

		try {
			return hypixelMessage.reply(
				this._finalizeReply(
					await this._generateReply(
						await this._fetchData(hypixelMessage, IGN, profileName, latest ? FindProfileStrategy.LastActive : null),
					),
				),
			);
		} catch (error) {
			logger.error({ err: error, msg: `[${this.name.toUpperCase()} CMD]` });
			return hypixelMessage.reply(formatError(error));
		}
	}
}
