'use strict';

const { MessageEmbed } = require('discord.js');
const { Item } = require('../../database/models/index');
const { DA_ITEMS } = require('../constants/skyblock');
const { checkBotPermissions } = require('./util');
const hypixel = require('../api/hypixelAux2');
const logger = require('./logger');


module.exports = async function(client) {
	logger.info('[UPDATE DA PRICES]: update started');

	// determine lbins
	const DA_PRICES = Object.fromEntries(DA_ITEMS.map(item => [ item, Infinity ]));
	const MIDAS_PRICE_PAID_REGEX = /(?<=Price paid: §6).+(?= Coins\n)/;

	let page = 0;
	let totalPages = 0;
	let binAuctionsAmount = 0;

	do {
		const currentPage = await hypixel.skyblock.auctions.page(page).catch(error => logger.error(`[UPDATE DA PRICES]: ${error.name}${error.code ? ` ${error.code}` : ''}: ${error.message}`));
		if (!currentPage) break;

		const NOW = Date.now();
		const binAuctions = currentPage.auctions.filter(auction => auction.bin && !auction.highest_bid_amount && auction.end > NOW);

		for (const auction of binAuctions) {
			switch (true) {
				case auction.item_name.includes('Midas\' Sword'):
					if (auction.starting_bid < DA_PRICES['Midas\' Sword']) DA_PRICES['Midas\' Sword'] = auction.starting_bid;
					if (auction.starting_bid < DA_PRICES['Midas\' Sword [50M]'] && auction.item_lore.match(MIDAS_PRICE_PAID_REGEX)?.[0].replace(/\D/g, '') >= 50 * 1000 * 1000) DA_PRICES['Midas\' Sword [50M]'] = auction.starting_bid;
					break;

				case auction.item_name.includes('Spirit Mask'):
					if (auction.starting_bid < DA_PRICES['Spirit Mask']) DA_PRICES['Spirit Mask'] = auction.starting_bid;
					break;

				case auction.item_name.includes('Ender Artifact'):
					if (auction.starting_bid < DA_PRICES['Ender Artifact']) DA_PRICES['Ender Artifact'] = auction.starting_bid;
					break;

				case auction.item_name.includes('Wither Artifact'):
					if (auction.starting_bid < DA_PRICES['Wither Artifact']) DA_PRICES['Wither Artifact'] = auction.starting_bid;
					break;

				case auction.item_name.includes('Parrot'):
					switch (auction.tier) {
						case 'EPIC':
							if (auction.starting_bid < DA_PRICES['Parrot Pet [Epic]']) DA_PRICES['Parrot Pet [Epic]'] = auction.starting_bid;
							break;

						case 'LEGENDARY':
							if (auction.starting_bid < DA_PRICES['Parrot Pet [Legendary]']) DA_PRICES['Parrot Pet [Legendary]'] = auction.starting_bid;
							break;
					}
					break;

				case auction.item_name.includes('Turtle'):
					switch (auction.tier) {
						case 'EPIC':
							if (auction.starting_bid < DA_PRICES['Turtle Pet [Epic]']) DA_PRICES['Turtle Pet [Epic]'] = auction.starting_bid;
							break;

						case 'LEGENDARY':
							if (auction.starting_bid < DA_PRICES['Turtle Pet [Legendary]']) DA_PRICES['Turtle Pet [Legendary]'] = auction.starting_bid;
							break;
					}
					break;

				case auction.item_name.includes('Jellyfish'):
					switch (auction.tier) {
						case 'EPIC':
							if (auction.starting_bid < DA_PRICES['Jellyfish Pet [Epic]']) DA_PRICES['Jellyfish Pet [Epic]'] = auction.starting_bid;
							break;

						case 'LEGENDARY':
							if (auction.starting_bid < DA_PRICES['Jellyfish Pet [Legendary]']) DA_PRICES['Jellyfish Pet [Legendary]'] = auction.starting_bid;
							break;
					}
					break;

				case auction.item_name.includes('Travel Scroll to Dark Auction'):
					if (auction.starting_bid < DA_PRICES['Travel Scroll']) DA_PRICES['Travel Scroll'] = auction.starting_bid;
					break;

				case auction.item_name.includes('Enchanted Book'): {
					switch (true) {
						case auction.item_lore.includes('Sharpness VI\n'):
							if (auction.starting_bid < DA_PRICES['Sharpness 6']) DA_PRICES['Sharpness 6'] = auction.starting_bid;
							break;

						case auction.item_lore.includes('Giant Killer VI\n'):
							if (auction.starting_bid < DA_PRICES['Giant Killer 6']) DA_PRICES['Giant Killer 6'] = auction.starting_bid;
							break;

						case auction.item_lore.includes('Protection VI\n'):
							if (auction.starting_bid < DA_PRICES['Protection 6']) DA_PRICES['Protection 6'] = auction.starting_bid;
							break;

						case auction.item_lore.includes('Growth VI\n'):
							if (auction.starting_bid < DA_PRICES['Growth 6']) DA_PRICES['Growth 6'] = auction.starting_bid;
							break;

						case auction.item_lore.includes('Power VI\n'):
							if (auction.starting_bid < DA_PRICES['Power 6']) DA_PRICES['Power 6'] = auction.starting_bid;
							break;
					}
				}
			}
		}

		binAuctionsAmount += binAuctions.length;
		totalPages = currentPage.totalPages;
	} while (++page <= totalPages);

	// update db
	await Promise.all(Object.entries(DA_PRICES).map(async ([name, lowestBin]) => isFinite(lowestBin) && Item.upsert({ name, lowestBin })));

	// post message
	const { config } = client;
	const DA_PRICES_CHANNEL = client.channels.cache.get(config.get('DA_PRICES_CHANNEL_ID'));

	if (!DA_PRICES_CHANNEL?.guild?.available) return logger.warn('[UPDATE DA PRICES]: unknown channel');
	if (!checkBotPermissions(DA_PRICES_CHANNEL, [ 'VIEW_CHANNEL', 'SEND_MESSAGES', 'EMBED_LINKS' ])) return logger.warn('[UPDATE DA PRICES]: missing perms for DA prices channel');

	await DA_PRICES_CHANNEL
		.send(new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
			.setTitle('DA Prices - Lowest Bin')
			.setDescription((await Item.findAll()).sort((a, b) => a.dataValues.name.toLowerCase().localeCompare(b.dataValues.name.toLowerCase())).map(item => `${item.name}: ${item.lowestBin.toLocaleString(config.get('NUMBER_FORMAT'))}`).join('\n'))
			.setFooter(`fetched ${binAuctionsAmount.toLocaleString(config.get('NUMBER_FORMAT'))} bin auctions`)
			.setTimestamp(),
		)
		.catch(error => logger.error(`[UPDATE DA PRICES]: ${error.name}: ${error.message}`));

	logger.info(`[UPDATE DA PRICES]: update complete (fetched ${binAuctionsAmount.toLocaleString(config.get('NUMBER_FORMAT'))} bin auctions)`);
};
