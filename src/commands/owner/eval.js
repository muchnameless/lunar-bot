/* eslint-disable no-unused-vars */
import { SlashCommandBuilder } from '@discordjs/builders';
import Discord, { MessageEmbed, MessageActionRow, MessageButton, Permissions, Util, Constants } from 'discord.js';
import { setTimeout as sleep } from 'timers/promises';
import fetch from 'node-fetch';
import similarity from 'jaro-winkler';
import ms from 'ms';
import util from 'util';
import * as constants from '../../constants/index.js';
import { cache } from '../../api/cache.js';
import { hypixel } from '../../api/hypixel.js';
import { imgur } from '../../api/imgur.js';
import { mojang } from '../../api/mojang.js';
import * as botUtil from '../../util/index.js';
import * as functions from '../../functions/index.js';
import { SlashCommand } from '../../structures/commands/SlashCommand.js';
/* eslint-enable no-unused-vars */

const { COMMAND_KEY, EDIT_MESSAGE_EMOJI, EMBED_MAX_CHARS } = constants;
const { ChannelUtil, InteractionUtil } = botUtil;
const { logger, splitForEmbedFields } = functions;


export default class EvalCommand extends SlashCommand {
	constructor(context) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('executes js code')
				.addStringOption(option => option
					.setName('input')
					.setDescription('js code to evaluate')
					.setRequired(true),
				)
				.addIntegerOption(option => option
					.setName('inspect')
					.setDescription('util.inspect depth on the output')
					.setRequired(false),
				)
				.addBooleanOption(option => option
					.setName('async')
					.setDescription('wrap the code in an async IIFE')
					.setRequired(false),
				),
			cooldown: 0,
		});
	}

	/**
	 * replaces the client's token in 'text' and escapes ` and @mentions
	 * @param {*} input
	 * @param {number} [depth=1]
	 */
	#cleanOutput(input, depth = 1) {
		return (typeof input === 'string' ? input : util.inspect(input, { depth }))
			.replace(/`/g, '`\u200b')
			.replace(/@/g, '@\u200b')
			.replace(new RegExp(this.client.token, 'gi'), '****');
	}

	/**
	 * @param {import('discord.js').CommandInteraction | import('discord.js').ButtonInteraction} interaction
	 * @param {string} input
	 * @param {boolean} [isAsync]
	 * @param {number} [inspectDepth=0]
	 */
	async #eval(interaction, input, isAsync = /\bawait\b/.test(input), inspectDepth = 0) {
		if (interaction.user.id !== this.client.ownerId) throw new Error('eval is restricted to the bot owner');

		/* eslint-disable no-unused-vars */
		const { client, config } = this;
		const { channel, channel: ch, guild, guild: g, user, user: author, member, member: m } = interaction;
		const { lgGuild, chatBridge, hypixelGuilds, players, taxCollectors, db } = client;
		const reply = InteractionUtil.reply.bind(InteractionUtil, interaction);
		/* eslint-enable no-unused-vars */

		const responseEmbed = this.client.defaultEmbed
			.setFooter(interaction.guild?.me.displayName ?? this.client.user.username, this.client.user.displayAvatarURL());

		for (const [ index, inputPart ] of splitForEmbedFields(input, 'js').entries()) {
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
			const OUTPUT_ARRAY = splitForEmbedFields(this.#cleanOutput(evaled, inspectDepth), 'js');
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

			for (const [ index, value ] of splitForEmbedFields(this.#cleanOutput(error), 'xl').entries()) {
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
	 * @param {import('discord.js').ContextMenuInteraction} interaction
	 */
	async runMessage(interaction) {
		const INPUT = interaction.options.getMessage('message').content;

		if (!INPUT) return await InteractionUtil.reply(interaction, {
			content: 'no content to evaluate',
			ephemeral: true,
		});

		const IS_ASYNC = /\bawait\b/.test(INPUT);
		const INSPECT_DEPTH = this.config.get('EVAL_INSPECT_DEPTH');
		const row = new MessageActionRow()
			.addComponents(
				new MessageButton()
					.setCustomId(`${COMMAND_KEY}:${this.name}:${IS_ASYNC}:${INSPECT_DEPTH}`)
					.setEmoji(EDIT_MESSAGE_EMOJI)
					.setStyle(Constants.MessageButtonStyles.SECONDARY),
			);

		return await InteractionUtil.reply(interaction, {
			embeds: await this.#eval(
				interaction,
				INPUT,
				IS_ASYNC,
				INSPECT_DEPTH,
			),
			components: [ row ],
		});
	}

	/**
	 * execute the command
	 * @param {import('discord.js').ButtonInteraction} interaction
	 */
	async runButton(interaction) {
		if (interaction.user.id !== this.client.ownerId) return await InteractionUtil.reply(interaction, {
			content: 'this command is restricted to the bot owner',
			ephemeral: true,
		});

		if (!ChannelUtil.botPermissions(interaction.channel).has(Permissions.FLAGS.VIEW_CHANNEL)) return await InteractionUtil.reply(interaction, {
			content: `missing VIEW_CHANNEL permissions in ${interaction.channel ?? 'this channel'}`,
			ephemeral: true,
		});

		const [ , , async, inspectDepth ] = interaction.customId.split(':');

		try {
			const collected = await interaction.channel.awaitMessages({
				filter: msg => msg.author.id === interaction.user.id,
				max: 1,
				time: 300 * 1_000,
				errors: [ 'time' ],
			});

			return await InteractionUtil.update(interaction, {
				embeds: await this.#eval(
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
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async runSlash(interaction) {
		let indentationCount = 0;

		const INPUT = interaction.options.getString('input', true)
			.replace(/(?<=(?<!\$|]|\)|\\u){)/g, '\n') // insert new line for new scopes if not in template strings
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
		const row = new MessageActionRow()
			.addComponents(
				new MessageButton()
					.setCustomId(`${COMMAND_KEY}:${this.name}:${IS_ASYNC}:${INSPECT_DEPTH}`)
					.setEmoji(EDIT_MESSAGE_EMOJI)
					.setStyle(Constants.MessageButtonStyles.SECONDARY),
			);

		return await InteractionUtil.reply(interaction, {
			embeds: await this.#eval(
				interaction,
				INPUT,
				IS_ASYNC,
				INSPECT_DEPTH,
			),
			components: [ row ],
		});
	}
}
