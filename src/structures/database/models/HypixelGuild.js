'use strict';

const { Model } = require('sequelize');
const { MessageEmbed, Util } = require('discord.js');
const ms = require('ms');
const { autocorrect, getHypixelClient } = require('../../../functions/util');
const { Y_EMOJI, Y_EMOJI_ALT, X_EMOJI, CLOWN, MUTED } = require('../../../constants/emojiCharacters');
const { offsetFlags, UNKNOWN_IGN } = require('../../../constants/database');
const hypixel = require('../../../api/hypixel');
const mojang = require('../../../api/mojang');
const logger = require('../../../functions/logger');

/**
 * @typedef {object} GuildRank
 * @property {string} name name of the guild rank
 * @property {?string} roleID discord role ID associated with the guild rank
 * @property {number} priority hypixel guild rank priority
 * @property {?number} weightReq weight requirement for the guild rank
 */


class HypixelGuild extends Model {
	constructor(...args) {
		super(...args);

		/**
		 * @type {import('discord.js').Collection<string, import('./Player')>}
		 */
		this._players = null;
		/**
		 * @type {import('../../chat_bridge/ChatBridge')}
		 */
		this.chatBridge = null;
		/**
		 * @type {import('../../LunarClient')}
		 */
		this.client;
		/**
		 * @type {string}
		 */
		this.guildID;
		/**
		 * @type {string}
		 */
		this.roleID;
		/**
		 * @type {string}
		 */
		this.name;
		/**
		 * @type {number}
		 */
		this.weightReq;
		/**
		 * @type {boolean}
		 */
		this.chatBridgeEnabled;
		/**
		 * @type {number}
		 */
		this.chatMutedUntil;
		/**
		 * @type {string}
		 */
		this.chatBridgeChannelID;
		/**
		 * @type {string}
		 */
		this.rankRequestChannelID;
		/**
		 * @type {GuildRank[]}
		 */
		this.ranks;
	}

	/**
	 * Helper method for defining associations.
	 * This method is not a part of Sequelize lifecycle.
	 * The `models/index` file will call this method automatically.
	 */
	static associate(models) {
		// define associations here
	}

	set players(value) {
		this._players = value;
	}

	/**
	 * returns the filtered <LunarClient>.players containing all players from this guild
	 */
	get players() {
		if (!this._players) this._players = this.client.players.cache.filter(player => player.guildID === this.guildID);
		return this._players;
	}

	/**
	 * returns the amount of players in the guild
	 * @returns {number}
	 */
	get playerCount() {
		return this.players.size;
	}

	/**
	 * returns various average stats
	 */
	get stats() {
		const players = this.players;
		const PLAYER_COUNT = players.size;

		return ({
			weightAverage: this.client.formatDecimalNumber(players.reduce((acc, player) => acc + player.getWeight().totalWeight, 0) / PLAYER_COUNT),
			skillAverage: this.client.formatDecimalNumber(players.reduce((acc, player) => acc + player.getSkillAverage().skillAverage, 0) / PLAYER_COUNT),
			slayerAverage: this.client.formatNumber(players.reduce((acc, player) => acc + player.getSlayerTotal(), 0) / PLAYER_COUNT, 0, Math.round),
			catacombsAverage: this.client.formatDecimalNumber(players.reduce((acc, player) => acc + player.getSkillLevel('catacombs').nonFlooredLevel, 0) / PLAYER_COUNT),
		});
	}

	/**
	 * updates the player database
	 */
	async update() {
		const { players, config } = this.client;
		const hypixelGuildData = await hypixel.guild.id(this.guildID);

		if (hypixelGuildData.meta.cached) return logger.info(`[UPDATE GUILD]: ${this.name}: cached data`);

		// update guild data
		this.name = hypixelGuildData.name;

		for (const rank of hypixelGuildData.ranks) {
			const dbEntryRank = this.ranks?.find(r => r.priority === rank.priority);

			if (!dbEntryRank) {
				const newRank = {
					name: rank.name,
					priority: rank.priority,
					weightReq: Infinity,
					roleID: null,
				};

				logger.info(`[UPDATE GUILD]: ${this.name}: new rank`, newRank);
				this.ranks.push(newRank);
				this.changed('ranks', true);
			} else if (dbEntryRank.name !== rank.name) {
				logger.info(`[UPDATE GUILD]: ${this.name}: rank name changed: '${dbEntryRank.name}' -> '${rank.name}'`);
				dbEntryRank.name = rank.name;
				this.changed('ranks', true);
			}
		}

		if (hypixelGuildData.chatMute) {
			this.chatMutedUntil = Date.now() + hypixelGuildData.chatMute;
		} else {
			this.chatMutedUntil = 0;
		}

		this.save();

		// update guild players
		const { members: currentGuildMembers } = hypixelGuildData;

		// API error
		if (!currentGuildMembers.length) throw new Error(`[UPDATE GUILD PLAYERS]: ${this.name}: guild data did not include any members`);

		const guildPlayers = this.players;
		const playersLeft = guildPlayers.filter(player => !currentGuildMembers.some(hypixelGuildMember => hypixelGuildMember.uuid === player.minecraftUUID));
		const PLAYERS_LEFT_AMOUNT = playersLeft.size;
		const PLAYERS_OLD_AMOUNT = guildPlayers.size;

		// all old players left (???)
		if (PLAYERS_LEFT_AMOUNT && PLAYERS_LEFT_AMOUNT === PLAYERS_OLD_AMOUNT) throw new Error(`[UPDATE GUILD PLAYERS]: ${this.name}: aborting guild player update request due to the possibility of an error from the fetched data`);

		const membersJoined = currentGuildMembers.filter(player => !players.cache.has(player.uuid));
		const playersJoinedAgain = [];
		const membersJoinedNew = [];

		await Promise.all(membersJoined.map(async hypixelGuildMember => {
			const dbEntry = await this.client.players.model.findByPk(hypixelGuildMember.uuid);
			if (dbEntry) return playersJoinedAgain.push(dbEntry);
			return membersJoinedNew.push(hypixelGuildMember);
		}));

		let leftLog = [];
		let joinedLog = [];
		let ignChangedLog = [];
		let hasError = false;

		// update player database
		await Promise.all([
			// update IGNs
			...guildPlayers.map(async player => {
				const result = await player.updateIgn();
				if (result) ignChangedLog.push(`${result.oldIgn} -> ${result.newIgn}`);
			}),

			// player left the guild
			...playersLeft.map(async player => {
				leftLog.push(`-\xa0${player.ign}${player.paid ? ` | paid ${player.amount.toLocaleString(config.get('NUMBER_FORMAT'))}` : ''}`);

				if (await player.removeFromGuild()) return; // return if successful

				leftLog.push(`-\xa0${player.ign}: error updating roles`);
				hasError = true;
			}),

			// player joined again and is still in db
			...playersJoinedAgain.map(async player => {
				player.guildID = this.guildID;

				await player.updateIgn();
				joinedLog.push(`+\xa0${player.ign}`);

				// try to link new player to discord
				await (async () => {
					let discordMember = await player.discordMember;

					if (!discordMember) {
						const discordTag = await player.fetchDiscordTag(true);

						if (!discordTag) {
							player.inDiscord = false;
							joinedLog.push(`-\xa0${player.ign}: no linked discord`);
							return hasError = true;
						}

						discordMember = await this.client.lgGuild?.findMemberByTag(discordTag);

						if (!discordMember) {
							if (/\D/.test(player.discordID)) player.discordID = discordTag; // save tag if no id is known
							player.inDiscord = false;
							joinedLog.push(player.discordID.includes('#')
								? `-\xa0${player.ign}: unknown discord tag ${player.discordID}`
								: `-\xa0${player.ign}: unknown discord ID ${player.discordID}`,
							);

							return hasError = true;
						}
					}

					return player.link(discordMember);
				})();

				await player.save();

				players.set(player.minecraftUUID, player);

				const { xpLastUpdatedAt } = player;

				// reset current xp to 0
				await player.resetXp({ offsetToReset: 'current' });

				// to trigger the xp gained reset if global reset happened after the player left the guild
				if (config.get('COMPETITION_START_TIME') >= xpLastUpdatedAt) await player.resetXp({ offsetToReset: offsetFlags.COMPETITION_START });
				if (config.get('COMPETITION_END_TIME') >= xpLastUpdatedAt) await player.resetXp({ offsetToReset: offsetFlags.COMPETITION_END });
				if (config.get('LAST_MAYOR_XP_RESET_TIME') >= xpLastUpdatedAt) await player.resetXp({ offsetToReset: offsetFlags.MAYOR });
				if (config.get('LAST_WEEKLY_XP_RESET_TIME') >= xpLastUpdatedAt) await player.resetXp({ offsetToReset: offsetFlags.WEEK });
				if (config.get('LAST_MONTHLY_XP_RESET_TIME') >= xpLastUpdatedAt) await player.resetXp({ offsetToReset: offsetFlags.MONTH });

				// shift the daily array for the amount of daily resets missed
				const DAYS_PASSED_SINCE_LAST_XP_UPDATE = Math.max(0, Math.ceil((config.get('LAST_DAILY_XP_RESET_TIME') - xpLastUpdatedAt) / (24 * 60 * 60 * 1000)));

				for (let index = DAYS_PASSED_SINCE_LAST_XP_UPDATE + 1; --index;) await player.resetXp({ offsetToReset: 'day' });

				return player.update({
					shouldSkipQueue: true,
					reason: `joined ${this.name}`,
				});
			}),

			// add all players to the db that joined
			...membersJoinedNew.map(async hypixelGuildMember => { // eslint-disable-line no-shadow
				const { uuid: minecraftUUID } = hypixelGuildMember;
				const IGN = await mojang.getName(minecraftUUID).catch(error => logger.error(`[GET IGN]: ${minecraftUUID}: ${error.name}: ${error.message}`)) ?? UNKNOWN_IGN;

				joinedLog.push(`+\xa0${IGN}`);

				let discordTag;
				let discordMember = null;

				// try to link new player to discord
				await (async () => {
					discordTag = (await getHypixelClient(true).player.uuid(minecraftUUID)
						.catch(error => logger.error(`[GET DISCORD TAG]: ${IGN} (${this.name}): ${error.name}${error.code ? ` ${error.code}` : ''}: ${error.message}`)))
						?.socialMedia?.links?.DISCORD;

					if (!discordTag) {
						joinedLog.push(`-\xa0${IGN}: no linked discord`);
						return hasError = true;
					}

					discordMember = await this.client.lgGuild?.findMemberByTag(discordTag);

					if (discordMember) return;

					joinedLog.push(`-\xa0${IGN}: unknown discord tag ${discordTag}`);
					hasError = true;
				})();

				const player = await players.add({
					minecraftUUID,
					ign: IGN,
					discordID: discordMember?.id ?? discordTag,
					guildID: this.guildID,
					inDiscord: Boolean(discordMember),
				}, false);

				player.discordMember = discordMember;

				return player.update({
					shouldSkipQueue: true,
					reason: `joined ${this.name}`,
				});
			}),
		]).catch(error => logger.error(`[UPDATE GUILD PLAYERS]: ${this.name}: db update error: ${error.name}: ${error.message}`));

		// update guild xp gained and ingame ranks
		currentGuildMembers.forEach(async hypixelGuildMember => {
			const player = players.cache.get(hypixelGuildMember.uuid);

			if (!player) return logger.warn(`[UPDATE GUILD PLAYERS]: ${this.name}: missing db entry for uuid: ${hypixelGuildMember.uuid}`);

			player.syncWithGuildData(hypixelGuildMember);
			player.guildRankPriority = this.ranks.find(rank => rank.name === hypixelGuildMember.rank)?.priority ?? (/guild ?master/i.test(hypixelGuildMember.rank) ? 6 : 0);
			player.save();
		});

		const CHANGES = ignChangedLog.length + PLAYERS_LEFT_AMOUNT + playersJoinedAgain.length + membersJoinedNew.length;

		if (!CHANGES) return;

		players.sortAlphabetically();

		// logging
		const sortAlphabetically = arr => arr.sort((a, b) => a.slice(2).toLowerCase().localeCompare(b.slice(2).toLowerCase()));

		joinedLog = Util.splitMessage(sortAlphabetically(joinedLog).join('\n'), { maxLength: 1011, char: '\n' });
		leftLog = Util.splitMessage(sortAlphabetically(leftLog).join('\n'), { maxLength: 1011, char: '\n' });
		ignChangedLog = Util.splitMessage(sortAlphabetically(ignChangedLog).join('\n'), { maxLength: 1015, char: '\n' });

		const EMBED_COUNT = Math.max(joinedLog.length, leftLog.length, ignChangedLog.length);
		const getInlineFieldLineCount = string => string.length
			? string.split('\n').reduce((acc, line) => acc + Math.ceil(line.length / 24), 0) // max shown is 24, number can be tweaked
			: 0;

		// create and send logging embed(s)
		for (let index = 0; index < EMBED_COUNT; ++index) {
			let joinedLogElement = joinedLog[index] ?? '';
			let leftLogElement = leftLog[index] ?? '';
			let ignChangedLogElement = ignChangedLog[index] ?? '';

			const IGNS_JOINED_LOG_LINE_COUNT = getInlineFieldLineCount(joinedLogElement);
			const PLAYERS_LEFT_LOG_LINE_COUNT = getInlineFieldLineCount(leftLogElement);
			const IGNS_CHANGED_LOG_LINE_COUNT = getInlineFieldLineCount(ignChangedLogElement);
			const MAX_VALUE_LINES = Math.max(IGNS_JOINED_LOG_LINE_COUNT, PLAYERS_LEFT_LOG_LINE_COUNT, IGNS_CHANGED_LOG_LINE_COUNT);

			// // empty line padding
			for (let i = 1 + MAX_VALUE_LINES - IGNS_JOINED_LOG_LINE_COUNT; --i;) joinedLogElement += '\n\u200b';
			for (let i = 1 + MAX_VALUE_LINES - PLAYERS_LEFT_LOG_LINE_COUNT; --i;) leftLogElement += '\n\u200b';
			for (let i = 1 + MAX_VALUE_LINES - IGNS_CHANGED_LOG_LINE_COUNT; --i;) ignChangedLogElement += '\n\u200b';

			this.client.log(new MessageEmbed()
				.setColor(hasError ? config.get('EMBED_RED') : config.get('EMBED_BLUE'))
				.setTitle(`${this.name} Player Database: ${CHANGES} change${CHANGES !== 1 ? 's' : ''}`)
				.setDescription(`Number of players: ${PLAYERS_OLD_AMOUNT} -> ${this.playerCount}`)
				.addFields( // max value#length is 1024
					{ name: `${'joined'.padEnd(75, '\xa0')}\u200b`, value: `\`\`\`${IGNS_JOINED_LOG_LINE_COUNT ? `diff\n${joinedLogElement}` : `\n${joinedLogElement}`}\`\`\``, inline: true },
					{ name: `${'left'.padEnd(75, '\xa0')}\u200b`, value: `\`\`\`${PLAYERS_LEFT_LOG_LINE_COUNT ? `diff\n${leftLogElement}` : `\n${leftLogElement}`}\`\`\``, inline: true },
					{ name: `${'new ign'.padEnd(75, '\xa0')}\u200b`, value: `\`\`\`\n${ignChangedLogElement}\`\`\``, inline: true },
				)
				.setTimestamp(),
			);
		}
	}

	/**
	 * determine the requested rank and compare the player's weight with the rank's requirement
	 * @param {import('../../extensions/Message')} message discord message which was send in #rank-requests channel
	 */
	async handleRankRequestMessage(message) {
		if (message.mentions.users.size) return true; // ignore messages with tagged users

		const { config } = this.client;
		const result = message.content
			?.replace(/[^a-zA-Z ]/g, '') // delete all non alphabetical characters
			.split(/ +/)
			.filter(word => word.length >= 3) // filter out short words like 'am'
			.map(word => autocorrect(word, this.ranks.filter(rank => rank.roleID), 'name'))
			.sort((a, b) => b.similarity - a.similarity)[0]; // element with the highest similarity

		if (!result || result.similarity < config.get('AUTOCORRECT_THRESHOLD')) return true;

		const {
			name: RANK_NAME,
			weightReq: WEIGHT_REQ,
			roleID: ROLE_ID,
			priority: RANK_PRIORITY,
		} = result.value; // rank
		const player = this.players.find(p => p.discordID === message.author.id);

		// no player db entry
		if (!player) {
			logger.info(`[CHECK RANK REQS]: ${message.author.tag} | ${message.member.displayName} requested ${RANK_NAME} but could not be found in the player db`);

			message.reply(
				`unable to find you in the ${this.name} player database, use \`${config.get('PREFIX')}verify [your ign]\` in ${message.findNearestCommandsChannel() ?? '#bot-commands'}`,
				{ sameChannel: true },
			);

			return true;
		}

		let { totalWeight } = player.getWeight();

		// player meets reqs and already has the rank or is staff and has the rank's role
		if (totalWeight >= WEIGHT_REQ && (player.guildRankPriority >= RANK_PRIORITY || (player.isStaff && message.member.roles.cache.has(ROLE_ID)))) {
			if (message.replyMessageID) {
				message.channel.messages.delete(message.replyMessageID).catch(error => logger.error(`[CHECK RANK REQS]: delete: ${error.name}: ${error.message}`));
			}
			if (message.channel.checkBotPermissions('ADD_REACTIONS')) {
				message.react(CLOWN).catch(error => logger.error(`[CHECK RANK REQS]: clown reaction: ${error.name}: ${error.message}`)); // get clowned
			}

			logger.info(`[CHECK RANK REQS]: ${message.author.tag} | ${message.member.displayName} requested '${RANK_NAME}' rank but is '${player.guildRank?.name ?? player.guildRankPriority}'`);
			return true;
		}

		const WEIGHT_REQ_STRING = WEIGHT_REQ.toLocaleString(config.get('NUMBER_FORMAT'));

		// player data could be outdated -> update data when player does not meet reqs
		if (totalWeight < WEIGHT_REQ) {
			logger.info(`[CHECK RANK REQS]: ${player.ign} requested ${RANK_NAME} but only had ${this.client.formatDecimalNumber(totalWeight, 0)} / ${WEIGHT_REQ_STRING} weight -> updating db`);
			await player.updateXp({ shouldSkipQueue: true });
			({ totalWeight } = player.getWeight());
		}

		const WEIGHT_STRING = this.client.formatDecimalNumber(totalWeight, 0);

		if (message.reactions.cache.get(CLOWN)?.me) message.reactions.cache.get(CLOWN).users.remove().catch(error => logger.error(`[CHECK RANK REQS]: remove reaction: ${error.name}: ${error.message}`)); // get clowned

		message.reply(
			`${totalWeight >= WEIGHT_REQ ? Y_EMOJI : X_EMOJI} \`${player.ign}\`'s weight: ${WEIGHT_STRING} / ${WEIGHT_REQ_STRING} [\`${RANK_NAME}\`]`,
			{ reply: false, sameChannel: true },
		);

		logger.info(`[CHECK RANK REQS]: ${player.ign} requested ${RANK_NAME} rank with ${WEIGHT_STRING} / ${WEIGHT_REQ_STRING} weight`);

		if (totalWeight < WEIGHT_REQ || !this.chatBridge?.ready) return true;

		try {
			await this.chatBridge.chat(`/g setrank ${player.ign} ${RANK_NAME}`);
			await message.react(Y_EMOJI_ALT);
		} catch (error) {
			logger.error('[CHECK RANK REQS]: promotion error:', error);
		}

		return true;
	}

	/**
	 * determine the requested rank and compare the player's weight with the rank's requirement
	 * @param {import('../../extensions/Message')} message discord message which was send in #rank-requests channel
	 */
	async handleChatBridgeMessage(message) {
		// chatbridge disabled or no message.content to chat
		if (!this.client.config.getBoolean('CHATBRIDGE_ENABLED') || !message.content.length) return true;

		if (!this.chatBridge?.ready) {
			logger.warn(`[CHATBRIDGE]: ${this.name}: offline`);
			if (message.channel.checkBotPermissions('ADD_REACTIONS')) {
				message.react(X_EMOJI).catch(error => logger.error(`[CHECK RANK REQS]: x reaction: ${error.name}: ${error.message}`)); // get clowned
			}
			return true;
		}

		const player = this.client.players.getByID(message.author.id);

		// check if player is muted
		if (player?.chatBridgeMutedUntil) {
			if (Date.now() < player.chatBridgeMutedUntil) { // mute hasn't expired
				message.author.send(`you are currently muted ${player.chatBridgeMutedUntil ? `until ${new Date(player.chatBridgeMutedUntil).toUTCString()}` : 'for an unspecified amount of time'}`).then(
					() => logger.info(`[CHATBRIDGE]: ${player.info}: DMed muted user`),
					error => logger.error(`[CHATBRIDGE]: ${player.info}: error DMing muted user: ${error.name}: ${error.message}`),
				);
				if (message.channel.checkBotPermissions('ADD_REACTIONS')) {
					message.react(MUTED).catch(error => logger.error(`[CHECK RANK REQS]: muted reaction: ${error.name}: ${error.message}`));
				}
				return true;
			}

			player.chatBridgeMutedUntil = 0;
			player.save();
		}

		// check if guild chat is muted
		if (this.chatMutedUntil && !player?.isStaff) {
			if (Date.now() < this.chatMutedUntil) {
				message.author.send(`${this.name}'s guild chat is currently muted for ${ms(this.chatMutedUntil - Date.now(), { long: true })}`).then(
					() => logger.info(`[CHATBRIDGE]: ${player.info}: DMed guild chat muted`),
					error => logger.error(`[CHATBRIDGE]: ${player.info}: error DMing guild chat muted: ${error.name}: ${error.message}`),
				);
				if (message.channel.checkBotPermissions('ADD_REACTIONS')) {
					message.react(MUTED).catch(error => logger.error(`[CHECK RANK REQS]: muted reaction: ${error.name}: ${error.message}`));
				}
				return true;
			}

			this.chatMutedUntil = 0;
			this.save();
		}

		this.chatBridge.sendToHypixelGuildChat(message, player);
		return true;
	}
}

module.exports = HypixelGuild;
