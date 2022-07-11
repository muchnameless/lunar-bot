import { setTimeout as sleep } from 'node:timers/promises';
sleep;
import util from 'node:util';
import fs from 'node:fs/promises';
import v8 from 'node:v8';
import Discord, {
	ActionRowBuilder,
	ButtonBuilder,
	ContextMenuCommandBuilder,
	EmbedBuilder,
	ModalBuilder,
	Routes,
	SelectMenuBuilder,
	SlashCommandBuilder,
	TextInputBuilder,
	TextInputStyle,
	userMention,
} from 'discord.js';
Routes; // unused imports are 'used' so that tsc doesn't remove them
import { Stopwatch } from '@sapphire/stopwatch';
import { Type } from '@sapphire/type';
import { TextInputLimits } from '@sapphire/discord-utilities';
import { fetch } from 'undici';
fetch;
import { format } from 'prettier';
import ms from 'ms';
ms;
import commonTags from 'common-tags';
commonTags;
import {
	ChannelUtil,
	EmbedUtil,
	GuildMemberUtil,
	GuildUtil,
	InteractionUtil,
	LeaderboardUtil,
	MessageUtil,
	UserUtil,
} from '#utils';
ChannelUtil;
EmbedUtil;
GuildMemberUtil;
GuildUtil;
LeaderboardUtil;
MessageUtil;
import { calculateItemPrice } from '#networth/networth';
calculateItemPrice;
import { accessories, itemUpgrades, populateCaches, prices } from '#networth/prices';
accessories;
itemUpgrades;
populateCaches;
prices;
import { sequelize, sql } from '#db';
sequelize;
sql;
import { logger } from '#logger';
import * as constants from '#constants';
constants;
import { redis, hypixel, imgur, mojang } from '#api';
redis;
hypixel;
imgur;
mojang;
import * as functions from '#functions';
import * as nwFunctions from '#networth/functions/index';
nwFunctions;
import { IGNORED_ERRORS } from '#root/process';
IGNORED_ERRORS;
import { jobs } from '#root/jobs/index';
jobs;
import BaseOwnerCommand from './~base';
import type {
	ButtonInteraction,
	ChatInputCommandInteraction,
	Message,
	MessageActionRowComponentBuilder,
	MessageContextMenuCommandInteraction,
	ModalActionRowComponentBuilder,
	ModalSubmitInteraction,
} from 'discord.js';
import type { CommandContext } from '#structures/commands/BaseCommand';
import type { InteractionUtilReplyOptions, RepliableInteraction } from '#utils';

const { trim } = functions;

export default class EvalCommand extends BaseOwnerCommand {
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
	// @ts-expect-error
	protected override _respondWithError(
		interaction: RepliableInteraction<'cachedOrDM'>,
		error: unknown,
		responseEmbed: EmbedBuilder,
		stopwatch: Stopwatch,
		inspectDepth: number,
	) {
		return super._respondWithError(
			interaction,
			util.inspect(error, { depth: Number.POSITIVE_INFINITY }),
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

		/* eslint-disable @typescript-eslint/no-unused-vars */
		const reply = (options: string | InteractionUtilReplyOptions) =>
			InteractionUtil.reply(
				interaction,
				typeof options === 'string'
					? { content: options, ephemeral: false, rejectOnError: true, fetchReply: true }
					: options instanceof EmbedBuilder
					? { embeds: [options], ephemeral: false, rejectOnError: true, fetchReply: true }
					: options instanceof ButtonBuilder || options instanceof SelectMenuBuilder
					? {
							components: [new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(options)],
							fetchReply: true,
					  }
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
		/* eslint-enable @typescript-eslint/no-unused-vars */

		const responseEmbed = this.client.defaultEmbed //
			.setFooter({
				text: me?.displayName ?? this.client.user!.username,
				iconURL: (me ?? this.client.user!).displayAvatarURL(),
			});

		// format input
		let input: string;

		try {
			input = format(_input.trim(), {
				parser: 'typescript',
				singleQuote: true,
				printWidth: 120,
				trailingComma: 'all',
				useTabs: true,
			});
		} catch (error) {
			BaseOwnerCommand._addInputToResponseEmbed(responseEmbed, _input, 'ts', isAsync);

			return this._respondWithError(interaction, error, responseEmbed, stopwatch, inspectDepth);
		}

		let toEvaluate: string;

		// wrap input in async IIFE
		if (isAsync) {
			const lines = input.split('\n');

			for (let index = lines.length - 1; index >= 0; --index) {
				const trimmed = lines[index]!.trimStart();

				if (!trimmed || ['//', '/*'].some((x) => trimmed.startsWith(x))) continue;
				if (['return ', 'const ', 'let ', 'var ', '}', ')'].some((x) => trimmed.startsWith(x))) break;

				lines[index] = `return ${lines[index]}`;
				break;
			}

			input = lines.join('\n');
			toEvaluate = `(async () => { ${input} })()`;
		} else {
			toEvaluate = input;
		}

		BaseOwnerCommand._addInputToResponseEmbed(responseEmbed, input, 'ts', isAsync);

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

			logger.debug(error, '[EVAL]');

			return this._respondWithError(interaction, error, responseEmbed, stopwatch, inspectDepth);
		}
	}

	/**
	 * execute the command
	 * @param interaction
	 * @param message
	 */
	override messageContextMenuRun(
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
	 * @param interaction
	 * @param args parsed customId, split by ':'
	 */
	override buttonRun(interaction: ButtonInteraction<'cachedOrDM'>, args: string[]) {
		const [subcommand, inspectDepth] = args as [string, string];

		switch (subcommand) {
			case 'edit': {
				const OLD_INPUT =
					interaction.message.embeds[0]?.fields?.[0]!.value.replace(/^```[a-z]*\n|```$/g, '') ?? 'code to evaluate';

				return InteractionUtil.showModal(
					interaction,
					new ModalBuilder()
						.setTitle(this.name)
						.setCustomId(interaction.customId)
						.addComponents(
							new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
								new TextInputBuilder()
									.setCustomId('input')
									.setStyle(TextInputStyle.Paragraph)
									.setLabel('Input')
									.setValue(trim(OLD_INPUT, TextInputLimits.MaximumValueCharacters))
									.setPlaceholder(trim(OLD_INPUT, TextInputLimits.MaximumPlaceholderCharacters))
									.setRequired(false),
							),
							new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
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
				const input = BaseOwnerCommand._getInputFromMessage(interaction.message);

				return this._sharedRun(interaction, input, { inspectDepth: Number(inspectDepth) });
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
	override modalSubmitRun(interaction: ModalSubmitInteraction<'cachedOrDM'>, args: string[]) {
		const [subcommand, inspectDepth] = args as [string, string];

		switch (subcommand) {
			case 'edit':
				return this._sharedRun(
					interaction,
					interaction.fields.getTextInputValue('input') || BaseOwnerCommand._getInputFromMessage(interaction.message),
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
	override chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		return this._sharedRun(interaction, interaction.options.getString('input', true), {
			isAsync: interaction.options.getBoolean('async') ?? undefined,
			inspectDepth: interaction.options.getInteger('inspect') ?? undefined,
		});
	}
}
