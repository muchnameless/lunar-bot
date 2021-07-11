'use strict';

const { Model, DataTypes } = require('sequelize');
const { MessageEmbed, Util: { splitMessage } } = require('discord.js');
const { cleanFormattedNumber, compareAlphabetically, safePromiseAll } = require('../../../functions/util');
const { mutedCheck } = require('../../../functions/database');
const { setRank: { regExp: setRank } } = require('../../chat_bridge/constants/commandResponses');
const { EMBED_MAX_CHARS, EMBED_MAX_FIELDS, EMBED_FIELD_MAX_CHARS } = require('../../../constants/discord');
const { offsetFlags: { COMPETITION_START, COMPETITION_END, MAYOR, WEEK, MONTH, CURRENT, DAY }, UNKNOWN_IGN } = require('../../../constants/database');
const hypixel = require('../../../api/hypixel');
const mojang = require('../../../api/mojang');
const logger = require('../../../functions/logger');

/**
 * @typedef {object} GuildRank
 * @property {string} name name of the guild rank
 * @property {?string} roleId discord role ID associated with the guild rank
 * @property {number} priority hypixel guild rank priority
 * @property {?number} positionReq weight lb position requirement for the guild rank
 */

/**
 * @typedef {object} ChatBridgeChannel
 * @property {string} type
 * @property {string} channelId
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
		 * wether a player db update is currently running
		 * @type {boolean}
		 */
		this._isUpdatingPlayers = false;

		/**
		 * @type {string}
		 */
		this.guildId;
		/**
		 * @type {string}
		 */
		this.roleId;
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
		this.mutedTill;
		/**
		 * @type {ChatBridgeChannel[]}
		 */
		this.chatBridgeChannels;
		/**
		 * @type {GuildRank[]}
		 */
		this.ranks;
		/**
		 * @type {object[]}
		 */
		this.statsHistory;
	}

	/**
	 * @param {import('sequelize')} sequelize
	 */
	static init(sequelize) {
		return super.init({
			guildId: {
				type: DataTypes.STRING,
				primaryKey: true,
			},
			roleId: {
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
			mutedTill: {
				type: DataTypes.BIGINT,
				defaultValue: 0,
				allowNull: false,
				set(value) {
					this.setDataValue('mutedTill', value ?? 0);
				},
			},
			chatBridgeChannels: {
				type: DataTypes.ARRAY(DataTypes.JSONB),
				defaultValue: [],
				allowNull: false,
			},
			ranks: {
				type: DataTypes.ARRAY(DataTypes.JSONB),
				defaultValue: null,
				allowNull: true,
			},
			statsHistory: {
				type: DataTypes.ARRAY(DataTypes.JSONB),
				defaultValue: new Array(30).fill(null)
					.map(() => ({
						playerCount: 0,
						weightAverage: 0,
						skillAverage: 0,
						slayerAverage: 0,
						catacombsAverage: 0,
					})),
				allowNull: false,
			},
		}, {
			sequelize,
			modelName: 'HypixelGuild',
			timestamps: false,
		});
	}

	/**
	 * transformes a log array
	 * @param {string[]} logArray
	 */
	static transformLogArray(logArray) {
		if (!logArray.length) return logArray;

		return splitMessage(
			logArray.sort(compareAlphabetically).join('\n'),
			{ maxLength: EMBED_FIELD_MAX_CHARS - 11, char: '\n' },
		);
	}

	set players(value) {
		this._players = value;
	}

	/**
	 * returns the filtered <LunarClient>.players containing all players from this guild
	 */
	get players() {
		return this._players ??= this.client.players.cache.filter(({ guildId }) => guildId === this.guildId);
	}

	set chatBridge(value) {
		this._chatBridge = value;
	}

	/**
	 * returns either the chatBridge if it is linked and ready or throws an exception
	 */
	get chatBridge() {
		if (!this.chatBridgeEnabled) throw `${this.name}: chat bridge disabled`;
		if (!this._chatBridge?.minecraft.ready) throw `${this.name}: chat bridge not ${this._chatBridge ? 'ready' : 'found'}`;
		return this._chatBridge;
	}

	/**
	 * returns the amount of players in the guild
	 */
	get playerCount() {
		return this.players.size;
	}

	/**
	 * returns various average stats
	 */
	get stats() {
		const { players } = this;
		const PLAYER_COUNT = players.size;

		return ({
			weightAverage: players.reduce((acc, player) => acc + player.getWeight().totalWeight, 0) / PLAYER_COUNT,
			skillAverage: players.reduce((acc, player) => acc + player.getSkillAverage().skillAverage, 0) / PLAYER_COUNT,
			slayerAverage: players.reduce((acc, player) => acc + player.getSlayerTotal(), 0) / PLAYER_COUNT,
			catacombsAverage: players.reduce((acc, player) => acc + player.getSkillLevel('catacombs').nonFlooredLevel, 0) / PLAYER_COUNT,
		});
	}

	/**
	 * returns various average stats, formatted as strings
	 */
	get formattedStats() {
		const { weightAverage, skillAverage, slayerAverage, catacombsAverage } = this.stats;

		return ({
			weightAverage: cleanFormattedNumber(this.client.formatDecimalNumber(weightAverage)),
			skillAverage: cleanFormattedNumber(this.client.formatDecimalNumber(skillAverage)),
			slayerAverage: cleanFormattedNumber(this.client.formatNumber(slayerAverage, 0, Math.round)),
			catacombsAverage: cleanFormattedNumber(this.client.formatDecimalNumber(catacombsAverage)),
		});
	}

	/**
	 * wether the player is muted and that mute is not expired
	 */
	get muted() {
		return mutedCheck(this);
	}

	/**
	 * guild players that have a requestable rank without meeting the requirements
	 */
	get playersBelowRankReqs() {
		return this.players.array().flatMap((player) => {
			const rank = player.guildRank;

			if (!rank?.roleId) return []; // unkown or non-requestable rank

			const { totalWeight } = player.getWeight();

			if (totalWeight >= rank.weightReq) return [];

			return {
				player,
				totalWeight,
				rank,
			};
		});
	}

	/**
	 * shifts the daily stats history
	 */
	async saveDailyStats() {
		// append current xp to the beginning of the statsHistory-Array and pop of the last value
		const { statsHistory } = this;
		statsHistory.shift();
		statsHistory.push({ playerCount: this.playerCount, ...this.stats });
		this.changed('statsHistory', true); // neccessary so that sequelize knows an array has changed and the db needs to be updated

		return this.save();
	}

	/**
	 * updates the player database
	 */
	async update() {
		const data = await hypixel.guild.id(this.guildId);

		if (data.meta.cached) return logger.info(`[UPDATE GUILD]: ${this.name}: cached data`);

		this._updateGuildData(data);

		return this.updatePlayers(data);
	}

	/**
	 * updates the guild data
	 * @param {?import('@zikeji/hypixel/src/util/ResultObject').ResultObject<import('@zikeji/hypixel').Components.Schemas.GuildResponse, ['guild']>} data
	 */
	async _updateGuildData(data) {
		const { meta: { cached }, name: guildName, ranks, chatMute } = data ?? await hypixel.guild.id(this.guildId);

		if (cached) return logger.info(`[UPDATE GUILD DATA]: ${this.name}: cached data`);

		// update name
		this.name = guildName;

		// update ranks
		for (const { name, priority } of ranks) {
			const dbEntryRank = this.ranks?.find(({ priority: rankPriority }) => rankPriority === priority);

			if (!dbEntryRank) {
				const newRank = {
					name,
					priority,
					weightReq: Infinity,
					roleId: null,
				};

				logger.info(`[UPDATE GUILD]: ${this.name}: new rank`, newRank);
				this.ranks ??= [];
				this.ranks.push(newRank);
				this.changed('ranks', true);
			} else if (dbEntryRank.name !== name) {
				logger.info(`[UPDATE GUILD]: ${this.name}: rank name changed: '${dbEntryRank.name}' -> '${name}'`);
				dbEntryRank.name = name;
				this.changed('ranks', true);
			}
		}

		// sync guild mutes
		this.mutedTill = chatMute;

		return this.save();
	}

	/**
	 * updates the guild player database
	 * @param {?import('@zikeji/hypixel/src/util/ResultObject').ResultObject<import('@zikeji/hypixel').Components.Schemas.GuildResponse, ['guild']>} data
	 */
	async updatePlayers(data) {
		if (this._isUpdatingPlayers) return;
		this._isUpdatingPlayers = true;

		try {
			const { meta: { cached }, members: currentGuildMembers } = data ?? await hypixel.guild.id(this.guildId);

			if (cached) return logger.info(`[UPDATE PLAYERS]: ${this.name}: cached data`);

			const { players, config } = this.client;

			// update guild players
			if (!currentGuildMembers.length) throw new Error(`[UPDATE GUILD PLAYERS]: ${this.name}: guild data did not include any members`); // API error

			const guildPlayers = this.players;
			const playersLeft = guildPlayers.filter((_, minecraftUuid) => !currentGuildMembers.some(({ uuid }) => uuid === minecraftUuid));
			const PLAYERS_LEFT_AMOUNT = playersLeft.size;
			const PLAYERS_OLD_AMOUNT = guildPlayers.size;

			// all old players left (???)
			if (PLAYERS_LEFT_AMOUNT && PLAYERS_LEFT_AMOUNT === PLAYERS_OLD_AMOUNT) throw new Error(`[UPDATE GUILD PLAYERS]: ${this.name}: aborting guild player update request due to the possibility of an error from the fetched data`);

			const membersJoined = currentGuildMembers.filter(({ uuid }) => !players.inGuild.has(uuid));

			let leftLog = [];
			let joinedLog = [];
			let hasError = false;

			// add / remove player db entries
			await safePromiseAll([
				...membersJoined.map(async ({ uuid: minecraftUuid }) => {
					/** @type {[import('./Player'), boolean]} */
					const [ player, created ] = await this.client.players.model.findOrCreate({
						where: { minecraftUuid },
						defaults: {
							guildId: this.guildId,
						},
					});

					// unknown player
					if (created) {
						const IGN = await (async () => {
							try {
								return (await mojang.uuid(minecraftUuid)).ign;
							} catch (error) {
								logger.error('[GET IGN]', error);
								return UNKNOWN_IGN;
							}
						})();

						joinedLog.push(`+\xa0${IGN}`);

						let discordTag = null;
						let discordMember = null;

						// try to link new player to discord
						await (async () => {
							discordTag = (await hypixel.player.uuid(minecraftUuid)
								.catch(error => logger.error(`[GET DISCORD TAG]: ${IGN} (${this.name})`, error)))
								?.socialMedia?.links?.DISCORD;

							if (!discordTag) {
								joinedLog.push(`-\xa0${IGN}: no linked discord`);
								return hasError = true;
							}

							discordMember = await this.client.lgGuild?.fetchMemberByTag(discordTag);

							if (discordMember) return;

							joinedLog.push(`-\xa0${IGN}: unknown discord tag ${discordTag}`);
							hasError = true;
						})();

						// update player
						setTimeout(
							(async () => {
								try {
									await player.setValidDiscordId(discordMember?.id ?? discordTag);
								} catch (error) {
									logger.error(error);
								}

								player.ign = IGN;
								player.save();

								player.update({
									reason: `joined ${this.name}`,
								});
							}),
							0,
						);

					// player already in the db
					} else {
						player.guildId = this.guildId;

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

								discordMember = await this.client.lgGuild?.fetchMemberByTag(discordTag);

								if (!discordMember) {
									if (/\D/.test(player.discordId)) await player.setValidDiscordId(discordTag).catch(logger.error); // save tag if no id is known
									player.inDiscord = false;
									joinedLog.push(player.discordId.includes('#')
										? `-\xa0${player.ign}: unknown discord tag ${player.discordId}`
										: `-\xa0${player.ign}: unknown discord ID ${player.discordId}`,
									);

									return hasError = true;
								}
							}

							player.link(discordMember);
						})();

						// update player
						setTimeout(
							(async () => {
								// reset current xp to 0
								await player.resetXp({ offsetToReset: CURRENT }).catch(error => logger.error(error));

								const { xpLastUpdatedAt } = player;
								// shift the daily array for the amount of daily resets missed
								const DAYS_PASSED_SINCE_LAST_XP_UPDATE = Math.max(
									0,
									Math.min(
										Math.ceil((config.get('LAST_DAILY_XP_RESET_TIME') - xpLastUpdatedAt) / (24 * 60 * 60 * 1000)),
										player.guildXpHistory.length,
									),
								);

								// to trigger the xp gained reset if global reset happened after the player left the guild
								await safePromiseAll([
									config.get('COMPETITION_START_TIME') >= xpLastUpdatedAt && player.resetXp({ offsetToReset: COMPETITION_START }),
									config.get('COMPETITION_END_TIME') >= xpLastUpdatedAt && player.resetXp({ offsetToReset: COMPETITION_END }),
									config.get('LAST_MAYOR_XP_RESET_TIME') >= xpLastUpdatedAt && player.resetXp({ offsetToReset: MAYOR }),
									config.get('LAST_WEEKLY_XP_RESET_TIME') >= xpLastUpdatedAt && player.resetXp({ offsetToReset: WEEK }),
									config.get('LAST_MONTHLY_XP_RESET_TIME') >= xpLastUpdatedAt && player.resetXp({ offsetToReset: MONTH }),
									...new Array(DAYS_PASSED_SINCE_LAST_XP_UPDATE).fill(null)
										.map(() => player.resetXp({ offsetToReset: DAY })),
								]);

								player.update({
									reason: `joined ${this.name}`,
								});
							}),
							0,
						);
					}

					this.client.players.set(minecraftUuid, player);
				}),

				// player left the guild
				...playersLeft.map(async (player) => {
					leftLog.push(`-\xa0${player.ign}`);

					if (await player.removeFromGuild()) return; // return if successful

					leftLog.push(`-\xa0${player.ign}: error updating roles`);
					hasError = true;
				}),
			]);

			// sync guild xp, mutedTill & guild ranks
			(async () => {
				await safePromiseAll(currentGuildMembers.map(
					async hypixelGuildMember => players.cache.get(hypixelGuildMember.uuid)?.syncWithGuildData(hypixelGuildMember)
						?? logger.warn(`[UPDATE GUILD PLAYERS]: ${this.name}: missing db entry for uuid: ${hypixelGuildMember.uuid}`)),
				);

				this.syncGuildRanks();
			})();

			const CHANGES = PLAYERS_LEFT_AMOUNT + membersJoined.length;

			if (!CHANGES) return;

			players.sortAlphabetically();

			// logging
			joinedLog = HypixelGuild.transformLogArray(joinedLog);
			leftLog = HypixelGuild.transformLogArray(leftLog);

			const EMBED_COUNT = Math.max(joinedLog.length, leftLog.length);
			const getInlineFieldLineCount = string => (string.length
				? string.split('\n').reduce((acc, line) => acc + Math.ceil(line.length / 30), 0) // max shown is 24, number can be tweaked
				: 0);

			// create and send logging embed(s)
			/**
			 * @type {MessageEmbed[]}
			 */
			const loggingEmbeds = [];
			const createEmbed = () => {
				const embed = new MessageEmbed()
					.setColor(hasError ? config.get('EMBED_RED') : config.get('EMBED_BLUE'))
					.setTitle(`${this.name} Player Database: ${CHANGES} change${CHANGES !== 1 ? 's' : ''}`)
					.setDescription(`Number of players: ${PLAYERS_OLD_AMOUNT} -> ${this.playerCount}`)
					.setTimestamp();

				loggingEmbeds.push(embed);

				return embed;
			};

			let embed = createEmbed();
			let currentLength = embed.length;

			for (let index = 0; index < EMBED_COUNT; ++index) {
				let joinedLogElement = joinedLog[index] ?? '';
				let leftLogElement = leftLog[index] ?? '';

				const IGNS_JOINED_LOG_LINE_COUNT = getInlineFieldLineCount(joinedLogElement);
				const PLAYERS_LEFT_LOG_LINE_COUNT = getInlineFieldLineCount(leftLogElement);
				const MAX_VALUE_LINES = Math.max(IGNS_JOINED_LOG_LINE_COUNT, PLAYERS_LEFT_LOG_LINE_COUNT);

				// // empty line padding
				for (let i = 1 + MAX_VALUE_LINES - IGNS_JOINED_LOG_LINE_COUNT; --i;) joinedLogElement += '\n\u200b';
				for (let i = 1 + MAX_VALUE_LINES - PLAYERS_LEFT_LOG_LINE_COUNT; --i;) leftLogElement += '\n\u200b';

				const newFields = [
					{ name: `${'joined'.padEnd(125, '\xa0')}\u200b`, value: `\`\`\`${IGNS_JOINED_LOG_LINE_COUNT ? `diff\n${joinedLogElement}` : `\n${joinedLogElement}`}\`\`\``, inline: true },
					{ name: `${'left'.padEnd(125, '\xa0')}\u200b`, value: `\`\`\`${PLAYERS_LEFT_LOG_LINE_COUNT ? `diff\n${leftLogElement}` : `\n${leftLogElement}`}\`\`\``, inline: true },
					{ name: '\u200b', value: '\u200b', inline: true },
				];
				const ADDITIONAL_LENGTH = newFields.reduce((acc, { name, value }) => acc + name.length + value.length, 0);

				if (currentLength + ADDITIONAL_LENGTH <= EMBED_MAX_CHARS && embed.fields.length < EMBED_MAX_FIELDS) {
					embed.addFields(...newFields);
					currentLength += ADDITIONAL_LENGTH;
				} else {
					embed = createEmbed();
					embed.addFields(...newFields);
					currentLength = embed.length;
				}
			}

			this.client.log(...loggingEmbeds);
		} finally {
			this._isUpdatingPlayers = false;
		}
	}

	/**
	 * syncs guild ranks with the weight leaderboard
	 */
	async syncGuildRanks() {
		if (!this.client.config.get('AUTO_GUILD_RANKS')) return;
		if (!this.chatBridgeEnabled) return;

		try {
			const { chatBridge } = this;
			const automatedRanks = this.ranks.filter(({ positionReq }) => positionReq != null);

			for (const [ index, player ] of this.players
				.array()
				.sort((p1, p2) => p1.getWeight().totalWeight - p2.getWeight().totalWeight) // from lowest to highest weight
				.entries()
			) {
				const newRank = automatedRanks.reduce((acc, cur) => (cur.positionReq <= index && (acc?.positionReq ?? 0) <= cur.positionReq ? cur : acc), null);

				if (!newRank) continue;

				const { guildRank: oldRank } = player;

				// player is staff -> only roles need to be adapted
				if (player.isStaff) {
					const member = await player.discordMember;
					if (!member) continue;

					await player.makeRoleApiCall(
						newRank.roleId && member.roles.cache.has(newRank.roleId)
							? []
							: [ newRank.roleId ],
						[ ...member.roles.cache.keys() ].filter(roleId => roleId !== newRank.roleId && automatedRanks.some(rank => rank.roleId === roleId)),
						'synced with in game rank',
					);

					continue;
				}

				// player already has the correct rank
				if (oldRank?.priority === newRank.priority) continue;

				// set player to the correct rank
				await chatBridge.minecraft.command({
					command: `g setrank ${player.ign} ${newRank.name}`,
					responseRegExp: setRank(player.ign, oldRank?.name, newRank.name),
					rejectOnTimeout: true,
				});
			}
		} catch (error) {
			logger.error(error);
		}
	}

	/**
	 * the name of the guild
	 */
	toString() {
		return this.name;
	}
};
