'use strict';

const { stripIndents, commaLists } = require('common-tags');
const { MessageEmbed } = require('discord.js');
const _ = require('lodash');
const { X_EMOJI, Y_EMOJI_ALT } = require('../constants/emojiCharacters');
const { SKILLS, SLAYERS } = require('../constants/skyblock');
const { checkBotPermissions } = require('./util');
const hypixel = require('../api/hypixel');
// const LunarClient = require('../structures/LunarClient');
const logger = require('./logger');


/**
 * updates the tax database
 * @param {LunarClient} client
 * @returns {Promise<string[]>}
 */
async function updateTaxDatabase(client) {
	const { config, players, taxCollectors } = client;
	const TAX_AUCTIONS_START_TIME = config.getNumber('TAX_AUCTIONS_START_TIME');
	const TAX_AMOUNT = config.getNumber('TAX_AMOUNT');
	const TAX_AUCTIONS_ITEMS = config.getArray('TAX_AUCTIONS_ITEMS');
	const NOW = Date.now();
	const ignoredAuctions = players.ignoredAuctions;
	const availableAuctionsLog = [];
	const loggingEmbed = new MessageEmbed()
		.setColor(config.get('EMBED_BLUE'))
		.setTitle('Guild Tax')
		.setTimestamp();

	let auctionsAmount = 0;
	let unknownPlayers = 0;

	// update db
	await Promise.all(taxCollectors
		.filter(taxCollector => taxCollector.isCollecting)
		.map(async taxCollector => {
			const auctions = await hypixel.skyblock.auction.player(taxCollector.minecraftUUID).catch(error => logger.error(`[UPDATE TAX DB]: ${taxCollector.ign}: ${error.name}${error.code ? ` ${error.code}` : ''}: ${error.message}`));

			if (!auctions) return availableAuctionsLog.push(`\u200b > ${taxCollector.ign}: API Error`);

			const taxAuctions = [];
			const paidLog = [];

			let availableAuctions = 0;

			auctions
				.filter(auction => TAX_AUCTIONS_ITEMS.includes(auction.item_name) && !ignoredAuctions.includes(auction.uuid) && auction.start >= TAX_AUCTIONS_START_TIME) // correct item & no outbid & started after last reset
				.forEach(auction => auction.highest_bid_amount >= TAX_AMOUNT
					? auction.bids.length && taxAuctions.push(auction)
					: auction.end > NOW && ++availableAuctions,
				);

			availableAuctionsLog.push(`\u200b > ${taxCollector.ign}: ${availableAuctions}`);

			if (auctions.meta.cached) return logger.info(`[UPDATE TAX DB]: ${taxCollector.ign}: cached data`);

			auctionsAmount += taxAuctions.length;

			taxAuctions.forEach(auction => {
				const { bidder, amount } = auction.bids[auction.bids.length - 1];
				const player = players.get(bidder);

				if (!player) return ++unknownPlayers;

				paidLog.push(`${player.ign}: ${amount.toLocaleString(config.get('NUMBER_FORMAT'))}`);
				if (config.getBoolean('EXTENDED_LOGGING')) logger.info(`[UPDATE TAX DB]: ${player.ign} [uuid: ${bidder}] paid ${amount.toLocaleString(config.get('NUMBER_FORMAT'))} at /ah ${taxCollector.ign} [auctionID: ${auction.uuid}]`);

				player.setToPaid({
					amount,
					collectedBy: taxCollector.minecraftUUID,
					auctionID: auction.uuid,
					shouldAdd: true,
				});
			});

			if (!paidLog.length) return;

			loggingEmbed.addField(`/ah ${taxCollector.ign}`, `\`\`\`\n${paidLog.join('\n')}\`\`\``);
		}),
	).catch(error => logger.error(`[UPDATE TAX DB]: ${error.name}: ${error.message}`));

	// logging
	if (auctionsAmount && (config.getBoolean('EXTENDED_LOGGING') || (unknownPlayers && new Date().getMinutes() < client.config.getNumber('DATABASE_UPDATE_INTERVAL')))) logger.info(`[UPDATE TAX DB]: New auctions: ${auctionsAmount}, unknown players: ${unknownPlayers}`);
	if (loggingEmbed.fields.length) client.log(loggingEmbed);

	return availableAuctionsLog
		.sort((a, b) => a.split(':')[0].toLowerCase().localeCompare(b.split(':')[0].toLowerCase())) // alphabetically
		.sort((a, b) => Number(b.split(':')[1]) - Number(a.split(':')[1])); // number of auctions
}


const self = module.exports = {

	/**
	 * returns an array with the member's roles that the bot manages
	 * @param {GuildMember} member discord member to analyze
	 * @returns {string[]}
	 */
	getRolesToPurge: member => {
		const { config, hypixelGuilds } = member.client;
		const rolesToRemove = [];

		[
			config.get('GUILD_DELIMITER_ROLE_ID'),
			...hypixelGuilds.array().flatMap(hGuild => hGuild.ranks.map(rank => rank.roleID)),
			config.get('GUILD_ROLE_ID'),
			...hypixelGuilds.map(hGuild => hGuild.roleID),
			config.get('SKILL_DELIMITER_ROLE_ID'),
			config.get('AVERAGE_LVL_50_ROLE_ID'), config.get('AVERAGE_LVL_45_ROLE_ID'), config.get('AVERAGE_LVL_40_ROLE_ID'),
			config.get('SLAYER_DELIMITER_ROLE_ID'),
			config.get('SLAYER_999_ROLE_ID'), config.get('SLAYER_888_ROLE_ID'), config.get('SLAYER_777_ROLE_ID'),
			config.get('DUNGEON_DELIMITER_ROLE_ID'),
			config.get('CATACOMBS_35_ROLE_ID'), config.get('CATACOMBS_30_ROLE_ID'), config.get('CATACOMBS_25_ROLE_ID'), config.get('CATACOMBS_20_ROLE_ID'),
			config.get('MISC_DELIMITER_ROLE_ID'),
		].forEach(roleID => member.roles.cache.has(roleID) && rolesToRemove.push(roleID));

		SKILLS.forEach(skill => {
			if (member.roles.cache.has(config.get(`${skill}_60_ROLE_ID`))) rolesToRemove.push(config.get(`${skill}_60_ROLE_ID`));
			if (member.roles.cache.has(config.get(`${skill}_55_ROLE_ID`))) rolesToRemove.push(config.get(`${skill}_55_ROLE_ID`));
			if (member.roles.cache.has(config.get(`${skill}_50_ROLE_ID`))) rolesToRemove.push(config.get(`${skill}_50_ROLE_ID`));
			if (member.roles.cache.has(config.get(`${skill}_45_ROLE_ID`))) rolesToRemove.push(config.get(`${skill}_45_ROLE_ID`));
		});

		SLAYERS.forEach(slayer => {
			if (member.roles.cache.has(config.get(`${slayer}_9_ROLE_ID`))) rolesToRemove.push(config.get(`${slayer}_9_ROLE_ID`));
			if (member.roles.cache.has(config.get(`${slayer}_8_ROLE_ID`))) rolesToRemove.push(config.get(`${slayer}_8_ROLE_ID`));
		});

		return rolesToRemove;
	},

	/**
	 * tries to find a discord member by a discord tag
	 * @param {LunarClient} client
	 * @param {string} tag
	 */
	findMemberByTag: async (client, tag) => {
		const lgGuild = client.lgGuild;

		if (!lgGuild) return null;

		const discordMember = lgGuild.members.cache.find(member => member.user.tag === tag);

		if (discordMember) return discordMember;

		const fetched = await lgGuild.members.fetch({ query: tag.split('#')[0] }).catch(error => logger.error(`[UPDATE GUILD PLAYERS]: ${error.name}: ${error.message}`));

		return fetched?.find(member => member.user.tag === tag) ?? null;
	},

	/**
	 * creates and returns a tax embed
	 * @param {LunarClient} client
	 * @param {string[]} availableAuctionsLog
	 */
	createTaxEmbed: (client, availableAuctionsLog) => {
		const { config, players, taxCollectors } = client;
		const activeTaxCollectors = taxCollectors.filter(taxCollector => taxCollector.isCollecting); // eslint-disable-line no-shadow
		const PLAYER_COUNT = players.size;
		const PAID_COUNT = players.filter(player => player.paid).size;
		const TOTAL_COINS = taxCollectors.reduce((acc, taxCollector) => acc + taxCollector.collectedAmount, 0);
		const taxEmbed = new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
			.setTitle('Guild Tax')
			.setDescription(stripIndents(commaLists`
				\`\`\`cs
				Collectors: # /ah ${activeTaxCollectors.map(player => player.ign)}
				Amount: ${config.getNumber('TAX_AMOUNT').toLocaleString(config.get('NUMBER_FORMAT'))}
				Items: ${config.getArray('TAX_AUCTIONS_ITEMS').map(item => `'${item}'`)}
				Paid: ${PAID_COUNT} / ${PLAYER_COUNT} | ${Math.round((PAID_COUNT / PLAYER_COUNT) * 100)} % | collected amount: ${TOTAL_COINS.toLocaleString(config.get('NUMBER_FORMAT'))} coins
				${availableAuctionsLog ? `\nAvailable auctions:\n${availableAuctionsLog.join('\n')}` : ''}
				\`\`\`
			`))
			.setFooter('Last updated at')
			.setTimestamp();

		// add guild specific fields
		client.hypixelGuilds.forEach(hypixelGuild => {
			const GUILD_PLAYER_COUNT = hypixelGuild.playerCount;
			const ENTRIES_PER_ROW = Math.ceil(GUILD_PLAYER_COUNT / 3);
			const values = [ '', '', '' ];

			let index = -1;

			// construct player list in three rows: paid emoji + non line-breaking space + player ign, slice to keep everything in one line
			if (config.getBoolean('TAX_TRACKING_ENABLED')) {
				hypixelGuild.players.forEach(player => values[Math.floor(++index / ENTRIES_PER_ROW)] += `\n${player.paid ? Y_EMOJI_ALT : X_EMOJI}\xa0${player.ign.slice(0, 15)}`);
			} else {
				hypixelGuild.players.forEach(player => values[Math.floor(++index / ENTRIES_PER_ROW)] += `\n•\xa0${player.ign.slice(0, 15)}`);
			}

			// add rows to tax embed
			values.forEach((value, fieldIndex) => {
				// fill up with empty lines if rows have different size
				for (let emptyLine = ENTRIES_PER_ROW - (value.match(/\n/g)?.length ?? 0) + 1; --emptyLine;) {
					value += '\n\u200b';
				}

				taxEmbed.addField(
					fieldIndex % 2
						? `${hypixelGuild.name} (${GUILD_PLAYER_COUNT})`
						: '\u200b',
					`\`\`\`\n${value}\`\`\``, // put everything in a code block
					true,
				);
			});
		});

		return taxEmbed;
	},

	/**
	 * updates the player database and the corresponding tax message
	 * @param {LunarClient} client
	 */
	updatePlayerDatabase: async client => {
		const { config } = client;

		// update player db
		await client.hypixelGuilds.update();

		// update tax db
		const availableAuctionsLog = config.getBoolean('TAX_TRACKING_ENABLED') && await updateTaxDatabase(client);

		// update Xp
		if (config.getBoolean('XP_TRACKING_ENABLED')) client.players.update();

		// update taxMessage
		const taxChannel = client.channels.cache.get(config.get('TAX_CHANNEL_ID'));

		if (!taxChannel?.guild?.available) return logger.warn('[TAX MESSAGE]: channel not found');
		if (!checkBotPermissions(taxChannel, ['VIEW_CHANNEL', 'SEND_MESSAGES', 'EMBED_LINKS'])) return logger.warn('[TAX MESSAGE]: missing permission to edit taxMessage');

		const taxEmbed = self.createTaxEmbed(client, availableAuctionsLog);

		let taxMessage = await taxChannel.messages.fetch(config.get('TAX_MESSAGE_ID')).catch(error => logger.error(`[TAX MESSAGE]: ${error.name}: ${error.message}`));

		if (!taxMessage || taxMessage.deleted) { // taxMessage deleted
			taxMessage = await taxChannel.send(taxEmbed).catch(error => logger.error(`[TAX MESSAGE]: ${error.name}: ${error.message}`));

			if (!taxMessage) return; // failed to retreive old and send new taxMessage

			config.set('TAX_MESSAGE_ID', taxMessage.id);
			return logger.info('[TAX MESSAGE]: created new taxMessage');
		}
		if (taxMessage.embeds[0]?.description === taxEmbed.description && _.isEqual(taxMessage.embeds[0].fields, taxEmbed.fields)) return; // no changes to taxMessage

		const { content } = taxMessage;

		taxMessage.edit(content, taxEmbed).then(
			() => logger.info('[TAX MESSAGE]: updated taxMessage'),
			error => logger.error(`[TAX MESSAGE]: ${error.name}: ${error.message}`),
		);
	},

};
