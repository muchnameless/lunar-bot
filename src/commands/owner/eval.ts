import fs from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import util from 'node:util';
import v8 from 'node:v8';
import { Stopwatch } from '@sapphire/stopwatch';
import { Type } from '@sapphire/type';
import commonTags from 'common-tags';
import Discord, {
	ActionRowBuilder,
	BaseSelectMenuBuilder,
	ButtonBuilder,
	ChannelSelectMenuBuilder,
	ContextMenuCommandBuilder,
	EmbedBuilder,
	MentionableSelectMenuBuilder,
	ModalBuilder,
	RoleSelectMenuBuilder,
	Routes,
	SlashCommandBuilder,
	StringSelectMenuBuilder,
	TextInputBuilder,
	TextInputStyle,
	userMention,
	UserSelectMenuBuilder,
	type ButtonInteraction,
	type ChatInputCommandInteraction,
	type Message,
	type MessageActionRowComponentBuilder,
	type MessageContextMenuCommandInteraction,
	type ModalSubmitInteraction,
} from 'discord.js';
import ms from 'ms';
import { format, type Options as PrettierFormatOptions } from 'prettier';
import { fetch } from 'undici';
import BaseOwnerCommand from './~base.js';
import { redis, hypixel, imgur, mojang } from '#api';
import * as constants from '#constants';
import { sequelize, sql } from '#db';
import * as functions from '#functions';
import { logger } from '#logger';
import * as nwFunctions from '#networth/functions/index.js';
import { calculateItemPrice } from '#networth/networth.js';
import { populateCaches, prices, skyblockItems } from '#networth/prices.js';
import { jobs } from '#root/jobs/index.js';
import { IGNORED_ERRORS } from '#root/process.js';
import { type CommandContext } from '#structures/commands/BaseCommand.js';
import {
	ChannelUtil,
	EmbedUtil,
	GuildMemberUtil,
	GuildUtil,
	InteractionUtil,
	MessageUtil,
	UserUtil,
	type InteractionUtilReplyOptions,
	type RepliableInteraction,
} from '#utils';

// unused imports are 'used' so that tsc doesn't remove them
/* eslint-disable @typescript-eslint/no-unused-expressions */
sleep;
Routes;
fetch;
ms;
commonTags;
StringSelectMenuBuilder;
UserSelectMenuBuilder;
RoleSelectMenuBuilder;
MentionableSelectMenuBuilder;
ChannelSelectMenuBuilder;
ChannelUtil;
EmbedUtil;
GuildMemberUtil;
GuildUtil;
MessageUtil;
calculateItemPrice;
populateCaches;
prices;
skyblockItems;
sequelize;
sql;
constants;
redis;
hypixel;
imgur;
mojang;
functions;
nwFunctions;
IGNORED_ERRORS;
jobs;
/* eslint-enable @typescript-eslint/no-unused-expressions */

const type = (x: unknown) => new Type(x).toString();

export default class EvalCommand extends BaseOwnerCommand {
	private static PRETTIER_OPTIONS = {
		parser: 'babel',
		singleQuote: true,
		printWidth: 120,
		trailingComma: 'all',
		useTabs: true,
	} as const satisfies PrettierFormatOptions;

	public constructor(context: CommandContext) {
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
				)
				.addMentionableOption((option) =>
					option //
						.setName('mention')
						.setDescription('provided via the "mention" variable')
						.setRequired(false),
				)
				.addChannelOption((option) =>
					option //
						.setName('channel')
						.setDescription('provided via the "channel" variable')
						.setRequired(false),
				)
				.addAttachmentOption((option) =>
					option //
						.setName('attachment')
						.setDescription('provided via the "attachment" variable')
						.setRequired(false),
				),
			message: new ContextMenuCommandBuilder().setName('Evaluate content'),
			cooldown: 0,
		});
	}

	/**
	 * @param interaction
	 * @param error
	 * @param responseEmbed
	 * @param stopwatch
	 * @param inspectDepth
	 */
	// @ts-expect-error override
	protected override _respondWithError(
		interaction: RepliableInteraction<'cachedOrDM'>,
		error: unknown,
		responseEmbed: EmbedBuilder,
		stopwatch: Stopwatch,
		inspectDepth: number,
	) {
		return super._respondWithError(
			interaction,
			error,
			responseEmbed,
			`discord.js ${Discord.version} • type: \`${new Type(error)}\` • time taken: \`${stopwatch}\``,
			inspectDepth,
		);
	}

	/**
	 * @param interaction
	 * @param _input
	 * @param options
	 */
	private async _sharedRun(
		interaction: RepliableInteraction,
		_input: string,
		{ isAsync = /\bawait\b/.test(_input), inspectDepth = this.config.get('EVAL_INSPECT_DEPTH') } = {},
	) {
		if (interaction.user.id !== this.client.ownerId) {
			throw `eval is restricted to ${userMention(this.client.ownerId)}`;
		}

		const stopwatch = new Stopwatch();

		const reply = (options: InteractionUtilReplyOptions | string) =>
			InteractionUtil.reply(
				interaction,
				typeof options === 'string'
					? { content: options, ephemeral: false, rejectOnError: true, fetchReply: true }
					: options instanceof EmbedBuilder
					? { embeds: [options], ephemeral: false, rejectOnError: true, fetchReply: true }
					: options instanceof ButtonBuilder || options instanceof BaseSelectMenuBuilder
					? {
							components: [new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(options)],
							fetchReply: true,
					  }
					: { ephemeral: false, rejectOnError: true, fetchReply: true, ...options },
			);
		const inspect = (x: unknown) => util.inspect(x, { depth: inspectDepth, getters: true, showHidden: true });
		const saveHeapdump = async () => {
			void InteractionUtil.defer(interaction);
			return fs.writeFile(`${Date.now()}.heapsnapshot`, v8.getHeapSnapshot());
		};

		/* eslint-disable id-length */
		const i = interaction;
		const { client, config } = this;
		const { guild, guild: g, user, user: author, member, member: m } = interaction;
		const { discordGuilds, hypixelGuilds, players, taxCollectors, db, rest } = client;
		const me = guild?.members.me ?? null;
		const player = UserUtil.getPlayer(user);
		const p = player;
		const bridges = client.chatBridges.cache;
		const mention = (interaction as ChatInputCommandInteraction<'cachedOrDM'>).options?.getMentionable('mention');
		const channel =
			(interaction as ChatInputCommandInteraction<'cachedOrDM'>).options?.getChannel('channel') ?? interaction.channel;
		const ch = channel;
		const attachment = (interaction as ChatInputCommandInteraction<'cachedOrDM'>).options?.getAttachment('attachment');
		/* eslint-enable id-length */

		const responseEmbed = this.client.defaultEmbed //
			.setFooter({
				text: me?.displayName ?? this.client.user.username,
				iconURL: (me ?? this.client.user).displayAvatarURL(),
			});

		// format input
		let input: string;
		let toEvaluate: string;

		try {
			// wrap input in async IIFE
			if (isAsync) {
				const lines = _input
					.trim()
					.split(';')
					.map((part) => part.split('}'));

				// insert "return" before the last expression if not already present (since IIFE needs an explicit return, unlike plain eval)
				// eslint-disable-next-line no-labels
				loop: for (let outer = lines.length - 1; outer >= 0; --outer) {
					for (let inner = lines[outer]!.length - 1; inner >= 0; --inner) {
						const trimmed = lines[outer]![inner]!.trimStart();

						if (!trimmed || ['//', '/*', '}', ')'].some((x) => trimmed.startsWith(x))) continue;
						// eslint-disable-next-line no-labels
						if (/^(?:return|const|let|var)\b/.test(trimmed)) break loop;

						// preserve whitespace (like newlines) before the last expression
						lines[outer]![inner] = lines[outer]![inner]!.replace(/^\s*/, (match) => `${match}return `);
						// eslint-disable-next-line no-labels
						break loop;
					}
				}

				input = format(lines.map((part) => part.join('}')).join(';'), EvalCommand.PRETTIER_OPTIONS);
				toEvaluate = `(async () => { ${input} })()`;
			} else {
				input = format(_input.trim(), EvalCommand.PRETTIER_OPTIONS);
				toEvaluate = input;
			}
		} catch (error) {
			EvalCommand._addInputToResponseEmbed(responseEmbed, _input, 'ts', isAsync);

			return this._respondWithError(interaction, error, responseEmbed, stopwatch, inspectDepth);
		}

		EvalCommand._addInputToResponseEmbed(responseEmbed, input, 'ts', isAsync);

		try {
			stopwatch.restart();

			// eval args
			// eslint-disable-next-line no-eval
			let evaled = eval(toEvaluate);

			stopwatch.stop();

			const resultType = new Type(evaled);

			if (evaled instanceof Promise) {
				stopwatch.start();
				evaled = await evaled;
				stopwatch.stop();
			}

			const files = this._addOutputToResponseEmbed(
				interaction,
				responseEmbed,
				util.inspect(evaled, { depth: inspectDepth }),
				'ts',
				`discord.js ${Discord.version} • type: \`${resultType}\` • time taken: \`${stopwatch}\``,
			);

			return this._respond(interaction, responseEmbed, files, inspectDepth);
		} catch (error) {
			stopwatch.stop();

			logger.debug(error, '[EVAL CMD]');

			return this._respondWithError(interaction, error, responseEmbed, stopwatch, inspectDepth);
		}
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 * @param message
	 */
	public override async messageContextMenuRun(
		interaction: MessageContextMenuCommandInteraction<'cachedOrDM'>,
		{ content, author }: Message,
	) {
		if (author.id !== this.client.ownerId) {
			throw `cannot evaluate a message from ${author}`;
		}

		if (!content) {
			throw 'no content to evaluate';
		}

		return this._sharedRun(interaction, content);
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 * @param args parsed customId, split by ':'
	 */
	public override buttonRun(interaction: ButtonInteraction<'cachedOrDM'>, args: string[]) {
		const [subcommand, inspectDepth] = args as [string, string];

		switch (subcommand) {
			case 'edit': {
				return InteractionUtil.showModal(
					interaction,
					new ModalBuilder()
						.setTitle(this.name)
						.setCustomId(interaction.customId)
						.addComponents(
							EvalCommand._buildInputTextInput(interaction),
							new ActionRowBuilder<TextInputBuilder>().addComponents(
								new TextInputBuilder()
									.setCustomId('inspectDepth')
									.setStyle(TextInputStyle.Short)
									.setLabel('Inspect depth')
									.setValue(inspectDepth)
									.setPlaceholder(inspectDepth)
									.setRequired(false),
							),
						),
				);
			}

			case 'repeat': {
				const input = EvalCommand._getInputFromMessage(interaction.message);

				return this._sharedRun(interaction, input, { inspectDepth: Number(inspectDepth) });
			}

			default:
				throw new Error(`unknown subcommand '${subcommand}'`);
		}
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 * @param args parsed customId, split by ':'
	 */
	public override async modalSubmitRun(interaction: ModalSubmitInteraction<'cachedOrDM'>, args: string[]) {
		const [subcommand, inspectDepth] = args as [string, string];

		switch (subcommand) {
			case 'edit':
				return this._sharedRun(
					interaction,
					interaction.fields.getTextInputValue('input') || EvalCommand._getInputFromMessage(interaction.message),
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
	 *
	 * @param interaction
	 */
	public override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		return this._sharedRun(interaction, interaction.options.getString('input', true), {
			isAsync: interaction.options.getBoolean('async') ?? undefined,
			inspectDepth: interaction.options.getInteger('inspect') ?? undefined,
		});
	}
}
