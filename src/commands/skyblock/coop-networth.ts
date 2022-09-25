import { SlashCommandBuilder } from 'discord.js';
import NetworthCommand from './networth.js';
import { type FetchedData } from './~base-skyblock-command.js';
import { UnicodeEmoji } from '#constants';
import { shortenNumber } from '#functions';
import { getAuctionNetworth, getNetworth } from '#networth/networth.js';
import { type CommandContext } from '#structures/commands/BaseCommand.js';

export default class CoopNetworthCommand extends NetworthCommand {
	public constructor(context: CommandContext) {
		super(
			context,
			{
				slash: new SlashCommandBuilder().setDescription(
					"shows a player's Co-op's networth, algorithm by Maro and SkyHelper",
				),
			},
			{
				aliases: ['coopnw'],
			},
		);
	}

	/**
	 * data -> reply
	 *
	 * @param data
	 */
	protected override async _generateReply({ ign, uuid, profile }: FetchedData, includeAuctions: boolean) {
		const memberUuids = Object.keys(profile.members);

		// use NetworthCommand#_generateReply if no coop
		if (memberUuids.length === 1) {
			return super._generateReply({ ign: `${ign}'s Co-op`, uuid, profile }, includeAuctions);
		}

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

		const reply = [shortenNumber(totalNetworth)];
		if (!bankingAPIEnabled) reply.push(`${UnicodeEmoji.X} Banking API disabled`);
		if (inventoryAPIDisabled) {
			reply.push(`${UnicodeEmoji.X} ${inventoryAPIDisabled}/${memberUuids.length} Inventory APIs disabled`);
		}

		return { ign: `${ign}'s Co-op`, profile, reply: reply.join(' | ') };
	}
}
