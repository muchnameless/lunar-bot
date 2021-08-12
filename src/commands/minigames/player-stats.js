'use strict';

const { Formatters, Constants } = require('discord.js');
const { oneLine } = require('common-tags');
const { getPlayerRank, getNetworkLevel } = require('@zikeji/hypixel');
const { getUuidAndIgn } = require('../../functions/input');
const hypixel = require('../../api/hypixel');
const BaseStatsCommand = require('./~base-stats-command');
const logger = require('../../functions/logger');


module.exports = class PlayerStatsCommand extends BaseStatsCommand {
	constructor(data) {
		super(
			data,
			{
				aliases: [],
				description: 'shows a player\'s hypixel stats',
				options: [{
					name: 'ign',
					type: Constants.ApplicationCommandOptionTypes.STRING,
					description: 'IGN | UUID',
					required: false,
				}],
				cooldown: 0,
			},
			{
				aliases: [ 'player' ],
				args: false,
				usage: '<`IGN`>',
			},
		);
	}

	/**
	 * @param {import('discord.js').CommandInteraction | import('../../structures/chat_bridge/HypixelMessage')} ctx
	 * @param {string} [ignOrUuid]
	 */
	async _fetchData(ctx, ignOrUuid) { // eslint-disable-line class-methods-use-this
		const { uuid, ign } = await getUuidAndIgn(ctx, ignOrUuid);
		const [ playerData, guildData, friendsData, statusData ] = await Promise.all([
			hypixel.player.uuid(uuid),
			hypixel.guild.player(uuid),
			hypixel.friends.uuid(uuid),
			hypixel.status.uuid(uuid),
		]);

		return {
			ign,
			playerData,
			guildData,
			friendsData,
			statusData,
		};
	}

	/**
	 * @typedef {object} FetchedData
	 * @property {string} ign
	 * @property {import('@zikeji/hypixel').Components.Schemas.Player} playerData
	 * @property {import('@zikeji/hypixel').Components.Schemas.Guild} guildData
	 * @property {import('@zikeji/hypixel').Components.Schemas.PlayerFriendsData} friendsData
	 * @property {import('@zikeji/hypixel').Components.Schemas.Session} statusData
	 */

	/**
	 * @param {FetchedData} param0
	 */
	_generateReply({ ign, playerData, guildData, friendsData, statusData }) {
		try {
			const { _id, lastLogin, achievementPoints = 0, karma = 0 } = playerData ?? {};

			if (!_id) return `${ign} never logged into hypixel`;

			const { cleanName: RANK_NAME } = getPlayerRank(playerData);
			const level = Number(getNetworkLevel(playerData).preciseLevel.toFixed(2));

			return oneLine`
				${ign}:
				rank: ${RANK_NAME},
				guild: ${guildData?.name ?? 'none'},
				status: ${statusData.online ? 'online' : 'offline'},
				friends: ${this.client.formatNumber(friendsData?.length ?? 0)},
				level: ${level},
				achievement points: ${this.client.formatNumber(achievementPoints)},
				karma: ${this.client.formatNumber(karma)},
				first joined: ${Formatters.time(parseInt(_id.slice(0, 8), 16))},
				last joined: ${Formatters.time(new Date(lastLogin))}
			`;
		} catch (error) {
			logger.error('[PLAYER STATS CMD]', error);

			return `${error}`;
		}
	}
};
