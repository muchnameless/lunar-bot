import { setTimeout as sleep } from 'node:timers/promises';
sleep;
import { Buffer } from 'node:buffer';
import util from 'node:util';
import fs from 'node:fs/promises';
import v8 from 'node:v8';
import { ContextMenuCommandBuilder, SlashCommandBuilder } from '@discordjs/builders';
import Discord, {
	ActionRow,
	ButtonComponent,
	ButtonStyle,
	Embed,
	Formatters,
	MessageAttachment,
	Modal,
	TextInputComponent,
	TextInputStyle,
	Util,
} from 'discord.js';
Embed;
Util; // unused imports are 'used' so that tsc doesn't remove them
import { Stopwatch } from '@sapphire/stopwatch';
import { Type } from '@sapphire/type';
import { transformItemData } from '@zikeji/hypixel';
transformItemData;
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
	GuildMemberUtil,
	GuildUtil,
	InteractionUtil,
	LeaderboardUtil,
	MessageEmbedUtil,
	MessageUtil,
	UserUtil,
} from '../../util';
ChannelUtil;
GuildMemberUtil;
GuildUtil;
LeaderboardUtil;
MessageEmbedUtil;
MessageUtil;
import * as functions from '../../functions';
import { ApplicationCommand } from '../../structures/commands/ApplicationCommand';
import { calculateItemPrice } from '../../structures/networth/networth';
calculateItemPrice;
import { prices } from '../../structures/networth/prices';
prices;
import { MAX_PLACEHOLDER_LENGTH } from '../../constants';
import type {
	ChatInputCommandInteraction,
	ContextMenuCommandInteraction,
	ButtonInteraction,
	Message,
	ModalActionRowComponent,
	ModalSubmitInteraction,
} from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';
import type { InteractionUtilReplyOptions, RepliableInteraction } from '../../util';

const { EDIT_MESSAGE_EMOJI, EMBED_MAX_CHARS } = constants;
const { logger, splitForEmbedFields } = functions;

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
	 * @param subcommand
	 * @param inspectDepth
	 */
	private _generateCustomId(subcommand: string, inspectDepth: number | `${number}`) {
		return `${this.baseCustomId}:${subcommand}:${inspectDepth}` as const;
	}

	/**
	 * replaces the client's token in 'text' and escapes `
	 * @param input
	 * @param depth
	 */
	private _cleanOutput(input: unknown, depth: number) {
		return (typeof input === 'string' ? input : util.inspect(input, { depth }))
			.replaceAll('`', '`\u200B')
			.replace(new RegExp(this.client.token!, 'gi'), '****');
	}

	/**
	 * returns an attachment trimmed to the max file size
	 * @param content
	 */
	private _getFiles(interaction: RepliableInteraction, content: string) {
		InteractionUtil.defer(interaction);
		return [new MessageAttachment(Buffer.from(content).slice(0, this.MAX_FILE_SIZE), 'result.ts')];
	}

	/**
	 * @param interaction
	 * @param input
	 * @param options
	 */
	private async _run(
		interaction: RepliableInteraction,
		input: string,
		{ isAsync = /\bawait\b/.test(input), inspectDepth = this.config.get('EVAL_INSPECT_DEPTH') } = {},
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
					: options instanceof Embed
					? { embeds: [options], ephemeral: false, rejectOnError: true, fetchReply: true }
					: { ephemeral: false, rejectOnError: true, fetchReply: true, ...options },
			);
		const type = (x: unknown) => new Type(x).toString();
		const inspect = (x: unknown) => util.inspect(x, { depth: inspectDepth, getters: true, showHidden: true });
		const saveHeapdump = () => fs.writeFile(`${Date.now()}.heapsnapshot`, v8.getHeapSnapshot());
		const i = interaction;
		const { client, config } = this;
		const { channel, channel: ch, guild, guild: g, user, user: author, member, member: m } = interaction;
		const { discordGuilds, hypixelGuilds, players, taxCollectors, db } = client;
		const me = guild?.me ?? null;
		const player = UserUtil.getPlayer(user);
		const p = player;
		const bridges = client.chatBridges.cache;
		/* eslint-enable @typescript-eslint/no-unused-vars */

		const responseEmbed = this.client.defaultEmbed.setFooter({
			text: me?.displayName ?? this.client.user!.username,
			iconURL: (me ?? this.client.user!).displayAvatarURL(),
		});

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
			let evaled = isAsync
				? eval(
						`(async () => {
							${input}
						})()`,
				  )
				: eval(input);

			stopwatch.stop();

			const resultType = new Type(evaled);

			if (evaled instanceof Promise) {
				stopwatch.start();
				evaled = await evaled;
				stopwatch.stop();
			}

			const CLEANED_OUTPUT = this._cleanOutput(evaled, inspectDepth);
			const OUTPUT_ARRAY = splitForEmbedFields(CLEANED_OUTPUT, 'ts');
			const INFO = `d.js ${Discord.version} • type: \`${resultType}\` • time taken: \`${stopwatch}\``;

			// add output fields till embed character limit is reached
			for (const [index, value] of OUTPUT_ARRAY.entries()) {
				const name = index ? '\u200B' : 'Output';

				// embed size overflow -> convert output to file
				if (responseEmbed.length + INFO.length + 1 + name.length + value.length > EMBED_MAX_CHARS) {
					// remove result fields
					responseEmbed.spliceFields(responseEmbed.fields!.length - index, Number.POSITIVE_INFINITY);
					// add files
					files = this._getFiles(interaction, CLEANED_OUTPUT);
					break;
				}

				responseEmbed.addFields({ name, value });
			}

			responseEmbed.addFields({
				name: '\u200B',
				value: INFO,
			});
		} catch (error) {
			stopwatch.stop();

			logger.debug(error, '[EVAL ERROR]');

			const errorType = new Type(error);
			const FOOTER = `d.js ${Discord.version} • type: \`${errorType}\` • time taken: \`${stopwatch}\``;
			const CLEANED_OUTPUT = this._cleanOutput(error, inspectDepth);

			for (const [index, value] of splitForEmbedFields(CLEANED_OUTPUT, 'xl').entries()) {
				const name = index ? '\u200B' : 'Error';

				// embed size overflow -> convert output to file
				if (responseEmbed.length + FOOTER.length + 1 + name.length + value.length > EMBED_MAX_CHARS) {
					// remove error fields
					responseEmbed.spliceFields(responseEmbed.fields!.length - index, Number.POSITIVE_INFINITY);
					// add files
					files = this._getFiles(interaction, CLEANED_OUTPUT);
					break;
				}

				responseEmbed.addFields({ name, value });
			}

			responseEmbed.addFields({
				name: '\u200B',
				value: FOOTER,
			});
		}

		return InteractionUtil.replyOrUpdate(interaction, {
			embeds: [responseEmbed],
			components: [
				new ActionRow().addComponents(
					new ButtonComponent()
						.setCustomId(this._generateCustomId('edit', inspectDepth))
						.setEmoji({ name: EDIT_MESSAGE_EMOJI })
						.setStyle(ButtonStyle.Secondary),
					InteractionUtil.getDeleteButton(interaction),
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
		if (!content) {
			throw 'no content to evaluate';
		}

		if (author.id !== this.client.ownerId) {
			throw `cannot evaluate a message from ${author}`;
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
			case 'edit': {
				return interaction.showModal(
					new Modal()
						.setTitle(this.name)
						.setCustomId(this._generateCustomId(subcommand, inspectDepth as `${number}`))
						.addComponents(
							new ActionRow<ModalActionRowComponent>().addComponents(
								new TextInputComponent()
									.setCustomId('input')
									.setStyle(TextInputStyle.Paragraph)
									.setLabel('Input')
									.setPlaceholder(
										interaction.message.embeds[0]?.fields?.[0].value
											.replace(/^```[a-z]*\n|```$/g, '')
											.slice(0, MAX_PLACEHOLDER_LENGTH) ?? 'to evaluate',
									)
									.setRequired(true),
							),
						),
				);
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
			case 'edit': {
				return this._run(
					// @ts-expect-error
					interaction, //
					interaction.fields.getTextInputValue('input'),
					{
						inspectDepth: Number(inspectDepth),
					},
				);
			}

			default:
				throw new Error(`unknown subcommand '${subcommand}'`);
		}
	}
	/**
	 * execute the command
	 * @param interaction
	 */
	override runSlash(interaction: ChatInputCommandInteraction) {
		return this._run(interaction, interaction.options.getString('input', true).replace(/(?<=;)(?!$)/, '\n'), {
			isAsync: interaction.options.getBoolean('async') ?? undefined,
			inspectDepth: interaction.options.getInteger('inspect') ?? undefined,
		});
	}
}
