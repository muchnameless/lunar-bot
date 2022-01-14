import { SlashCommandBuilder } from '@discordjs/builders';
import { optionalIgnOption, skyblockProfileOption } from '../../structures/commands/commonOptions';
import { seconds, shortenNumber } from '../../functions';
import { getNetworth } from '../../structures/networth/networth';
import { X_EMOJI } from '../../constants';
import NetworthCommand from './networth';
import type { FetchedData } from './~base-skyblock-command';
import type { CommandContext } from '../../structures/commands/BaseCommand';

export default class CoopNetworthCommand extends NetworthCommand {
	constructor(context: CommandContext) {
		super(
			context,
			{
				slash: new SlashCommandBuilder()
					.setDescription("shows a player's coop-networth, algorithm by Maro and SkyHelper")
					.addStringOption(optionalIgnOption)
					.addStringOption(skyblockProfileOption),
				cooldown: seconds(1),
			},
			{
				aliases: ['coopnw'],
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
		const memberUuids = Object.keys(profile.members);

		// use NetworthCommand#_generateReply if no coop
		if (memberUuids.length === 1) return super._generateReply({ ign, uuid, profile });

		let bankingAPIEnabled = true;
		let totalNetworth = profile.banking?.balance ?? ((bankingAPIEnabled = false), 0);
		let everyInventoryAPIEnabled = true;

		for (const { networth, inventoryAPIEnabled } of await Promise.all(
			memberUuids.map((_uuid) => getNetworth(profile, _uuid, false)),
		)) {
			totalNetworth += networth;
			everyInventoryAPIEnabled &&= inventoryAPIEnabled;
		}

		const reply = [`${ign}'s coop (${profile.cute_name}): ${shortenNumber(totalNetworth)}`];
		if (!bankingAPIEnabled) reply.push(`${X_EMOJI} Banking API disabled`);
		if (!everyInventoryAPIEnabled) reply.push(`${X_EMOJI} Inventory API disabled`);

		return reply.join(' | ');
	}
}
