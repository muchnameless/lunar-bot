'use strict';

/* eslint-disable no-unused-vars */
const Discord = require('discord.js');
const _ = require('lodash');
const similarity = require('jaro-winkler');
const ms = require('ms');
const util = require('util');
const { EMBED_MAX_CHARS } = require('../../constants/discord');
const { CHANNEL_FLAGS } = require('../../constants/bot');
const { EDIT_MESSAGE } = require('../../constants/emojiCharacters');
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
			description: 'executes js code',
			options: [{
				name: 'input',
				type: Discord.Constants.ApplicationCommandOptionTypes.STRING,
				description: 'code input',
				required: true,
			}, {
				name: 'inspect',
				type: Discord.Constants.ApplicationCommandOptionTypes.INTEGER,
				description: 'util.inspect depth on the output',
				required: false,
			}, {
				name: 'async',
				type: Discord.Constants.ApplicationCommandOptionTypes.BOOLEAN,
				description: 'wrap the code in an async IIFE',
				required: false,
			}],
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
	 * @param {import('../../structures/extensions/CommandInteraction') | import('../../structures/extensions/ButtonInteraction')} ctx
	 * @param {string} input
	 * @param {boolean} [isAsync]
	 * @param {number} [inspectDepth=0]
	 */
	async eval(ctx, input, isAsync = /\bawait\b/.test(input), inspectDepth = 0) {
		if (ctx.user.id !== this.client.ownerId) throw new Error('eval is restricted to the bot owner');

		/* eslint-disable no-unused-vars */
		const { client, config } = this;
		const { MessageEmbed } = Discord;
		const { channel, channel: ch, guild, guild: g, author, user, member } = ctx;
		const { lgGuild, chatBridge, hypixelGuilds, players, taxCollectors, db } = client;
		/* eslint-enable no-unused-vars */

		const responseEmbed = this.client.defaultEmbed
			.setFooter(ctx.guild?.me.displayName ?? this.client.user.username, this.client.user.displayAvatarURL());

		for (const [ index, inputPart ] of functionsUtil.splitForEmbedFields(input, 'js').entries()) {
			responseEmbed.addFields({
				name: index
					? '\u200b'
					: isAsync
						? 'Async Input'
						: 'Input',
				value: inputPart,
			});
		}

		try {
			let isPromise;

			const hrStart = process.hrtime();

			// eval args
			let evaled = isAsync
				? eval(
					`(async () => {
						${input}
					})()`)
				: eval(input);

			if ((isPromise = evaled instanceof Promise)) evaled = await evaled;

			const hrStop = process.hrtime(hrStart);
			const OUTPUT_ARRAY = functionsUtil.splitForEmbedFields(this.cleanOutput(evaled, inspectDepth), 'js');
			const INFO = `d.js ${Discord.version} • type: \`${isPromise ? `Promise<${typeof evaled}>` : typeof evaled}\` • time taken: \`${((hrStop[0] * 1e9) + hrStop[1]) / 1e6} ms\``;

			// add output fields till embed character limit is reached
			for (const [ index, value ] of OUTPUT_ARRAY.entries()) {
				const name = index ? '\u200b' : 'Output';

				if (responseEmbed.length + INFO.length + 1 + name.length + value.length > EMBED_MAX_CHARS) break;

				responseEmbed.addFields({ name, value });
			}

			responseEmbed.addFields({
				name: '\u200b',
				value: INFO,
			});

			return [ responseEmbed ];
		} catch (error) {
			logger.error('[EVAL ERROR]', error);

			const FOOTER = `d.js ${Discord.version} • type: \`${typeof error}\``;

			for (const [ index, value ] of functionsUtil.splitForEmbedFields(this.cleanOutput(error), 'xl').entries()) {
				const name = index ? '\u200b' : 'Error';

				if (responseEmbed.length + FOOTER.length + 1 + name.length + value.length > EMBED_MAX_CHARS) break;

				responseEmbed.addFields({ name, value });
			}

			responseEmbed.addFields({
				name: '\u200b',
				value: FOOTER,
			});

			return [ responseEmbed ];
		}
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/ButtonInteraction')} interaction
	 */
	async runButton(interaction) {
		if (interaction.user.id !== this.client.ownerId) return interaction.reply({
			content: 'this command is restricted to the bot owner',
			ephemeral: true,
		});

		if (!interaction.channel?.botPermissions.has(Discord.Permissions.FLAGS.VIEW_CHANNEL)) return interaction.reply({
			content: `missing VIEW_CHANNEL permissions in ${interaction.channel ?? 'this channel'}`,
			ephemeral: true,
		});

		interaction.deferUpdate();

		const { groups: { async, inspectDepth } } = interaction.customId.match(/EVAL:(?<async>.+):(?<inspectDepth>.+)/);

		try {
			const collected = await interaction.channel.awaitMessages({
				filter: msg => msg.author.id === interaction.user.id,
				max: 1,
				time: 300 * 1_000,
				errors: [ 'time' ],
			});

			return interaction.update({
				embeds: await this.eval(
					interaction,
					collected.first().content,
					async === 'true' || undefined,
					Number(inspectDepth),
				),
			});
		} catch (error) {
			return logger.error(error);
		}
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) {
		interaction.defer();

		let indentationCount = 0;

		const INPUT = interaction.options.getString('input', true)
			.replace(/(?<=(?<!\$|\\u){)/g, '\n') // insert new line for new scopes if not in template strings
			.split(/; *|\n/)
			.map((line) => { // add indentation
				let indentation = '';

				indentationCount -= line.match(/}/g)?.length ?? 0;

				for (let i = 0; i < indentationCount; ++i) indentation += '  ';

				indentationCount += line.match(/{/g)?.length ?? 0;

				return `${indentation}${line}`;
			})
			.reduce((acc, cur) => `${acc}${acc ? '\n' : ''}${cur}${cur.endsWith('{') ? '' : ';'}`, '');
		const IS_ASYNC = interaction.options.getBoolean('async') ?? /\bawait\b/.test(INPUT);
		const INSPECT_DEPTH = interaction.options.getInteger('inspect') ?? this.config.get('EVAL_INSPECT_DEPTH');
		const row = new Discord.MessageActionRow()
			.addComponents(
				new Discord.MessageButton()
					.setCustomId(`EVAL:${IS_ASYNC}:${INSPECT_DEPTH}`)
					.setEmoji(EDIT_MESSAGE)
					.setStyle(Discord.Constants.MessageButtonStyles.SECONDARY),
			);

		return interaction.reply({
			embeds: await this.eval(
				interaction,
				INPUT,
				IS_ASYNC,
				INSPECT_DEPTH,
			),
			components: [ row ],
		});
	}
};
