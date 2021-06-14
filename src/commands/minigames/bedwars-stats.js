'use strict';

const { Constants } = require('discord.js');
const { oneLine } = require('common-tags');
const { getBedwarsLevelInfo } = require('@zikeji/hypixel');
const { getUuidAndIgn } = require('../../functions/input');
const hypixel = require('../../api/hypixel');
const DualCommand = require('../../structures/commands/DualCommand');
const logger = require('../../functions/logger');


module.exports = class BedWarsStatsCommand extends DualCommand {
	constructor(data, param1, param2) {
		super(
			data,
			param1 ?? {
				aliases: [],
				description: 'shows a player\'s BedWars stats',
				options: [{
					name: 'ign',
					type: Constants.ApplicationCommandOptionTypes.STRING,
					description: 'IGN | uuid',
					required: false,
				}],
				defaultPermission: true,
				cooldown: 1,
			},
			param2 ?? {
				aliases: [ 'bwstats' ],
				args: false,
				usage: '<`IGN`>',
			},
		);
	}

	/**
	 * @param {number} kills
	 * @param {number} deaths
	 * @returns {?string}
	 */
	calculateKD(kills, deaths) {
		if (kills == null || deaths == null) return null;
		return this.client.formatDecimalNumber(Math.floor((kills / deaths) * 100) / 100);
	}

	/**
	 * @param {string} ign
	 * @param {import('@zikeji/hypixel').Components.Schemas.Player} data
	 */
	generateReply(ign, data) {
		try {
			const wins = data.stats.Bedwars.wins_bedwars ?? 0;
			const losses = data.stats.Bedwars.losses_bedwars ?? 0;

			return oneLine`
				${ign}:
				BedWars:
				level: ${this.client.formatNumber(getBedwarsLevelInfo(data).level)},
				wins: ${this.client.formatNumber(wins)},
				losses: ${this.client.formatNumber(losses)},
				win rate: ${this.client.formatDecimalNumber(wins / (wins + losses))},
				games played: ${this.client.formatNumber(data.stats.Bedwars.games_played_bedwars ?? 0)},
				final kills: ${this.client.formatNumber(data.stats.Bedwars.final_kills_bedwars ?? 0)},
				final deaths: ${this.client.formatNumber(data.stats.Bedwars.final_deaths_bedwars ?? 0)},
				overall fkdr: ${this.calculateKD(data.stats.Bedwars.final_kills_bedwars, data.stats.Bedwars.final_deaths_bedwars) ?? '-/-'},
				win streak: ${this.client.formatNumber(data.stats.Bedwars.winstreak ?? 0)},
				beds broken: ${this.client.formatNumber(data.stats.Bedwars.beds_broken_bedwars ?? 0)}
			`;
		} catch {
			return `\`${ign}\` has no BedWars stats`;
		}
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction') | import('../../structures/chat_bridge/HypixelMessage')} ctx
	 * @param {string} [ignOrUuid]
	 */
	async _run(ctx, ignOrUuid) {
		try {
			const { uuid, ign } = await getUuidAndIgn(ctx, ignOrUuid);
			const data = await hypixel.player.uuid(uuid);

			return ctx.reply(this.generateReply(ign, data));
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

		return this._run(interaction, interaction.options.get('ign')?.value);
	}

	/**
	 * execute the command
	 * @param {import('../../structures/chat_bridge/HypixelMessage')} message message that triggered the command
	 * @param {string[]} args command arguments
	 */
	async runInGame(message, args) { // eslint-disable-line no-unused-vars
		return this._run(message, ...args);
	}
};
