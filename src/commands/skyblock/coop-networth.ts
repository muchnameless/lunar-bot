import { SlashCommandBuilder } from 'discord.js';
import { getAuctionNetworth, getNetworth } from '#networth/networth';
import { includeAuctionsOption } from '#structures/commands/commonOptions';
import { UnicodeEmoji } from '#constants';
import { seconds, shortenNumber } from '#functions';
import NetworthCommand from './networth';
import type { FetchedData } from './~base-skyblock-command';
import type { CommandContext } from '#structures/commands/BaseCommand';

export default class CoopNetworthCommand extends NetworthCommand {
	constructor(context: CommandContext) {
		super(
			context,
			{
				slash: new SlashCommandBuilder().setDescription(
					"shows a player's Co-op's networth, algorithm by Maro and SkyHelper",
				),
				additionalOptions: [includeAuctionsOption],
				cooldown: seconds(1),
			},
			{
				aliases: ['coopnw'],
			},
		);
	}

	/**
	 * data -> reply
	 * @param data
	 */
	override async _generateReply({ ign, uuid, profile }: FetchedData, includeAuctions: boolean) {
		const memberUuids = Object.keys(profile.members);

		// use NetworthCommand#_generateReply if no coop
		if (memberUuids.length === 1) return super._generateReply({ ign, uuid, profile }, includeAuctions);

		let bankingAPIEnabled = true;
		let totalNetworth = profile.banking?.balance ?? ((bankingAPIEnabled = false), 0);
		let inventoryAPIDisabled = 0;

		if (includeAuctions) {
			totalNetworth += await getAuctionNetworth(profile.profile_id);
		}

		for (const { networth, inventoryAPIEnabled } of await Promise.all(
			memberUuids.map((_uuid) => getNetworth(profile, _uuid, { addBanking: false })),
		)) {
			totalNetworth += networth;
			if (!inventoryAPIEnabled) ++inventoryAPIDisabled;
		}

		const reply = [`${ign}'s Co-op (${profile.cute_name}): ${shortenNumber(totalNetworth)}`];
		if (!bankingAPIEnabled) reply.push(`${UnicodeEmoji.X} Banking API disabled`);
		if (inventoryAPIDisabled) {
			reply.push(`${UnicodeEmoji.X} ${inventoryAPIDisabled}/${memberUuids.length} Inventory APIs disabled`);
		}

		return reply.join(' | ');
	}
}
