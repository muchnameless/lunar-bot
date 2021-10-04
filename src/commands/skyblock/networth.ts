import { SlashCommandBuilder } from '@discordjs/builders';
import { optionalIgnOption, skyblockProfileOption } from '../../structures/commands/commonOptions';
import { hypixel } from '../../api/hypixel';
import { maro } from '../../api/maro';
import { getMainProfile, getUuidAndIgn, logger, shortenNumber, upperCaseFirstChar } from '../../functions';
import BaseWeightCommand from './~base-weight';
import type { CommandInteraction } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';
import type { HypixelMessage } from '../../structures/chat_bridge/HypixelMessage';
import type { SkyBlockProfile } from '../../functions';
import type { MaroPlayerData } from '../../structures/MaroClient';


export default class NetworthCommand extends BaseWeightCommand {
	constructor(context: CommandContext) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('shows a player\'s networth, provided by maro')
				.addStringOption(optionalIgnOption)
				.addStringOption(skyblockProfileOption),
			cooldown: 1,
		}, {
			aliases: [ 'nw' ],
			args: false,
			usage: '<`IGN`> <`profile` name>',
		});
	}

	/**
	 * @param ctx
	 * @param ignOrUuid command arguments
	 * @param profileName
	 */
	override async _generateReply(ctx: CommandInteraction | HypixelMessage, ignOrUuid?: string | null, profileName?: string | null) {
		try {
			const { uuid, ign } = await getUuidAndIgn(ctx, ignOrUuid);
			const profiles = await hypixel.skyblock.profiles.uuid(uuid) as SkyBlockProfile[];

			if (!profiles?.length) return `\`${ign}\` has no SkyBlock profiles`;

			let profile;

			if (!profileName) {
				profile = getMainProfile(profiles, uuid);
				if (!profile) return `\`${ign}\` has no SkyBlock profiles`;
			} else {
				profile = profiles.find(({ cute_name: name }) => name === profileName);
				if (!profile) return `\`${ign}\` has no profile named '${upperCaseFirstChar(profileName)}'`;
			}

			const playerData: MaroPlayerData = profile.members[uuid];
			playerData.banking = profile.banking;

			const { networth } = await maro.networth(uuid, playerData);

			return `${ign} (${profile.cute_name}): ${shortenNumber(networth)}`;
		} catch (error) {
			logger.error('[NETWORTH]', error);

			return `${error}`;
		}
	}
}
