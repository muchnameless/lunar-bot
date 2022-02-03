import { setTimeout as sleep } from 'node:timers/promises';
sleep;
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
	PermissionFlagsBits,
	Util,
} from 'discord.js';
Embed;
Util; // unused imports are 'used' so that tsc doesn't remove them
import { Stopwatch } from '@sapphire/stopwatch';
import { Type } from '@sapphire/type';
import { transformItemData } from '@zikeji/hypixel';
transformItemData;
import fetch from 'node-fetch';
fetch;
import ms from 'ms';
ms;
import commonTags from 'common-tags';
commonTags;
import * as constants from '../../constants';
import { cache, hypixel, imgur, mojang } from '../../api';
cache;
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
import type {
	ChatInputCommandInteraction,
	ContextMenuCommandInteraction,
	ButtonInteraction,
	Message,
	Interaction,
} from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';
import type { InteractionUtilReplyOptions } from '../../util/InteractionUtil';

const { EDIT_MESSAGE_EMOJI, EMBED_MAX_CHARS } = constants;
const { logger, minutes, splitForEmbedFields } = functions;

export default class EvalCommand extends ApplicationCommand {
	constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder()
				.setDescription('executes js code')
				.addStringOption((option) => option.setName('input').setDescription('js code to evaluate').setRequired(true))
				.addIntegerOption((option) =>
					option.setName('inspect').setDescription('util.inspect depth on the output').setRequired(false),
				)
				.addBooleanOption((option) =>
					option.setName('async').setDescription('wrap the code in an async IIFE').setRequired(false),
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
	private _cleanOutput(input: unknown, depth = 1) {
		return (typeof input === 'string' ? input : util.inspect(input, { depth }))
			.replaceAll('`', '`\u200B')
			.replace(new RegExp(this.client.token!, 'gi'), '****');
	}

	/**
	 * @param interaction
	 * @param isAsync
	 * @param inspectDepth
	 */
	private _getRows(interaction: Interaction, isAsync: boolean, inspectDepth: number) {
		return [
			new ActionRow().addComponents(
				new ButtonComponent()
					.setCustomId(`${this.baseCustomId}:edit:${isAsync}:${inspectDepth}`)
					.setEmoji({ name: EDIT_MESSAGE_EMOJI })
					.setStyle(ButtonStyle.Secondary),
				InteractionUtil.getDeleteButton(interaction),
			),
		];
	}

	/**
	 * @param interaction
	 * @param input
	 * @param isAsync
	 * @param inspectDepth
	 */
	private async _eval(
		interaction: ChatInputCommandInteraction | ContextMenuCommandInteraction | ButtonInteraction,
		input: string,
		isAsync = /\bawait\b/.test(input),
		inspectDepth = 0,
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

			const OUTPUT_ARRAY = splitForEmbedFields(this._cleanOutput(evaled, inspectDepth), 'ts');
			const INFO = `d.js ${Discord.version} • type: \`${resultType}\` • time taken: \`${stopwatch}\``;

			// add output fields till embed character limit is reached
			for (const [index, value] of OUTPUT_ARRAY.entries()) {
				const name = index ? '\u200B' : 'Output';

				if (responseEmbed.length + INFO.length + 1 + name.length + value.length > EMBED_MAX_CHARS) break;

				responseEmbed.addFields({ name, value });
			}

			responseEmbed.addFields({
				name: '\u200B',
				value: INFO,
			});

			return [responseEmbed];
		} catch (error) {
			stopwatch.stop();

			logger.debug(error, '[EVAL ERROR]');

			const errorType = new Type(error);
			const FOOTER = `d.js ${Discord.version} • type: \`${errorType}\` • time taken: \`${stopwatch}\``;

			for (const [index, value] of splitForEmbedFields(this._cleanOutput(error), 'xl').entries()) {
				const name = index ? '\u200B' : 'Error';

				if (responseEmbed.length + FOOTER.length + 1 + name.length + value.length > EMBED_MAX_CHARS) break;

				responseEmbed.addFields({ name, value });
			}

			responseEmbed.addFields({
				name: '\u200B',
				value: FOOTER,
			});

			return [responseEmbed];
		}
	}

	/**
	 * execute the command
	 * @param interaction
	 * @param message
	 */
	override async runMessage(interaction: ContextMenuCommandInteraction, { content, author }: Message) {
		if (!content) {
			throw 'no content to evaluate';
		}

		if (author.id !== this.client.ownerId) {
			throw `cannot evaluate a message from ${author}`;
		}

		const IS_ASYNC = /\bawait\b/.test(content);
		const INSPECT_DEPTH = this.config.get('EVAL_INSPECT_DEPTH');

		return InteractionUtil.reply(interaction, {
			embeds: await this._eval(interaction, content, IS_ASYNC, INSPECT_DEPTH),
			components: this._getRows(interaction, IS_ASYNC, INSPECT_DEPTH),
		});
	}

	/**
	 * execute the command
	 * @param interaction
	 * @param args parsed customId, split by ':'
	 */
	override async runButton(interaction: ButtonInteraction, args: string[]) {
		const { channel } = interaction;
		const [subcommand, async, inspectDepth] = args;

		switch (subcommand) {
			case 'edit': {
				try {
					if (!ChannelUtil.botPermissions(channel!).has(PermissionFlagsBits.ViewChannel)) {
						throw `missing VIEW_CHANNEL permissions in ${interaction.channel ?? 'this channel'}`;
					}

					const collected = await channel!.awaitMessages({
						filter: (msg) => msg.author.id === interaction.user.id,
						max: 1,
						time: minutes(5),
						errors: ['time'],
					});

					return InteractionUtil.update(interaction, {
						embeds: await this._eval(
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

			default:
				throw new Error(`unknown subcommand '${subcommand}'`);
		}
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async runSlash(interaction: ChatInputCommandInteraction) {
		let indentationCount = 0;

		const INPUT = interaction.options
			.getString('input', true)
			.replace(/(?<=(?<![$)\]]|\\u)\{)/g, '\n') // insert new line for new scopes if not in template strings
			.split(/; *|\n/)
			.map((line) => {
				// add indentation
				let indentation = '';

				indentationCount -= line.match(/\}/g)?.length ?? 0;
				for (let i = 0; i < indentationCount; ++i) indentation += '  ';
				indentationCount += line.match(/\{/g)?.length ?? 0;

				return `${indentation}${line}`;
			})
			.reduce((acc, cur) => `${acc}${acc ? '\n' : ''}${cur}${cur.endsWith('{') ? '' : ';'}`, '');
		const IS_ASYNC = interaction.options.getBoolean('async') ?? /\bawait\b/.test(INPUT);
		const INSPECT_DEPTH = interaction.options.getInteger('inspect') ?? this.config.get('EVAL_INSPECT_DEPTH');

		return InteractionUtil.reply(interaction, {
			embeds: await this._eval(interaction, INPUT, IS_ASYNC, INSPECT_DEPTH),
			components: this._getRows(interaction, IS_ASYNC, INSPECT_DEPTH),
		});
	}
}
