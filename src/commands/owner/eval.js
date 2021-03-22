'use strict';

/* eslint-disable no-unused-vars */
const { stripIndents } = require('common-tags');
const Discord = require('discord.js');
const _ = require('lodash');
const similarity = require('jaro-winkler');
const ms = require('ms');
const util = require('util');
const skyblock = require('../../constants/skyblock');
const functionsUtil = require('../../functions/util');
const functionsFiles = require('../../functions/files');
const hypixelMain = require('../../api/hypixel');
const hypixelAux = require('../../api/hypixelAux');
const senither = require('../../api/senither');
const mojang = require('../../api/mojang');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');
/* eslint-enable no-unused-vars */


module.exports = class EvalCommand extends Command {
	constructor(data) {
		super(data, {
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
		const { client } = this;
		const { Util, MessageEmbed } = Discord;
		const { trim } = functionsUtil;
		const { channel, channel: ch, guild, guild: g, author, member } = message;
		const msg = message;
		const { lgGuild, chatBridge, hypixelGuilds, players, taxCollectors, db } = client;
		const asyncFlags = [ 'a', 'async' ];
		const inspectFlags = [ 'i', 'inspect' ];
		const totalFlags = [ 'c', 'ch', 'channel', ...asyncFlags, ...inspectFlags ];
		const IS_ASYNC = flags.some(flag => asyncFlags.includes(flag));
		const SHOULD_INSPECT = flags.some(flag => inspectFlags.includes(flag));
		/* eslint-enable no-unused-vars */

		let i = -1;

		while (++i < rawArgs.length) {
			if (rawArgs[i].startsWith('-') && totalFlags.includes(rawArgs[i].replace(/^-+/, ''))) {
				rawArgs.splice(i, 1);
				--i;
			}
		}

		const INPUT = rawArgs.join(' ');
		const inputArray = Util.splitMessage(Util.escapeCodeBlock(INPUT), { maxLength: 1015, char: '\n' });
		const responseEmbed = new MessageEmbed()
			.setColor(this.config.get('EMBED_BLUE'))
			.setFooter(`${guild ? guild.me.displayName : client.user.username}`, client.user.displayAvatarURL());

		let embedCharacterCount = responseEmbed.footer.text.length;
		let hypixel;

		// eslint-disable-next-line no-unused-vars
		if (message.content.includes('hypixel')) hypixel = functionsUtil.getHypixelClient(true);

		inputArray.forEach((input, index) => {
			responseEmbed.addField(
				index
					? '\u200b'
					: IS_ASYNC
						? 'Async Input'
						: 'Input',
				stripIndents`
					\`\`\`js
					${input}
					\`\`\`
				`,
			);
		});

		embedCharacterCount += responseEmbed.fields.reduce((acc, field) => field.name.length + field.value.length, 0);

		try {
			let isPromise;

			const REPLY_MESSAGE_ID_TEMP = message.replyMessageID;
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
			const OUTPUT_ARRAY = SHOULD_INSPECT
				? (() => {
					try {
						return Util.splitMessage(Util.escapeCodeBlock(this.cleanOutput(util.format(evaled))), { maxLength: 1015, char: '\n' });
					} catch {
						return [ trim(Util.escapeCodeBlock(this.cleanOutput(util.format(evaled))), 1015) ];
					}
				})()
				: (() => {
					try {
						return Util.splitMessage(Util.escapeCodeBlock(this.cleanOutput(evaled)), { maxLength: 1015, char: '\n' });
					} catch {
						return [ trim(Util.escapeCodeBlock(this.cleanOutput(evaled)), 1015) ];
					}
				})();
			const INFO = `d.js ${Discord.version} • type: \`${isPromise ? `Promise<${typeof evaled}>` : typeof evaled}\` • time taken: \`${(((hrStop[0] * 1e9) + hrStop[1])) / 1e6} ms\``;

			message.replyMessageID = REPLY_MESSAGE_ID_TEMP;
			embedCharacterCount += INFO.length;

			// add output fields till embed character limit of 6000 is reached
			for (const [ index, output ] of OUTPUT_ARRAY.entries()) {
				embedCharacterCount += output.length + 9;
				if (embedCharacterCount > 6_000) break;
				responseEmbed.addField(index ? '\u200b' : `Output${SHOULD_INSPECT ? ' (inspected)' : ''}`, `\`\`\`js\n${output}\`\`\``);
			}

			await message.reply(responseEmbed
				.addField('\u200b', INFO)
				.setTimestamp(),
			);
		} catch (error) {
			logger.error(`[EVAL ERROR]: ${error?.name}: ${error?.message}`);

			Util.splitMessage(Util.escapeCodeBlock(this.cleanOutput(error)), { maxLength: 1015, char: '\n' })
				.forEach((output, index) => {
					responseEmbed.addField(index ? '\u200b' : 'Error', `\`\`\`xl\n${output}\`\`\``);
				});

			message.reply(responseEmbed
				.addField('\u200b', `d.js ${Discord.version} • type: \`${typeof error}\``)
				.setTimestamp(),
			);
		}
	}
};
