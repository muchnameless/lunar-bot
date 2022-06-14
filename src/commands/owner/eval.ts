import { setTimeout as sleep } from 'node:timers/promises';
sleep;
import { Buffer } from 'node:buffer';
import { env } from 'node:process';
import util from 'node:util';
import fs from 'node:fs/promises';
import v8 from 'node:v8';
import Discord, {
	ActionRowBuilder,
	AttachmentBuilder,
	ButtonBuilder,
	ButtonStyle,
	ContextMenuCommandBuilder,
	EmbedBuilder,
	embedLength,
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
import { regExpEsc } from '@sapphire/utilities';
import { EmbedLimits, TextInputLimits } from '@sapphire/discord-utilities';
import { fetch } from 'undici';
fetch;
import { format } from 'prettier';
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
import { accessories, itemUpgrades, populateCaches, prices } from '../../structures/networth/prices';
accessories;
itemUpgrades;
populateCaches;
prices;
import { jobs } from '../../jobs';
jobs;
import { sequelize, sql } from '../../structures/database';
sequelize;
sql;
import { logger } from '../../logger';
import { IGNORED_ERRORS } from '../../process';
IGNORED_ERRORS;
import type {
	AttachmentPayload,
	ButtonInteraction,
	ChatInputCommandInteraction,
	JSONEncodable,
	Message,
	MessageActionRowComponentBuilder,
	MessageComponentInteraction,
	MessageContextMenuCommandInteraction,
	ModalActionRowComponentBuilder,
	ModalSubmitInteraction,
} from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';
import type { InteractionUtilReplyOptions, RepliableInteraction } from '../../util';

const { UnicodeEmoji } = constants;
const { buildDeleteButton, buildPinButton, splitForEmbedFields, trim } = functions;

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
		return (
			(typeof input === 'string' ? input : util.inspect(input, { depth }))
				// escape codeblock markdown
				.replaceAll('`', '`\u200B')
				// replace the client token
				.replace(new RegExp(this.client.token!, 'gi'), '***')
				// replace other .env values
				.replace(
					new RegExp(
						Object.entries(env)
							.filter(([key, value]) => value && /KEY|PASSWORD|TOKEN|URI/i.test(key))
							.flatMap(([, value]) => regExpEsc(value!).split(/\s+/))
							// sort descendingly by length
							.sort(({ length: a }, { length: b }) => b - a)
							.join('|'),
						'gi',
					),
					'***',
				)
		);
	}

	/**
	 * returns an attachment trimmed to the max file size
	 * @param content
	 */
	private _getFiles(interaction: RepliableInteraction, content: string) {
		void InteractionUtil.defer(interaction);

		return [
			new AttachmentBuilder() //
				.setFile(Buffer.from(content).slice(0, this.MAX_FILE_SIZE))
				.setName('result.ts')
				// TODO: remove if no longer needed
				.toJSON() as AttachmentBuilder,
		];
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
		const { channel, channel: ch, guild, guild: g, user, user: author, member, member: m } = interaction;
		const { discordGuilds, hypixelGuilds, players, taxCollectors, db, rest } = client;
		const me = guild?.members.me ?? null;
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
			this._addInputToResponseEmbed(responseEmbed, _input, isAsync);

			return this._respondWithError(interaction, error, responseEmbed, stopwatch, inspectDepth);
		}

		let toEvaluate: string;

		// wrap input in async IIFE
		if (isAsync) {
			const lines = input.split('\n');

			for (let index = lines.length - 1; index >= 0; --index) {
				const trimmed = lines[index].trimStart();

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

		this._addInputToResponseEmbed(responseEmbed, input, isAsync);

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

			let files: JSONEncodable<AttachmentPayload>[] | undefined;
			let length = embedLength(responseEmbed.data) + '\u200B'.length + FOOTER_FIELD.length;

			// add output fields till embed character limit is reached
			for (const [index, value] of splitForEmbedFields(CLEANED_OUTPUT, 'ts').entries()) {
				const name = index ? '\u200B' : 'Output';

				// embed size overflow -> convert output to file
				if ((length += name.length + value.length) > EmbedLimits.MaximumTotalCharacters) {
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

			return this._respond(interaction, responseEmbed, files, inspectDepth);
		} catch (error) {
			stopwatch.stop();

			logger.debug(error, '[EVAL ERROR]');

			return this._respondWithError(interaction, error, responseEmbed, stopwatch, inspectDepth);
		}
	}

	/**
	 * @param responseEmbed
	 * @param input
	 * @param isAsync
	 */
	// eslint-disable-next-line class-methods-use-this
	private _addInputToResponseEmbed(responseEmbed: EmbedBuilder, input: string, isAsync: boolean) {
		for (const [index, inputPart] of splitForEmbedFields(input, 'ts').entries()) {
			responseEmbed.addFields({
				name: index ? '\u200B' : isAsync ? 'Async Input' : 'Input',
				value: inputPart,
			});
		}
	}

	/**
	 * @param interaction
	 * @param error
	 * @param responseEmbed
	 * @param stopwatch
	 * @param inspectDepth
	 */
	private _respondWithError(
		interaction: RepliableInteraction<'cachedOrDM'>,
		error: unknown,
		responseEmbed: EmbedBuilder,
		stopwatch: Stopwatch,
		inspectDepth: number,
	) {
		const errorType = new Type(error);
		const FOOTER_FIELD = `d.js ${Discord.version} • type: \`${errorType}\` • time taken: \`${stopwatch}\``;
		const CLEANED_OUTPUT = this._cleanOutput(error, inspectDepth);

		let files: JSONEncodable<AttachmentPayload>[] | undefined;
		let length = embedLength(responseEmbed.data) + '\u200B'.length + FOOTER_FIELD.length;

		for (const [index, value] of splitForEmbedFields(CLEANED_OUTPUT, 'xl').entries()) {
			const name = index ? '\u200B' : 'Error';

			// embed size overflow -> convert output to file
			if ((length += name.length + value.length) > EmbedLimits.MaximumTotalCharacters) {
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

		return this._respond(interaction, responseEmbed, files, inspectDepth);
	}

	/**
	 * @param interaction
	 * @param responseEmbed
	 * @param files
	 * @param inspectDepth
	 */
	private _respond(
		interaction: RepliableInteraction<'cachedOrDM'>,
		responseEmbed: EmbedBuilder,
		files: JSONEncodable<AttachmentPayload>[] | undefined,
		inspectDepth: number,
	) {
		return InteractionUtil.replyOrUpdate(interaction, {
			embeds: [responseEmbed],
			components: [
				new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
					new ButtonBuilder()
						.setCustomId(`${this.baseCustomId}:edit:${inspectDepth}`)
						.setEmoji({ name: UnicodeEmoji.EditMessage })
						.setStyle(ButtonStyle.Secondary),
					new ButtonBuilder()
						.setCustomId(`${this.baseCustomId}:repeat:${inspectDepth}`)
						.setEmoji({ name: UnicodeEmoji.Reload })
						.setStyle(ButtonStyle.Secondary),
					buildPinButton(),
					buildDeleteButton(interaction.user.id),
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
		const [subcommand, inspectDepth] = args;

		switch (subcommand) {
			case 'edit': {
				const OLD_INPUT =
					interaction.message.embeds[0]?.fields?.[0].value.replace(/^```[a-z]*\n|```$/g, '') ?? 'code to evaluate';

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
				const input = this._getInputFromMessage(interaction.message);

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
		const [subcommand, inspectDepth] = args;

		switch (subcommand) {
			case 'edit':
				return this._sharedRun(
					interaction,
					interaction.fields.getTextInputValue('input') || this._getInputFromMessage(interaction.message),
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
