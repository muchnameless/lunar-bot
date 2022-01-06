import { PROFILE_NAMES } from '../../constants';
import { InteractionUtil } from '../../util';
import { autocorrect, getMainProfile, getUuidAndIgn, logger, seconds, upperCaseFirstChar } from '../../functions';
import { DualCommand } from '../../structures/commands/DualCommand';
import { hypixel } from '../../api';
import type { SkyBlockProfile } from '../../functions';
import type { CommandInteraction } from 'discord.js';
import type { HypixelUserMessage } from '../../structures/chat_bridge/HypixelMessage';

export type FetchedData = Awaited<ReturnType<BaseSkyBlockCommand['_fetchData']>>;

export default class BaseSkyBlockCommand extends DualCommand {
	/**
	 * @param ctx
	 * @param ignOrUuid
	 */
	// eslint-disable-next-line class-methods-use-this
	async _fetchData(
		ctx: CommandInteraction | HypixelUserMessage,
		ignOrUuid: string | null,
		profileName?: string | null,
	) {
		const { uuid, ign } = await getUuidAndIgn(ctx, ignOrUuid);
		const profiles = (await hypixel.skyblock.profiles.uuid(uuid)) as SkyBlockProfile[];

		if (!profiles?.length) throw `\`${ign}\` has no SkyBlock profiles`;

		let profile: SkyBlockProfile | null | undefined;

		if (!profileName) {
			profile = getMainProfile(profiles, uuid);
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
	_generateReply(data: FetchedData): string | Promise<string> {
		throw new Error('not implemented');
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async runSlash(interaction: CommandInteraction) {
		try {
			return InteractionUtil.reply(
				interaction,
				await this._generateReply(
					await this._fetchData(
						interaction,
						interaction.options.getString('ign'),
						interaction.options.getString('profile'),
					),
				),
			);
		} catch (error) {
			logger.error({ err: error, msg: `[${this.name.toUpperCase()} CMD]` });
			return InteractionUtil.reply(interaction, `${error}`);
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
			return hypixelMessage.reply(`${error}`);
		}
	}
}
