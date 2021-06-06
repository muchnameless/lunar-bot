'use strict';

const { oneLine } = require('common-tags');
const { getPlayerRank, getNetworkLevel } = require('@zikeji/hypixel');
const { getUuidAndIgn } = require('../../functions/commands/input');
const hypixel = require('../../api/hypixel');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class PlayerCommand extends Command {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [ 'player' ],
			description: 'shows a player\'s hypixel stats',
			args: false,
			usage: '<`IGN`>',
			cooldown: 1,
		});
	}

	/**
	 * @param {number} timestamp
	 */
	static timestampToDate = timestamp => new Date(timestamp).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });

	/**
	 * @param {string} objectId
	 */
	static objectIdToDate = objectId => new Date(parseInt(objectId.slice(0, 8), 16) * 1_000);

	/**
	 * @param {string} ign
	 * @param {import('@zikeji/hypixel').Components.Schemas.Player} player
	 * @param {import('@zikeji/hypixel').Components.Schemas.Guild} guild
	 * @param {import('@zikeji/hypixel').Components.Schemas.PlayerFriendsData[]} friends
	 * @param {import('@zikeji/hypixel').Components.Schemas.Session} status
	 */
	generateReply(ign, player, guild, friends, status) {
		const { cleanName: RANK_NAME } = getPlayerRank(player);
		const level = Number(getNetworkLevel(player).preciseLevel.toFixed(2));
		const { _id, lastLogin, achievementPoints = 0, karma = 0 } = player;

		return oneLine`
			${ign}:
			rank: ${RANK_NAME},
			guild: ${guild?.name ?? 'none'},
			status: ${status.online ? 'online' : 'offline'},
			friends: ${this.client.formatNumber(friends?.length ?? 0)},
			level: ${level},
			achievement points: ${this.client.formatNumber(achievementPoints)},
			karma: ${this.client.formatNumber(karma)},
			first joined: ${PlayerCommand.timestampToDate(PlayerCommand.objectIdToDate(_id))},
			last joined: ${PlayerCommand.timestampToDate(lastLogin)}
		`;
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(message, args, flags, rawArgs) { // eslint-disable-line no-unused-vars
		try {
			const { uuid, ign } = await getUuidAndIgn(message, args);
			const [ player, guild, friends, status ] = await Promise.all([
				hypixel.player.uuid(uuid),
				hypixel.guild.player(uuid),
				hypixel.friends.uuid(uuid),
				hypixel.status.uuid(uuid),
			]);

			return message.reply(this.generateReply(ign, player, guild, friends, status));
		} catch (error) {
			logger.error(`[${this.name.toUpperCase()} CMD]`, error);

			return message.reply(`${error}`);
		}
	}
};
