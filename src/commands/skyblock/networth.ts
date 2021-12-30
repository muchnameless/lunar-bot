import { SlashCommandBuilder } from '@discordjs/builders';
import { optionalIgnOption, skyblockProfileOption } from '../../structures/commands/commonOptions';
import { hypixel } from '../../api';
import {
	escapeIgn,
	getMainProfile,
	getUuidAndIgn,
	logger,
	seconds,
	shortenNumber,
	upperCaseFirstChar,
} from '../../functions';
import { getNetworth } from '../../structures/networth/networth';
import { X_EMOJI } from '../../constants';
import BaseWeightCommand from './~base-weight';
import type { CommandInteraction } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';
import type { HypixelUserMessage } from '../../structures/chat_bridge/HypixelMessage';
import type { SkyBlockProfile } from '../../functions';

export default class NetworthCommand extends BaseWeightCommand {
	constructor(context: CommandContext) {
		super(
			context,
			{
				slash: new SlashCommandBuilder()
					.setDescription("shows a player's networth, provided by maro")
					.addStringOption(optionalIgnOption)
					.addStringOption(skyblockProfileOption),
				cooldown: seconds(1),
			},
			{
				aliases: ['nw'],
				args: false,
				usage: '<`IGN`> <`profile` name>',
			},
		);
	}

	/**
	 * @param ctx
	 * @param ignOrUuid command arguments
	 * @param profileName
	 */
	override async _generateReply(
		ctx: CommandInteraction | HypixelUserMessage,
		ignOrUuid?: string | null,
		profileName?: string | null,
	) {
		try {
			const { uuid, ign } = await getUuidAndIgn(ctx, ignOrUuid);
			const profiles = (await hypixel.skyblock.profiles.uuid(uuid)) as SkyBlockProfile[];

			if (!profiles?.length) return `\`${ign}\` has no SkyBlock profiles`;

			let profile: SkyBlockProfile | null | undefined;

			if (!profileName) {
				profile = getMainProfile(profiles, uuid);
				if (!profile) return `\`${ign}\` has no SkyBlock profiles`;
			} else {
				profile = profiles.find(({ cute_name: name }) => name === profileName);
				if (!profile) return `\`${ign}\` has no profile named '${upperCaseFirstChar(profileName)}'`;
			}

			const { networth, bankingAPIEnabled, inventoryAPIEnabled } = await getNetworth(profile, uuid);

			const reply = [`${escapeIgn(ign)} (${profile.cute_name}): ${shortenNumber(networth)}`];
			if (!bankingAPIEnabled) reply.push(`${X_EMOJI} Banking API disabled`);
			if (!inventoryAPIEnabled) reply.push(`${X_EMOJI} Inventory API disabled`);

			return reply.join(' | ');
		} catch (error) {
			logger.error(error, '[NETWORTH]');

			return `${error}`;
		}
	}
}
