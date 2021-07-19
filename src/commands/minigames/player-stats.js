'use strict';

const { Constants } = require('discord.js');
const { oneLine } = require('common-tags');
const { getPlayerRank, getNetworkLevel } = require('@zikeji/hypixel');
const { getUuidAndIgn } = require('../../functions/input');
const { timestampToDateMarkdown } = require('../../functions/util');
const hypixel = require('../../api/hypixel');
const DualCommand = require('../../structures/commands/DualCommand');
const logger = require('../../functions/logger');


module.exports = class PlayerCommand extends DualCommand {
	constructor(data) {
		super(
			data,
			{
				aliases: [],
				description: 'shows a player\'s hypixel stats',
				options: [{
					name: 'ign',
					type: Constants.ApplicationCommandOptionTypes.STRING,
					description: 'IGN | uuid',
					required: false,
				}],
				defaultPermission: true,
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
			first joined: ${timestampToDateMarkdown(PlayerCommand.objectIdToDate(_id))},
			last joined: ${timestampToDateMarkdown(lastLogin)}
		`;
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction') | import('../../structures/chat_bridge/HypixelMessage')} ctx
	 * @param {string} [ignOrUuid]
	 */
	async _run(ctx, ignOrUuid) {
		try {
			const { uuid, ign } = await getUuidAndIgn(ctx, ignOrUuid);
			const [ player, guild, friends, status ] = await Promise.all([
				hypixel.player.uuid(uuid),
				hypixel.guild.player(uuid),
				hypixel.friends.uuid(uuid),
				hypixel.status.uuid(uuid),
			]);

			return ctx.reply(this.generateReply(ign, player, guild, friends, status));
		} catch (error) {
			logger.error(`[${this.name.toUpperCase()} CMD]`, error);

			return ctx.reply(`${error}`);
		}
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) {
		interaction.defer();

		return this._run(interaction, interaction.options.getString('ign'));
	}

	/**
	 * execute the command
	 * @param {import('../../structures/chat_bridge/HypixelMessage')} message message that triggered the command
	 */
	async runInGame(message) {
		return this._run(message, ...message.commandData.args);
	}
};
