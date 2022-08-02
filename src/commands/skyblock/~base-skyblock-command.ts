import { type Components } from '@zikeji/hypixel';
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	InteractionType,
	ModalBuilder,
	SelectMenuOptionBuilder,
	StringSelectMenuBuilder,
	TextInputBuilder,
	TextInputStyle,
	type Awaitable,
	type ButtonInteraction,
	type ChatInputCommandInteraction,
	type MessageActionRowComponentBuilder,
	type ModalActionRowComponentBuilder,
	type ModalSubmitInteraction,
	type SlashCommandBuilder,
	type Snowflake,
} from 'discord.js';
import { getSkyBlockProfiles } from '#api';
import { type HypixelUserMessage, type ParseArgsConfigOptions } from '#chatBridge/HypixelMessage.js';
import {
	FindProfileStrategy,
	MAX_IGN_INPUT_LENGTH,
	NON_LETTER_REGEXP,
	PROFILE_EMOJIS,
	PROFILE_NAMES,
	UnicodeEmoji,
} from '#constants';
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
import { InteractionUtil, type ModalRepliableInteraction, type RepliableInteraction } from '#utils';

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
	 * @param profileName
	 * @param findProfileStrategy
	 */
	protected async _fetchData(
		ctx: HypixelUserMessage | RepliableInteraction,
		ignOrUuid: string | null | undefined,
		profileName: string | null | undefined,
		findProfileStrategy?: FindProfileStrategy | null,
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
	 * @param userId
	 * @param subcommand
	 * @param ign
	 * @param profile
	 */
	protected _generateCustomId(userId: Snowflake, subcommand: string, ign?: string | null, profile?: string | null) {
		return `${this.baseCustomId}:${subcommand}:${ign ?? ''}:${profile ?? ''}:${userId}` as const;
	}

	/**
	 * @param customId
	 * @param ign
	 * @param profile
	 */
	private _buildEditModal(customId: string, ign?: string | null, profile?: string | null) {
		return new ModalBuilder()
			.setTitle(this.name)
			.setCustomId(customId)
			.addComponents([
				new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents([
					new TextInputBuilder()
						.setCustomId('ign')
						.setStyle(TextInputStyle.Short)
						.setLabel('IGN')
						// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
						.setValue(ign || 'IGN')
						// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
						.setPlaceholder(ign || 'IGN')
						.setMaxLength(MAX_IGN_INPUT_LENGTH)
						.setRequired(false),
				]),
				new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
					// @ts-expect-error select in modal
					new StringSelectMenuBuilder()
						.setCustomId('profile')
						.setPlaceholder('Profile')
						.addOptions(
							PROFILE_NAMES.map((name) =>
								new SelectMenuOptionBuilder()
									.setLabel(`${PROFILE_EMOJIS[name]} ${name}`)
									.setValue(name)
									.setDefault(name === profile),
							),
						)
						.setMinValues(0),
				),
			]);
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 * @param args parsed customId, split by ':'
	 */
	public override buttonRun(interaction: ButtonInteraction<'cachedOrDM'>, args: string[]) {
		const [subcommand, ign, profile] = args;

		switch (subcommand) {
			case 'edit': {
				return InteractionUtil.showModal(interaction, this._buildEditModal(interaction.customId, ign, profile));
			}

			default:
				throw new Error(`unknown subcommand '${subcommand}'`);
		}
	}

	/**
	 * @param interaction
	 * @param ign
	 * @param profile
	 * @param findProfileStrategy
	 */
	private async _sharedRun(
		interaction: RepliableInteraction,
		ign?: string | null,
		profile?: string | null,
		findProfileStrategy?: FindProfileStrategy | null,
	) {
		try {
			return InteractionUtil.reply(
				interaction,
				this._finalizeReply(
					await this._generateReply(await this._fetchData(interaction, ign, profile, findProfileStrategy)),
				),
			);
		} catch (error) {
			logger.error({ err: error, msg: `[${this.name.toUpperCase()} CMD]` });

			if (interaction.type === InteractionType.ModalSubmit) {
				return this._replyWithError(interaction, error, ign, profile);
			}

			try {
				// eslint-disable-next-line @typescript-eslint/return-await
				return await InteractionUtil.showModal(
					interaction as ModalRepliableInteraction,
					this._buildEditModal('edit', ign, profile),
				);
			} catch (_error) {
				logger.error({ err: _error, msg: `[${this.name.toUpperCase()} CMD]` });

				return this._replyWithError(interaction, error, ign, profile);
			}
		}
	}

	/**
	 * @param interaction
	 * @param error
	 * @param ign
	 * @param profile
	 */
	private _replyWithError(
		interaction: RepliableInteraction,
		error: unknown,
		ign?: string | null,
		profile?: string | null,
	) {
		return InteractionUtil.reply(interaction, {
			content: formatError(error),
			components: [
				new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents([
					new ButtonBuilder()
						.setCustomId(this._generateCustomId(interaction.user.id, 'edit', ign, profile))
						.setEmoji({ name: UnicodeEmoji.EditMessage })
						.setStyle(ButtonStyle.Secondary),
				]),
			],
		});
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 * @param args parsed customId, split by ':'
	 */
	public override async modalSubmitRun(interaction: ModalSubmitInteraction<'cachedOrDM'>, args: string[]) {
		const [subcommand] = args;

		switch (subcommand) {
			case 'edit':
				return this._sharedRun(
					interaction,
					interaction.fields.getTextInputValue('ign'),
					interaction.fields.getSelectMenuValues('profile')[0],
				);

			default:
				throw new Error(`unknown subcommand '${subcommand}'`);
		}
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 */
	public override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		return this._sharedRun(
			interaction,
			interaction.options.getString('ign'),
			interaction.options.getString('profile'),
			interaction.options.getString(skyblockFindProfileOptionName) as FindProfileStrategy | null,
		);
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
