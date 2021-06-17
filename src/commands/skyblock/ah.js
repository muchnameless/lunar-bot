'use strict';

const { Constants } = require('discord.js');
const { stripIndents } = require('common-tags');
const ms = require('ms');
const { upperCaseFirstChar } = require('../../functions/util');
const { getUuidAndIgn } = require('../../functions/input');
const hypixel = require('../../api/hypixel');
const SlashCommand = require('../../structures/commands/SlashCommand');
// const logger = require('../../functions/logger');


module.exports = class AhCommand extends SlashCommand {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'SkyBlock acutions',
			options: [{
				name: 'ign',
				type: Constants.ApplicationCommandOptionTypes.STRING,
				description: 'IGN | uuid',
				required: false,
			}],
			defaultPermission: true,
			cooldown: 0,
		});
	}

	/**
	 * 99_137 -> 99K, 1_453_329 -> 1.5M
	 * @param {number} number
	 * @param {number} [decimalPlaces=0]
	 */
	static shortenNumber(number) {
		let str;
		let suffix;

		if (number < 1e3) {
			str = number;
			suffix = '';
		} else if (number < 1e6) {
			str = Math.round(number / 1e3);
			suffix = 'K';
		} else if (number < 1e9) {
			str = Math.round(number / (1e6 / 10)) / 10;
			suffix = 'M';
		} else if (number < 1e12) {
			str = Math.round(number / (1e9 / 10)) / 10;
			suffix = 'B';
		} else if (number < 1e15) {
			str = Math.round(number / (1e12 / 10)) / 10;
			suffix = 'T';
		}

		return `${str}${suffix}`;
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) {
		interaction.defer();

		const { ign, uuid } = await getUuidAndIgn(interaction, interaction.options.get('ign')?.value);
		const auctions = (await hypixel.skyblock.auction.player(uuid))
			.filter(({ claimed }) => !claimed)
			.sort((a, b) => a.end - b.end);
		const embed = this.client.defaultEmbed
			.setAuthor(ign, `https://visage.surgeplay.com/bust/${uuid}`, `https://sky.shiiyu.moe/stats/${ign}`);

		if (!auctions.length) {
			return interaction.reply({
				embeds: [
					embed.setDescription('no unclaimed auctions'),
				],
			});
		}

		let totalCoins = 0;
		let totalUnclaimedCoins = 0;
		let endedAuctions = 0;

		const NOW = Date.now();

		for (const { highest_bid_amount: highestBid, starting_bid: startingBid, bids, end, item_name: item, tier, bin, item_lore: lore } of auctions) {
			const TIME_LEFT = end - NOW;

			embed.addField(
				`${item}${
					item.startsWith('[Lvl ')
						? ` - ${upperCaseFirstChar(tier)}`
						: item === 'Enchanted Book'
							? (() => {
								const matched = lore.match(/(?<=^§[a-f0-9]).+(?=\n)/)?.[0];
								if (matched) return ` - ${matched}`;
								return '';
							})()
							: ''
				}`,
				`${
					bin
						? `BIN: ${AhCommand.shortenNumber(startingBid)}`
						: bids.length
							? (totalCoins += highestBid, `Highest Bid: ${AhCommand.shortenNumber(highestBid)}`)
							: `Starting Bid: ${AhCommand.shortenNumber(startingBid)}`
				} • ${
					TIME_LEFT < 0
						? (++endedAuctions, totalUnclaimedCoins += highestBid, ' ended')
						: ` ends in ${ms(TIME_LEFT, { long: true })}`
				}`,
			);
		}

		totalCoins += totalUnclaimedCoins;

		return interaction.reply({
			embeds: [
				embed.setDescription(stripIndents`
					unclaimed: ${AhCommand.shortenNumber(totalUnclaimedCoins)} coins from ${endedAuctions} auctions
					total: ${AhCommand.shortenNumber(totalCoins)} coins from ${auctions.length} auctions
				`),
			],
		});
	}
};
