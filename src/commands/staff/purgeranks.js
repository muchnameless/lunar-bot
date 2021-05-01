'use strict';

const { setRank: { regExp: setRank } } = require('../../structures/chat_bridge/constants/commandResponses');
const RankIssuesCommand = require('./rankissues');
const logger = require('../../functions/logger');


module.exports = class PurgeRanksCommand extends RankIssuesCommand {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [],
			description: 'demote every player who doesn\'t meet the reqs for their current guild rank',
			cooldown: 60,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(message, args, flags, rawArgs) { // eslint-disable-line no-unused-vars
		/**
		 * @type {import('../../structures/database/models/HypixelGuild')}
		 */
		const hypixelGuild = this.client.hypixelGuilds.getFromArray([ ...args, ...flags ]) ?? message.author.player?.guild;

		if (!hypixelGuild) return message.reply('unable to find your guild.');

		const { chatBridge } = hypixelGuild;
		const belowWeightReq = PurgeRanksCommand.getBelowRankReqs(hypixelGuild);
		const BELOW_WEIGHT_REQ_AMOUNT = belowWeightReq.length;

		if (!this.force(flags)) {
			const ANSWER = await message.awaitReply(
				`demote ${BELOW_WEIGHT_REQ_AMOUNT} from ${hypixelGuild.name}?`,
				60,
				{ sameChannel: true },
			);

			if (!this.config.getArray('REPLY_CONFIRMATION').includes(ANSWER?.toLowerCase())) return message.reply(
				'the command has been cancelled.',
				{ sameChannel: true },
			);
		}

		let successCounter = 0;

		for (const { totalWeight, player: { ign } } of belowWeightReq) {
			const NEW_RANK = hypixelGuild.ranks.find(({ weightReq }) => totalWeight >= weightReq)?.name;

			if (!NEW_RANK) {
				logger.error(`[PURGE RANKS]: no new rank for ${ign} (${totalWeight}) found`);
				continue;
			}

			try {
				await chatBridge.command({
					command: `g setrank ${ign} ${args[1]}`,
					responseRegex: setRank(ign, undefined, args[1]),
					rejectOnTimeout: true,
				});

				++successCounter;
			} catch (error) {
				logger.error(`[PURGE RANKS]: ${error}`);
			}
		}

		return message.reply(`purge complete, demoted ${successCounter} / ${BELOW_WEIGHT_REQ_AMOUNT}.`);
	}
};
