import { SlashCommandBuilder } from '@discordjs/builders';
import { optionalIgnOption, skyblockProfileOption } from '../../structures/commands/commonOptions';
import { seconds, shortenNumber } from '../../functions';
import { getNetworth } from '../../structures/networth/networth';
import { X_EMOJI } from '../../constants';
import BaseSkyBlockCommand, { type FetchedData } from './~base-skyblock-command';
import type { BridgeCommandData } from '../../structures/commands/BridgeCommand';
import type { ApplicationCommandData } from '../../structures/commands/ApplicationCommand';
import type { CommandContext } from '../../structures/commands/BaseCommand';

export default class NetworthCommand extends BaseSkyBlockCommand {
	constructor(context: CommandContext, slashData?: ApplicationCommandData, bridgeData?: BridgeCommandData) {
		super(
			context,
			slashData ?? {
				slash: new SlashCommandBuilder()
					.setDescription("shows a player's networth, algorithm by Maro and SkyHelper")
					.addStringOption(optionalIgnOption)
					.addStringOption(skyblockProfileOption),
				cooldown: seconds(1),
			},
			bridgeData ?? {
				aliases: ['nw'],
				args: false,
				usage: '<`IGN`> <`profile` name>',
			},
		);
	}

	/**
	 * data -> reply
	 * @param data
	 */
	override async _generateReply({ ign, uuid, profile }: FetchedData) {
		const { networth, bankingAPIEnabled, inventoryAPIEnabled } = await getNetworth(profile, uuid);

		const reply = [`${ign} (${profile.cute_name}): ${shortenNumber(networth)}`];
		if (!bankingAPIEnabled) reply.push(`${X_EMOJI} Banking API disabled`);
		if (!inventoryAPIEnabled) reply.push(`${X_EMOJI} Inventory API disabled`);

		return reply.join(' | ');
	}
}
