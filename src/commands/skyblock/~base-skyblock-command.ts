import { PROFILE_NAMES } from '../../constants';
import { InteractionUtil } from '../../util';
import {
	autocorrect,
	formatError,
	findSkyblockProfile,
	getUuidAndIgn,
	logger,
	seconds,
	upperCaseFirstChar,
} from '../../functions';
import { DualCommand } from '../../structures/commands/DualCommand';
import { hypixel } from '../../api';
import {
	optionalIgnOption,
	skyblockFindProfileOption,
	skyblockFindProfileOptionName,
	skyblockProfileOption,
} from '../../structures/commands/commonOptions';
import type { FindProfileStrategy } from '../../constants';
import type { SkyBlockProfile } from '../../functions';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { HypixelUserMessage } from '../../structures/chat_bridge/HypixelMessage';
import type { CommandContext } from '../../structures/commands/BaseCommand';
import type { BridgeCommandData } from '../../structures/commands/BridgeCommand';
import type { ApplicationCommandData, SlashCommandOption } from '../../structures/commands/ApplicationCommand';
import type { SlashCommandBuilder } from '@discordjs/builders';

export type FetchedData = Awaited<ReturnType<BaseSkyBlockCommand['_fetchData']>>;

export type BaseSkyBlockSlashData = ApplicationCommandData & { additionalOptions?: SlashCommandOption[] };

export default class BaseSkyBlockCommand extends DualCommand {
	constructor(
		context: CommandContext,
		{ additionalOptions, ...slashData }: BaseSkyBlockSlashData,
		bridgeData: BridgeCommandData,
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

		bridgeData.args ??= false;
		bridgeData.usage ??= '<`IGN`> <`profile` name>';

		super(context, slashData, bridgeData);
	}

	/**
	 * @param ctx
	 * @param ignOrUuid
	 */
	// eslint-disable-next-line class-methods-use-this
	protected async _fetchData(
		ctx: ChatInputCommandInteraction | HypixelUserMessage,
		ignOrUuid: string | null,
		profileName?: string | null,
		findProfileStrategy?: FindProfileStrategy | null,
	) {
		const { uuid, ign } = await getUuidAndIgn(ctx, ignOrUuid);
		const profiles = (await hypixel.skyblock.profiles.uuid(uuid)) as SkyBlockProfile[];

		if (!profiles?.length) throw `\`${ign}\` has no SkyBlock profiles`;

		let profile: SkyBlockProfile | null | undefined;

		if (!profileName) {
			profile = findSkyblockProfile(profiles, uuid, findProfileStrategy);
			if (!profile) throw `\`${ign}\` has no SkyBlock profiles`;
		} else {
			profile = profiles.find(({ cute_name: name }) => name === profileName);
			if (!profile) throw `\`${ign}\` has no profile named '${upperCaseFirstChar(profileName)}'`;
		}

		return {
			ign,
			uuid,
			profile,
		};
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
	override async runMinecraft(hypixelMessage: HypixelUserMessage) {
		const [IGN, PROFILE_NAME_INPUT] = hypixelMessage.commandData.args;

		let profileName = PROFILE_NAME_INPUT?.replace(/\W/g, '');

		if (profileName) {
			let similarity: number;

			({ value: profileName, similarity } = autocorrect(profileName, PROFILE_NAMES));

			if (similarity < this.config.get('AUTOCORRECT_THRESHOLD')) {
				try {
					await hypixelMessage.awaitConfirmation({
						question: `'${upperCaseFirstChar(
							PROFILE_NAME_INPUT,
						)}' is not a valid SkyBlock profile name, did you mean '${profileName}'?`,
						time: seconds(30),
					});
				} catch (error) {
					return logger.error({ err: error, msg: `[${this.name.toUpperCase()} CMD]` });
				}
			}
		}

		try {
			return hypixelMessage.reply(await this._generateReply(await this._fetchData(hypixelMessage, IGN, profileName)));
		} catch (error) {
			logger.error({ err: error, msg: `[${this.name.toUpperCase()} CMD]` });
			return hypixelMessage.reply(formatError(error));
		}
	}
}
