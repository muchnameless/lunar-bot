import { SlashCommandBuilder } from '@discordjs/builders';
import Discord, { MessageEmbed, MessageActionRow, MessageButton, Permissions, Util, Constants } from 'discord.js';
MessageEmbed; Util; // unused imports are 'used' so that tsc doesn't remove them
import { setTimeout as sleep } from 'node:timers/promises';
sleep;
import { Stopwatch } from '@sapphire/stopwatch';
import { Type } from '@sapphire/type';
import fetch from 'node-fetch';
fetch;
import similarity from 'jaro-winkler';
similarity;
import ms from 'ms';
ms;
import util from 'node:util';
import * as constants from '../../constants';
import { cache } from '../../api/cache';
cache;
import { hypixel } from '../../api/hypixel';
hypixel;
import { imgur } from '../../api/imgur';
imgur;
import { mojang } from '../../api/mojang';
mojang;
import { maro } from '../../api/maro';
maro;
import * as botUtil from '../../util';
import * as functions from '../../functions';
import { SlashCommand } from '../../structures/commands/SlashCommand';
import type { CommandInteraction, ContextMenuInteraction, ButtonInteraction } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';
import type { InteractionUtilReplyOptions } from '../../util/InteractionUtil';
import { minutes } from '../../functions';


const { COMMAND_KEY, EDIT_MESSAGE_EMOJI, EMBED_MAX_CHARS } = constants;
const { ChannelUtil, InteractionUtil } = botUtil;
const { logger, splitForEmbedFields } = functions;


export default class EvalCommand extends SlashCommand {
	constructor(context: CommandContext) {
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
	 * @param input
	 * @param depth
	 */
	#cleanOutput(input: unknown, depth = 1) {
		return (typeof input === 'string' ? input : util.inspect(input, { depth }))
			.replaceAll('`', '`\u200B')
			.replaceAll('@', '@\u200B')
			.replace(new RegExp(this.client.token!, 'gi'), '****');
	}

	/**
	 * @param interaction
	 * @param input
	 * @param isAsync
	 * @param inspectDepth
	 */
	async #eval(interaction: CommandInteraction | ButtonInteraction, input: string, isAsync = /\bawait\b/.test(input), inspectDepth = 0) {
		if (interaction.user.id !== this.client.ownerId) throw new Error('eval is restricted to the bot owner');

		/* eslint-disable @typescript-eslint/no-unused-vars */
		const { client, config } = this;
		const { channel, channel: ch, guild, guild: g, user, user: author, member, member: m } = interaction;
		const { lgGuild, chatBridge, hypixelGuilds, players, taxCollectors, db } = client;
		const me = (guild ?? lgGuild)?.me ?? null;
		const reply = (options: string | InteractionUtilReplyOptions) => InteractionUtil.reply(interaction,
			typeof options === 'string'
				? { content: options, ephemeral: false }
				: { ephemeral: false, ...options },
		);
		/* eslint-enable @typescript-eslint/no-unused-vars */

		const responseEmbed = this.client.defaultEmbed
			.setFooter(me?.displayName ?? this.client.user!.username, (me ?? this.client.user!).displayAvatarURL());

		for (const [ index, inputPart ] of splitForEmbedFields(input, 'ts').entries()) {
			responseEmbed.addFields({
				name: index
					? '\u200B'
					: (isAsync
						? 'Async Input'
						: 'Input'),
				value: inputPart,
			});
		}

		const stopwatch = new Stopwatch();

		try {
			stopwatch.restart();

			// eval args
			let evaled = isAsync
				? eval(
					`(async () => {
						${input}
					})()`)
				: eval(input);

			stopwatch.stop();

			const type = new Type(evaled);

			if (evaled instanceof Promise) {
				stopwatch.start();
				evaled = await evaled;
				stopwatch.stop();
			}

			const OUTPUT_ARRAY = splitForEmbedFields(this.#cleanOutput(evaled, inspectDepth), 'ts');
			const INFO = `d.js ${Discord.version} • type: \`${type}\` • time taken: \`${stopwatch}\``;

			// add output fields till embed character limit is reached
			for (const [ index, value ] of OUTPUT_ARRAY.entries()) {
				const name = index ? '\u200B' : 'Output';

				if (responseEmbed.length + INFO.length + 1 + name.length + value.length > EMBED_MAX_CHARS) break;

				responseEmbed.addFields({ name, value });
			}

			responseEmbed.addFields({
				name: '\u200B',
				value: INFO,
			});

			return [ responseEmbed ];
		} catch (error) {
			stopwatch.stop();

			logger.trace(error, 'eval error');

			const type = new Type(error);
			const FOOTER = `d.js ${Discord.version} • type: \`${type}\` • time taken: \`${stopwatch}\``;

			for (const [ index, value ] of splitForEmbedFields(this.#cleanOutput(error), 'xl').entries()) {
				const name = index ? '\u200B' : 'Error';

				if (responseEmbed.length + FOOTER.length + 1 + name.length + value.length > EMBED_MAX_CHARS) break;

				responseEmbed.addFields({ name, value });
			}

			responseEmbed.addFields({
				name: '\u200B',
				value: FOOTER,
			});

			return [ responseEmbed ];
		}
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async runMessage(interaction: ContextMenuInteraction) {
		const INPUT = interaction.options.getMessage('message')!.content;

		if (!INPUT) return InteractionUtil.reply(interaction, {
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

		return InteractionUtil.reply(interaction, {
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
	 * @param interaction
	 */
	override async runButton(interaction: ButtonInteraction) {
		if (interaction.user.id !== this.client.ownerId) return InteractionUtil.reply(interaction, {
			content: 'this command is restricted to the bot owner',
			ephemeral: true,
		});

		const { channel } = interaction;

		if (!ChannelUtil.botPermissions(channel)?.has(Permissions.FLAGS.VIEW_CHANNEL)) return InteractionUtil.reply(interaction, {
			content: `missing VIEW_CHANNEL permissions in ${interaction.channel ?? 'this channel'}`,
			ephemeral: true,
		});

		const [ , , async, inspectDepth ] = interaction.customId.split(':');

		try {
			const collected = await channel!.awaitMessages({
				filter: msg => msg.author.id === interaction.user.id,
				max: 1,
				time: minutes(5),
				errors: [ 'time' ],
			});

			return InteractionUtil.update(interaction, {
				embeds: await this.#eval(
					interaction,
					collected.first()!.content,
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
	 * @param interaction
	 */
	override async runSlash(interaction: CommandInteraction) {
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

		return InteractionUtil.reply(interaction, {
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
