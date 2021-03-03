'use strict';

const { Model, DataTypes } = require('sequelize');
const { MessageEmbed, Util } = require('discord.js');
const ms = require('ms');
const { autocorrect, getHypixelClient } = require('../../../functions/util');
const { Y_EMOJI, Y_EMOJI_ALT, X_EMOJI, CLOWN, MUTED, STOP } = require('../../../constants/emojiCharacters');
const { offsetFlags: { COMPETITION_START, COMPETITION_END, MAYOR, WEEK, MONTH }, UNKNOWN_IGN } = require('../../../constants/database');
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


module.exports = class HypixelGuild extends Model {
	constructor(...args) {
		super(...args);

		/**
		 * @type {import('discord.js').Collection<string, import('./Player')>}
		 */
		this._players = null;
		/**
		 * @type {import('../../chat_bridge/ChatBridge')}
		 */
		this._chatBridge = null;
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
	 * @param {import('sequelize')} sequelize
	 */
	static init(sequelize) {
		return super.init({
			guildID: {
				type: DataTypes.STRING,
				primaryKey: true,
			},
			roleID: {
				type: DataTypes.STRING,
				defaultValue: null,
				allowNull: true,
			},
			name: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			weightReq: {
				type: DataTypes.INTEGER,
				defaultValue: 0,
				allowNull: true,
			},
			chatBridgeEnabled: {
				type: DataTypes.BOOLEAN,
				defaultValue: true,
				allowNull: false,
			},
			chatMutedUntil: {
				type: DataTypes.BIGINT,
				defaultValue: 0,
				allowNull: false,
			},
			chatBridgeChannelID: {
				type: DataTypes.STRING,
				defaultValue: null,
				allowNull: true,
			},
			rankRequestChannelID: {
				type: DataTypes.STRING,
				defaultValue: null,
				allowNull: true,
			},
			ranks: {
				type: DataTypes.ARRAY(DataTypes.JSONB), // { name: string, priority: int, weightReq: int, roleID: string }
				defaultValue: null,
				allowNull: true,
			},
		}, {
			sequelize,
			modelName: 'HypixelGuild',
			timestamps: false,
		});
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

	set chatBridge(value) {
		this._chatBridge = value;
	}

	/**
	 * returns either the chatBridge if it is linked and ready or throws an exception
	 */
	get chatBridge() {
		if (!this._chatBridge?.ready) throw new Error(`${this.name}: chat bridge ${this._chatBridge ? 'not ready' : 'not found'}`);
		return this._chatBridge;
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
		const { meta: { cached }, name, ranks, chatMute, members: currentGuildMembers } = await hypixel.guild.id(this.guildID);

		if (cached) return logger.info(`[UPDATE GUILD]: ${this.name}: cached data`);

		const { players, config } = this.client;

		// update guild data
		this.name = name;

		for (const rank of ranks) {
			const dbEntryRank = this.ranks?.find(r => r.priority === rank.priority);

			if (!dbEntryRank) {
				const newRank = {
					name: rank.name,
					priority: rank.priority,
					weightReq: Infinity,
					roleID: null,
				};

				logger.info(`[UPDATE GUILD]: ${this.name}: new rank`, newRank);
				this.ranks ??= [];
				this.ranks.push(newRank);
				this.changed('ranks', true);
			} else if (dbEntryRank.name !== rank.name) {
				logger.info(`[UPDATE GUILD]: ${this.name}: rank name changed: '${dbEntryRank.name}' -> '${rank.name}'`);
				dbEntryRank.name = rank.name;
				this.changed('ranks', true);
			}
		}

		if (chatMute) {
			this.chatMutedUntil = Date.now() + chatMute;
		} else {
			this.chatMutedUntil = 0;
		}

		this.save();

		// update guild players
		if (!currentGuildMembers.length) throw new Error(`[UPDATE GUILD PLAYERS]: ${this.name}: guild data did not include any members`); // API error

		const guildPlayers = this.players;
		const playersLeft = guildPlayers.filter((_, minecraftUUID) => !currentGuildMembers.some(({ uuid }) => uuid === minecraftUUID));
		const PLAYERS_LEFT_AMOUNT = playersLeft.size;
		const PLAYERS_OLD_AMOUNT = guildPlayers.size;

		// all old players left (???)
		if (PLAYERS_LEFT_AMOUNT && PLAYERS_LEFT_AMOUNT === PLAYERS_OLD_AMOUNT) throw new Error(`[UPDATE GUILD PLAYERS]: ${this.name}: aborting guild player update request due to the possibility of an error from the fetched data`);

		const membersJoined = currentGuildMembers.filter(({ uuid }) => !players.inGuild.has(uuid));
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
				leftLog.push(`-\xa0${player.ign}`);

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
							if (/\D/.test(player.discordID)) await player.setValidDiscordID(discordTag).catch(logger.error); // save tag if no id is known
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
				if (config.get('COMPETITION_START_TIME') >= xpLastUpdatedAt) await player.resetXp({ offsetToReset: COMPETITION_START });
				if (config.get('COMPETITION_END_TIME') >= xpLastUpdatedAt) await player.resetXp({ offsetToReset: COMPETITION_END });
				if (config.get('LAST_MAYOR_XP_RESET_TIME') >= xpLastUpdatedAt) await player.resetXp({ offsetToReset: MAYOR });
				if (config.get('LAST_WEEKLY_XP_RESET_TIME') >= xpLastUpdatedAt) await player.resetXp({ offsetToReset: WEEK });
				if (config.get('LAST_MONTHLY_XP_RESET_TIME') >= xpLastUpdatedAt) await player.resetXp({ offsetToReset: MONTH });

				// shift the daily array for the amount of daily resets missed
				const DAYS_PASSED_SINCE_LAST_XP_UPDATE = Math.max(0, Math.ceil((config.get('LAST_DAILY_XP_RESET_TIME') - xpLastUpdatedAt) / (24 * 60 * 60 * 1000)));

				for (let index = DAYS_PASSED_SINCE_LAST_XP_UPDATE + 1; --index;) await player.resetXp({ offsetToReset: 'day' });

				return player.update({
					shouldSkipQueue: true,
					reason: `joined ${this.name}`,
				});
			}),

			// add all players to the db that joined
			...membersJoinedNew.map(async ({ uuid: minecraftUUID }) => { // eslint-disable-line no-shadow
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
			player.guildRankPriority = this.ranks.find(rank => rank.name === hypixelGuildMember.rank)?.priority ?? (/guild ?master/i.test(hypixelGuildMember.rank) ? this.ranks.length + 1 : 0);
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
	 * @param {import('../../extensions/Message')} message discord message which was send in the #guild-general channel
	 */
	async handleRankRequestMessage(message) {
		const { config } = this.client;
		const result = message.content
			?.replace(/[^a-zA-Z ]/g, '') // delete all non alphabetical characters
			.split(/ +/)
			.filter(word => word.length >= 3) // filter out short words like 'am'
			.map(word => autocorrect(word, this.ranks, 'name'))
			.sort((a, b) => b.similarity - a.similarity)[0]; // element with the highest similarity

		if (!result || result.similarity < config.get('AUTOCORRECT_THRESHOLD')) return;

		const { value: {
			name: RANK_NAME,
			weightReq: WEIGHT_REQ,
			roleID: ROLE_ID,
			priority: RANK_PRIORITY,
		} } = result; // rank

		let player = this.players.find(p => p.discordID === message.author.id);

		// no player db entry in this guild
		if (!player) {
			player = message.author.player;

			// no player db entry in all guilds
			if (!player) {
				logger.info(`[RANK REQUEST]: ${this.name}: ${message.author.tag} | ${message.member.displayName} requested '${RANK_NAME}' but could not be found in the player db`);

				return message.reply(
					`unable to find you in the ${this.name} player database, use \`${config.get('PREFIX')}verify [your ign]\` in ${message.findNearestCommandsChannel() ?? '#bot-commands'}`,
					{ sameChannel: true },
				);
			}

			// player found in other guild
			logger.info(`[RANK REQUEST]: ${player.logInfo}: requested '${RANK_NAME}' from '${this.name}' but is in '${player.guildName}'`);

			return message.reply(
				`you need to be in ${this.name} in order to request this rank. If you just joined use \`${config.get('PREFIX')}verify [your ign]\` in ${message.findNearestCommandsChannel() ?? '#bot-commands'}`,
				{ sameChannel: true },
			);
		}

		// non-requestable rank
		if (!ROLE_ID) {
			logger.info(`[RANK REQUEST]: ${player.logInfo}: requested '${RANK_NAME}' rank which is non-requestable`);
			if (message.replyMessageID) message.channel.messages.delete(message.replyMessageID).catch(error => logger.error(`[RANK REQUEST]: delete: ${error.name}: ${error.message}`));
			return message.reactSafely(CLOWN);
		}

		let { totalWeight } = player.getWeight();

		// player meets reqs and already has the rank or is staff and has the rank's role
		if (totalWeight >= WEIGHT_REQ && ((!player.isStaff && player.guildRankPriority >= RANK_PRIORITY) || (player.isStaff && (message.member ?? await player.discordMember)?.roles.cache.has(ROLE_ID)))) {
			logger.info(`[RANK REQUEST]: ${player.logInfo}: requested '${RANK_NAME}' rank but is '${player.guildRank?.name ?? player.guildRankPriority}'`);
			if (message.replyMessageID) message.channel.messages.delete(message.replyMessageID).catch(error => logger.error(`[RANK REQUEST]: delete: ${error.name}: ${error.message}`));
			return message.reactSafely(CLOWN);
		}

		const WEIGHT_REQ_STRING = WEIGHT_REQ.toLocaleString(config.get('NUMBER_FORMAT'));

		// player data could be outdated -> update data when player does not meet reqs
		if (totalWeight < WEIGHT_REQ) {
			logger.info(`[RANK REQUEST]: ${player.logInfo}: requested ${RANK_NAME} but only had ${this.client.formatDecimalNumber(totalWeight, 0)} / ${WEIGHT_REQ_STRING} weight -> updating db`);
			await player.updateXp({ shouldSkipQueue: true });
			({ totalWeight } = player.getWeight());
		}

		const WEIGHT_STRING = this.client.formatDecimalNumber(totalWeight, 0);

		if (message.reactions.cache.get(CLOWN)?.me) message.reactions.cache.get(CLOWN).users.remove().catch(error => logger.error(`[RANK REQUEST]: remove reaction: ${error.name}: ${error.message}`)); // get clowned

		await message.reply(
			`${totalWeight >= WEIGHT_REQ ? Y_EMOJI : X_EMOJI} \`${player.ign}\`'s weight: ${WEIGHT_STRING} / ${WEIGHT_REQ_STRING} [\`${RANK_NAME}\`]`,
			{ reply: false, sameChannel: true },
		);

		logger.info(`[RANK REQUEST]: ${player.logInfo}: requested ${RANK_NAME} rank with ${WEIGHT_STRING} / ${WEIGHT_REQ_STRING} weight`);

		if (totalWeight < WEIGHT_REQ) return;

		// set rank role to requested rank
		if (player.isStaff) {
			const member = message.member ?? await player.discordMember;

			if (!member) throw new Error('unknown discord member');

			const otherRequestableRankRoles = this.ranks.flatMap(({ roleID }) => roleID && roleID !== ROLE_ID ? roleID : []);
			const rolesToRemove = [ ...member.roles.cache.keys() ].filter(roleID => otherRequestableRankRoles.includes(roleID));

			await player.makeRoleApiCall([ ROLE_ID ], rolesToRemove, `requested ${RANK_NAME}`);
		} else {
			// set ingame rank and discord role
			await this.chatBridge.command({
				command: `g setrank ${player.ign} ${RANK_NAME}`,
				responseRegex: new RegExp(`(?:\\[.+?\\] )?${player.ign} was promoted from ${player.guildRank.name} to ${RANK_NAME}`), // listen for ingame promotion message
				rejectOnTimeout: true,
			});

			// ingame chat message received
			player.guildRankPriority = RANK_PRIORITY;
			player.save();
			await player.updateRoles(`requested ${RANK_NAME}`);
		}

		await message.reactSafely(Y_EMOJI_ALT);
	}

	/**
	 * forwards a message to the ingame chat if neither the player nor the whole guild chat is muted
	 * @param {import('../../extensions/Message')} message discord message which was send in the #rank-requests channel
	 */
	async handleChatBridgeMessage(message) {
		// chatbridge disabled or no message.content to chat
		if (!this.client.config.getBoolean('CHATBRIDGE_ENABLED') || !message.content.length) return;

		/**
		 * @type {import('./Player')}
		 */
		const player = message.author.player;

		// check if player is muted
		if (player?.chatBridgeMutedUntil) {
			if (Date.now() < player.chatBridgeMutedUntil) { // mute hasn't expired
				message.author.send(`you are currently muted for ${ms(player.chatBridgeMutedUntil - Date.now(), { long: true })}`).then(
					() => logger.info(`[GUILD CHATBRIDGE]: ${player.logInfo}: DMed muted user`),
					error => logger.error(`[GUILD CHATBRIDGE]: ${player.logInfo}: error DMing muted user: ${error.name}: ${error.message}`),
				);
				return message.reactSafely(MUTED);
			}

			player.chatBridgeMutedUntil = 0;
			player.save();
		}

		// check if guild chat is muted
		if (this.chatMutedUntil && !player?.isStaff) {
			if (Date.now() < this.chatMutedUntil) {
				message.author.send(`${this.name}'s guild chat is currently muted for ${ms(this.chatMutedUntil - Date.now(), { long: true })}`).then(
					() => logger.info(`[GUILD CHATBRIDGE]: ${player?.logInfo ?? message.author.tag}: DMed guild chat muted`),
					error => logger.error(`[GUILD CHATBRIDGE]: ${player?.logInfo ?? message.author.tag}: error DMing guild chat muted: ${error.name}: ${error.message}`),
				);
				return message.reactSafely(MUTED);
			}

			this.chatMutedUntil = 0;
			this.save();
		}

		try {
			if (!(await this.chatBridge.forwardDiscordMessageToHypixelGuildChat(message, player))) message.reactSafely(STOP);
		} catch (error) {
			logger.warn(`[GUILD CHATBRIDGE]: ${error.message}`);
			message.reactSafely(X_EMOJI);
		}
	}
};
