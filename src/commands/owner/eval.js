'use strict';

/* eslint-disable no-unused-vars */
const { stripIndents } = require('common-tags');
const Discord = require('discord.js');
const _ = require('lodash');
const similarity = require('jaro-winkler');
const ms = require('ms');
const util = require('util');
const { EMBED_MAX_CHARS } = require('../../constants/discord');
const { CHANNEL_FLAGS } = require('../../constants/bot');
const cache = require('../../api/cache');
const skyblock = require('../../constants/skyblock');
const functionsUtil = require('../../functions/util');
const functionsFiles = require('../../functions/files');
const hypixel = require('../../api/hypixel');
const senither = require('../../api/senither');
const mojang = require('../../api/mojang');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');
/* eslint-enable no-unused-vars */


module.exports = class EvalCommand extends Command {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [ 'e', 'ev' ],
			description: 'call js native eval-function on the args',
			args: true,
			usage: stripIndents`
				<\`-a\`|\`--async\` (requires explicit return statement)> <\`i\`|\`inspect\` to call util.format on the result> [\`expression\`]

				available vars:
				from d.js: Util, MessageEmbed, message / msg, client, ch(annel), g(uild), author, member
				from client: (main) chatBridge, hypixelGuilds, players, taxCollectors, db

				required:
				Discord, lodash, similarity, ms, util,
				skyblock (constants), functionsUtil, functionsFiles, hypixel, mojang, lgGuild
			`,
			cooldown: 0,
		});
	}

	/**
	 * replaces the client's token in 'text' and escapes ` and @mentions
	 * @param {import('../structures/LunarClient')} client discord client to get the token from
	 * @param {string} text to clean
	 */
	cleanOutput(text) {
		return (typeof text === 'string' ? text : util.inspect(text, { depth: 1 }))
			.replace(/`/g, '`\u200b')
			.replace(/@/g, '@\u200b')
			.replace(new RegExp(this.client.token, 'gi'), '****');
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(message, args, flags, rawArgs) { // eslint-disable-line no-unused-vars
		/* eslint-disable no-unused-vars */
		const { client, config } = this;
		const { Util, MessageEmbed } = Discord;
		const { trim, splitForEmbedFields, removeFlagsFromArray } = functionsUtil;
		const { channel, channel: ch, guild, guild: g, author, member } = message;
		const msg = message;
		const { lgGuild, chatBridge, hypixelGuilds, players, taxCollectors, db } = client;
		/* eslint-enable no-unused-vars */
		const asyncFlags = [ 'a', 'async' ];
		const inspectFlags = [ 'i', 'inspect' ];
		const totalFlags = [ ...CHANNEL_FLAGS, ...asyncFlags, ...inspectFlags ];
		const IS_ASYNC = flags.some(flag => asyncFlags.includes(flag));
		const SHOULD_INSPECT = flags.some(flag => inspectFlags.includes(flag));

		removeFlagsFromArray(rawArgs, totalFlags);

		const INPUT = rawArgs.join(' ');
		const inputArray = splitForEmbedFields(INPUT, 'js');
		const responseEmbed = new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
			.setFooter(`${guild ? guild.me.displayName : client.user.username}`, client.user.displayAvatarURL());

		for (const [ index, input ] of inputArray.entries()) {
			responseEmbed.addField(
				index
					? '\u200b'
					: IS_ASYNC
						? 'Async Input'
						: 'Input',
				input,
			);
		}

		try {
			let isPromise;

			const hrStart = process.hrtime();

			// eval args
			let evaled = IS_ASYNC
				? await eval(
					`(async () => {
						${INPUT}
					})()`)
				: eval(INPUT);

			if ((isPromise = evaled instanceof Promise)) evaled = await evaled;

			const hrStop = process.hrtime(hrStart);
			const OUTPUT_ARRAY = splitForEmbedFields(this.cleanOutput(SHOULD_INSPECT ? util.format(evaled) : evaled), 'js');
			const INFO = `d.js ${Discord.version} • type: \`${isPromise ? `Promise<${typeof evaled}>` : typeof evaled}\` • time taken: \`${((hrStop[0] * 1e9) + hrStop[1]) / 1e6} ms\``;

			// add output fields till embed character limit is reached
			for (const [ index, value ] of OUTPUT_ARRAY.entries()) {
				const name = index ? '\u200b' : `Output${SHOULD_INSPECT ? ' (inspected)' : ''}`;

				if (responseEmbed.length + INFO.length + 1 + name.length + value.length > EMBED_MAX_CHARS) break;

				responseEmbed.addField(name, value);
			}

			await message.reply(responseEmbed
				.addField('\u200b', INFO)
				.setTimestamp(),
			);
		} catch (error) {
			logger.error(`[EVAL ERROR]: ${error?.name}: ${error?.message}`);

			const FOOTER = `d.js ${Discord.version} • type: \`${typeof error}\``;

			for (const [ index, value ] of splitForEmbedFields(this.cleanOutput(error), 'xl').entries()) {
				const name = index ? '\u200b' : 'Error';

				if (responseEmbed.length + FOOTER.length + 1 + name.length + value.length > EMBED_MAX_CHARS) break;

				responseEmbed.addField(name, value);
			}

			message.reply(responseEmbed
				.addField('\u200b', FOOTER)
				.setTimestamp(),
			);
		}
	}
};
