import { setTimeout as sleep } from 'node:timers/promises';
sleep;
import { Buffer } from 'node:buffer';
import { env } from 'node:process';
import util from 'node:util';
import fs from 'node:fs/promises';
import v8 from 'node:v8';
import { ContextMenuCommandBuilder, embedLength, SlashCommandBuilder } from '@discordjs/builders';
import Discord, {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	Formatters,
	MessageAttachment,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	Util,
} from 'discord.js';
Util; // unused imports are 'used' so that tsc doesn't remove them
import { Routes } from 'discord-api-types/v10';
Routes;
import { Stopwatch } from '@sapphire/stopwatch';
import { Type } from '@sapphire/type';
import { fetch } from 'undici';
fetch;
import ms from 'ms';
ms;
import commonTags from 'common-tags';
commonTags;
import * as constants from '../../constants';
import { redis, hypixel, imgur, mojang } from '../../api';
redis;
hypixel;
imgur;
mojang;
import {
	ChannelUtil,
	EmbedUtil,
	GuildMemberUtil,
	GuildUtil,
	InteractionUtil,
	LeaderboardUtil,
	MessageUtil,
	UserUtil,
} from '../../util';
ChannelUtil;
EmbedUtil;
GuildMemberUtil;
GuildUtil;
LeaderboardUtil;
MessageUtil;
import * as functions from '../../functions';
import * as nwFunctions from '../../structures/networth/functions';
nwFunctions;
import { ApplicationCommand } from '../../structures/commands/ApplicationCommand';
import { calculateItemPrice } from '../../structures/networth/networth';
calculateItemPrice;
import { prices } from '../../structures/networth/prices';
prices;
import { bree } from '../../jobs';
bree;
import { sequelize, sql } from '../../structures/database';
sequelize;
sql;
import { logger } from '../../logger';
import { IGNORED_ERRORS } from '../../process';
IGNORED_ERRORS;
import type {
	ChatInputCommandInteraction,
	ContextMenuCommandInteraction,
	ButtonInteraction,
	Message,
	MessageComponentInteraction,
	ModalSubmitInteraction,
} from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';
import type { InteractionUtilReplyOptions, RepliableInteraction } from '../../util';

const { EMBED_MAX_CHARS, MAX_PLACEHOLDER_LENGTH, UnicodeEmoji } = constants;
const { buildDeleteButton, buildPinButton, buildVisibilityButton, splitForEmbedFields, trim } = functions;

export default class EvalCommand extends ApplicationCommand {
	/**
	 * slightly less than 8 MB
	 */
	MAX_FILE_SIZE = 8_387_600;

	constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder()
				.setDescription('executes js code')
				.addStringOption((option) =>
					option //
						.setName('input')
						.setDescription('js code to evaluate')
						.setRequired(true),
				)
				.addIntegerOption((option) =>
					option //
						.setName('inspect')
						.setDescription('util.inspect depth on the output')
						.setRequired(false),
				)
				.addBooleanOption((option) =>
					option //
						.setName('async')
						.setDescription('wrap the code in an async IIFE')
						.setRequired(false),
				),
			message: new ContextMenuCommandBuilder().setName('Evaluate content'),
			cooldown: 0,
		});
	}

	/**
	 * replaces the client's token in 'text' and escapes `
	 * @param input
	 * @param depth
	 */
	private _cleanOutput(input: unknown, depth: number) {
		let inputString = (typeof input === 'string' ? input : util.inspect(input, { depth }))
			// escape codeblock markdown
			.replaceAll('`', '`\u200B')
			// replace the client token
			.replace(new RegExp(this.client.token!, 'gi'), '***');

		// replace other .env values
		let keys = Object.keys(env);
		keys = keys.slice(keys.indexOf('DISCORD_TOKEN'));

		for (const key of keys) {
			const value = env[key];
			if (!value || !Number.isNaN(Number(value))) continue;

			inputString = inputString.replace(new RegExp(value, 'gi'), '***');
		}

		return inputString;
	}

	/**
	 * returns an attachment trimmed to the max file size
	 * @param content
	 */
	private _getFiles(interaction: RepliableInteraction, content: string) {
		void InteractionUtil.defer(interaction);
		return [new MessageAttachment(Buffer.from(content).slice(0, this.MAX_FILE_SIZE), 'result.ts')];
	}

	/**
	 * gets the original eval input from the result embed
	 * @param message
	 */
	// eslint-disable-next-line class-methods-use-this
	private _getInputFromMessage(message: MessageComponentInteraction['message'] | null) {
		const fields = message?.embeds[0]?.fields;

		if (!fields) throw 'unable to extract the input from the attached message';

		let input = '';

		for (const { name, value } of fields) {
			if (['Output', 'Error'].includes(name)) break;

			input += value.replace(/^```[a-z]*\n|\n?```$/g, '');
		}

		return input;
	}

	/**
	 * @param interaction
	 * @param _input
	 * @param options
	 */
	private async _run(
		interaction: RepliableInteraction,
		_input: string,
		{ isAsync = /\bawait\b/.test(_input), inspectDepth = this.config.get('EVAL_INSPECT_DEPTH') } = {},
	) {
		if (interaction.user.id !== this.client.ownerId) {
			throw `eval is restricted to ${Formatters.userMention(this.client.ownerId)}`;
		}

		/* eslint-disable @typescript-eslint/no-unused-vars */
		const reply = (options: string | InteractionUtilReplyOptions) =>
			InteractionUtil.reply(
				interaction,
				typeof options === 'string'
					? { content: options, ephemeral: false, rejectOnError: true, fetchReply: true }
					: options instanceof EmbedBuilder
					? { embeds: [options], ephemeral: false, rejectOnError: true, fetchReply: true }
					: { ephemeral: false, rejectOnError: true, fetchReply: true, ...options },
			);
		const type = (x: unknown) => new Type(x).toString();
		const inspect = (x: unknown) => util.inspect(x, { depth: inspectDepth, getters: true, showHidden: true });
		const saveHeapdump = () => {
			void InteractionUtil.defer(interaction);
			return fs.writeFile(`${Date.now()}.heapsnapshot`, v8.getHeapSnapshot());
		};
		const i = interaction;
		const { client, config } = this;
		const { channel, channel: ch, guild, guild: g, user, user: author, member, member: m } = interaction;
		const { discordGuilds, hypixelGuilds, players, taxCollectors, db, rest } = client;
		const me = guild?.me ?? null;
		const player = UserUtil.getPlayer(user);
		const p = player;
		const bridges = client.chatBridges.cache;
		/* eslint-enable @typescript-eslint/no-unused-vars */

		const responseEmbed = this.client.defaultEmbed //
			.setFooter({
				text: me?.displayName ?? this.client.user!.username,
				iconURL: (me ?? this.client.user!).displayAvatarURL(),
			});

		// format input
		let input = _input.replace(/(?<=;) *(?!$|\n)/g, '\n').trim();

		if (!input.endsWith(';')) input += ';';

		let toEvaluate: string;

		// wrap input in async IIFE
		if (isAsync) {
			const lines = input.split(';\n');

			for (let index = lines.length - 1; index >= 0; --index) {
				const trimmed = lines[index].trimStart();

				if (!trimmed || ['//', '/*'].some((x) => trimmed.startsWith(x))) continue;
				if (['return ', 'const ', 'let ', 'var ', '}', ')'].some((x) => trimmed.startsWith(x))) break;

				lines[index] = `return ${lines[index]}`;
				break;
			}

			input = lines.join(';\n');
			toEvaluate = `(async () => { ${input} })()`;
		} else {
			toEvaluate = input;
		}

		for (const [index, inputPart] of splitForEmbedFields(input, 'ts').entries()) {
			responseEmbed.addFields({
				name: index ? '\u200B' : isAsync ? 'Async Input' : 'Input',
				value: inputPart,
			});
		}

		const stopwatch = new Stopwatch();

		let files: MessageAttachment[] | undefined;

		try {
			stopwatch.restart();

			// eval args
			let evaled = eval(toEvaluate);

			stopwatch.stop();

			const resultType = new Type(evaled);

			if (evaled instanceof Promise) {
				stopwatch.start();
				evaled = await evaled;
				stopwatch.stop();
			}

			const CLEANED_OUTPUT = this._cleanOutput(evaled, inspectDepth);
			const FOOTER_FIELD = `d.js ${Discord.version} • type: \`${resultType}\` • time taken: \`${stopwatch}\``;

			let length = embedLength(responseEmbed.data) + '\u200B'.length + FOOTER_FIELD.length;

			// add output fields till embed character limit is reached
			for (const [index, value] of splitForEmbedFields(CLEANED_OUTPUT, 'ts').entries()) {
				const name = index ? '\u200B' : 'Output';

				// embed size overflow -> convert output to file
				if ((length += name.length + value.length) > EMBED_MAX_CHARS) {
					// remove result fields
					responseEmbed.spliceFields(responseEmbed.data.fields!.length - index, Number.POSITIVE_INFINITY, {
						name: 'Output',
						value: 'result.ts',
					});
					// add files
					files = this._getFiles(interaction, CLEANED_OUTPUT);
					break;
				}

				responseEmbed.addFields({ name, value });
			}

			responseEmbed.addFields({
				name: '\u200B',
				value: FOOTER_FIELD,
			});
		} catch (error) {
			stopwatch.stop();

			logger.debug(error, '[EVAL ERROR]');

			const errorType = new Type(error);
			const FOOTER_FIELD = `d.js ${Discord.version} • type: \`${errorType}\` • time taken: \`${stopwatch}\``;
			const CLEANED_OUTPUT = this._cleanOutput(error, inspectDepth);

			let length = embedLength(responseEmbed.data) + '\u200B'.length + FOOTER_FIELD.length;

			for (const [index, value] of splitForEmbedFields(CLEANED_OUTPUT, 'xl').entries()) {
				const name = index ? '\u200B' : 'Error';

				// embed size overflow -> convert output to file
				if ((length += name.length + value.length) > EMBED_MAX_CHARS) {
					// remove error fields
					responseEmbed.spliceFields(responseEmbed.data.fields!.length - index, Number.POSITIVE_INFINITY, {
						name: 'Error',
						value: 'result.ts',
					});
					// add files
					files = this._getFiles(interaction, CLEANED_OUTPUT);
					break;
				}

				responseEmbed.addFields({ name, value });
			}

			responseEmbed.addFields({
				name: '\u200B',
				value: FOOTER_FIELD,
			});
		}

		return InteractionUtil.replyOrUpdate(interaction, {
			embeds: [responseEmbed],
			components: [
				new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder()
						.setCustomId(`${this.baseCustomId}:edit:${inspectDepth}`)
						.setEmoji({ name: UnicodeEmoji.EditMessage })
						.setStyle(ButtonStyle.Secondary),
					new ButtonBuilder()
						.setCustomId(`${this.baseCustomId}:repeat:${inspectDepth}`)
						.setEmoji({ name: UnicodeEmoji.Reload })
						.setStyle(ButtonStyle.Secondary),
					buildPinButton(),
					buildVisibilityButton(interaction.user),
					buildDeleteButton(interaction.user),
				),
			],
			files,
		});
	}

	/**
	 * execute the command
	 * @param interaction
	 * @param message
	 */
	override runMessage(interaction: ContextMenuCommandInteraction, { content, author }: Message) {
		if (author.id !== this.client.ownerId) {
			throw `cannot evaluate a message from ${author}`;
		}

		if (!content) {
			throw 'no content to evaluate';
		}

		return this._run(interaction, content);
	}

	/**
	 * execute the command
	 * @param interaction
	 * @param args parsed customId, split by ':'
	 */
	override runButton(interaction: ButtonInteraction, args: string[]) {
		const [subcommand, inspectDepth] = args;

		switch (subcommand) {
			case 'edit':
				return InteractionUtil.showModal(
					interaction,
					new ModalBuilder()
						.setTitle(this.name)
						.setCustomId(interaction.customId)
						.addComponents(
							new ActionRowBuilder<TextInputBuilder>().addComponents(
								new TextInputBuilder()
									.setCustomId('input')
									.setStyle(TextInputStyle.Paragraph)
									.setLabel('Input')
									.setPlaceholder(
										trim(
											interaction.message.embeds[0]?.fields?.[0].value.replace(/^```[a-z]*\n|```$/g, '') ??
												'code to evaluate',
											MAX_PLACEHOLDER_LENGTH,
										),
									)
									.setRequired(false),
							),
							new ActionRowBuilder<TextInputBuilder>().addComponents(
								new TextInputBuilder()
									.setCustomId('inspectDepth')
									.setStyle(TextInputStyle.Short)
									.setLabel('Inspect depth')
									.setPlaceholder(inspectDepth)
									.setRequired(false),
							),
						),
				);

			case 'repeat': {
				const input = this._getInputFromMessage(interaction.message);
				return this._run(interaction, input, { inspectDepth: Number(inspectDepth) });
			}

			default:
				throw new Error(`unknown subcommand '${subcommand}'`);
		}
	}

	/**
	 * execute the command
	 * @param interaction
	 * @param args parsed customId, split by ':'
	 */
	override runModal(interaction: ModalSubmitInteraction, args: string[]) {
		const [subcommand, inspectDepth] = args;

		switch (subcommand) {
			case 'edit':
				return this._run(
					interaction,
					interaction.fields.getTextInputValue('input') ||
						// @ts-expect-error
						this._getInputFromMessage(interaction.message),
					{
						// use parseInt over Number so that 12a is still a valid input
						inspectDepth: Number.parseInt(
							interaction.fields.getTextInputValue('inspectDepth').trim() || inspectDepth,
							10,
						),
					},
				);

			default:
				throw new Error(`unknown subcommand '${subcommand}'`);
		}
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override runSlash(interaction: ChatInputCommandInteraction) {
		return this._run(interaction, interaction.options.getString('input', true), {
			isAsync: interaction.options.getBoolean('async') ?? undefined,
			inspectDepth: interaction.options.getInteger('inspect') ?? undefined,
		});
	}
}
