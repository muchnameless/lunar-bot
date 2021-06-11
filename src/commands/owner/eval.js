'use strict';

/* eslint-disable no-unused-vars */
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
const SlashCommand = require('../../structures/commands/SlashCommand');
const logger = require('../../functions/logger');
/* eslint-enable no-unused-vars */


module.exports = class EvalCommand extends SlashCommand {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'call js native eval-function on the args',
			options: [{
				name: 'input',
				type: Discord.Constants.ApplicationCommandOptionTypes.STRING,
				description: 'code input',
				required: true,
			}, {
				name: 'async',
				type: Discord.Constants.ApplicationCommandOptionTypes.BOOLEAN,
				description: 'wrap the code in an async IIFE',
				required: false,
			}, {
				name: 'inspect',
				type: Discord.Constants.ApplicationCommandOptionTypes.INTEGER,
				description: 'util.inspect depth on the output',
				required: false,
			}],
			defaultPermission: true,
			cooldown: 0,
		});
	}

	/**
	 * replaces the client's token in 'text' and escapes ` and @mentions
	 * @param {*} input
	 * @param {number} [depth=1]
	 */
	cleanOutput(input, depth = 1) {
		return (typeof input === 'string' ? input : util.inspect(input, { depth }))
			.replace(/`/g, '`\u200b')
			.replace(/@/g, '@\u200b')
			.replace(new RegExp(this.client.token, 'gi'), '****');
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) {
		/* eslint-disable no-unused-vars */
		const { client, config } = this;
		const { MessageEmbed } = Discord;
		const { trim, splitForEmbedFields, removeFlagsFromArray } = functionsUtil;
		const { channel, channel: ch, guild, guild: g, author, user, member } = interaction;
		const { lgGuild, chatBridge, hypixelGuilds, players, taxCollectors, db } = client;
		/* eslint-enable no-unused-vars */

		const INPUT = interaction.options.get('input')?.value;
		const IS_ASYNC = interaction.options.get('async')?.value ?? false;
		const INSPECT_DEPTH = interaction.options.get('inspect')?.value ?? 0;
		const inputArray = splitForEmbedFields(INPUT, 'js');
		const responseEmbed = this.client.defaultEmbed
			.setFooter(`${guild?.me.displayName ?? client.user.username}`, client.user.displayAvatarURL());

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
				? eval(
					`(async () => {
						${INPUT}
					})()`)
				: eval(INPUT);

			if ((isPromise = evaled instanceof Promise)) evaled = await evaled;

			const hrStop = process.hrtime(hrStart);
			const OUTPUT_ARRAY = splitForEmbedFields(this.cleanOutput(evaled, INSPECT_DEPTH), 'js');
			const INFO = `d.js ${Discord.version} • type: \`${isPromise ? `Promise<${typeof evaled}>` : typeof evaled}\` • time taken: \`${((hrStop[0] * 1e9) + hrStop[1]) / 1e6} ms\``;

			// add output fields till embed character limit is reached
			for (const [ index, value ] of OUTPUT_ARRAY.entries()) {
				const name = index ? '\u200b' : 'Output';

				if (responseEmbed.length + INFO.length + 1 + name.length + value.length > EMBED_MAX_CHARS) break;

				responseEmbed.addField(name, value);
			}

			responseEmbed.addField('\u200b', INFO);

			return await interaction.reply({
				embeds: [
					responseEmbed,
				],
			});
		} catch (error) {
			logger.error('[EVAL ERROR]', error);

			const FOOTER = `d.js ${Discord.version} • type: \`${typeof error}\``;

			for (const [ index, value ] of splitForEmbedFields(this.cleanOutput(error), 'xl').entries()) {
				const name = index ? '\u200b' : 'Error';

				if (responseEmbed.length + FOOTER.length + 1 + name.length + value.length > EMBED_MAX_CHARS) break;

				responseEmbed.addField(name, value);
			}

			responseEmbed.addField('\u200b', FOOTER);

			return interaction.reply({
				embeds: [
					responseEmbed,
				],
			});
		}
	}
};
