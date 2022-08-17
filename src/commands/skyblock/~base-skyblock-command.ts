import { InteractionUtil } from '#utils';
import { logger } from '#logger';
import { DualCommand } from '#structures/commands/DualCommand';
import { FindProfileStrategy, PROFILE_NAMES } from '#constants';
import {
	optionalIgnOption,
	skyblockFindProfileOption,
	skyblockFindProfileOptionName,
	skyblockProfileOption,
} from '#structures/commands/commonOptions';
import {
	autocorrect,
	formatError,
	findSkyblockProfile,
	getUuidAndIgn,
	seconds,
	upperCaseFirstChar,
	commaListOr,
} from '#functions';
import { getSkyBlockProfiles } from '#api';
import type { Components } from '@zikeji/hypixel';
import type { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import type { HypixelUserMessage } from '#chatBridge/HypixelMessage';
import type { CommandContext } from '#structures/commands/BaseCommand';
import type { BridgeCommandData } from '#structures/commands/BridgeCommand';
import type { ApplicationCommandData, SlashCommandOption } from '#structures/commands/ApplicationCommand';

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
} as const;

export default class BaseSkyBlockCommand extends DualCommand {
	constructor(
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
	// eslint-disable-next-line class-methods-use-this
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

		if (!profileName) {
			profile = findSkyblockProfile(profiles, uuid, findProfileStrategy);

			if (!profile) throw `\`${ign}\` has no SkyBlock profiles`;
		} else {
			profile = this._findProfileByName(profiles, profileName, ign);
		}

		return {
			ign,
			uuid,
			profile,
		};
	}

	/**
	 * find the profile by name, else throw an error message
	 * @param profiles
	 * @param profileName
	 * @param ign
	 */
	// eslint-disable-next-line class-methods-use-this
	protected _findProfileByName(
		profiles: NonNullable<Components.Schemas.SkyBlockProfileCuteName>[],
		profileName: string,
		ign: string,
	) {
		const profile = profiles.find(({ cute_name: name }) => name === profileName);

		if (!profile) {
			const availableProfiles = profiles.map(({ cute_name: name }) => `\`${upperCaseFirstChar(name)}\``);

			throw `\`${ign}\` has no profile named \`${upperCaseFirstChar(profileName)}\`, available options: ${commaListOr(
				availableProfiles,
			)}`;
		}

		return profile;
	}

	/**
	 * data -> reply
	 * @param data
	 */
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	protected _generateReply(data: FetchedData): string | Promise<string> {
		throw new Error('not implemented');
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
			values: { profile, latest },
			positionals: [IGN, PROFILE_NAME_INPUT],
		} = hypixelMessage.commandData.parseArgs<typeof baseParseArgsOptions>();

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
				),
			);
		} catch (error) {
			logger.error({ err: error, msg: `[${this.name.toUpperCase()} CMD]` });
			return hypixelMessage.reply(formatError(error));
		}
	}
}
