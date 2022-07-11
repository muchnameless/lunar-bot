import { setTimeout, clearTimeout } from 'node:timers';
import {
	ActionRowBuilder,
	ApplicationCommandType,
	ButtonBuilder,
	ButtonStyle,
	ChannelType,
	Colors,
	ComponentType,
	DiscordAPIError,
	EmbedBuilder,
	InteractionResponse,
	InteractionType,
	isJSONEncodable,
	RESTJSONErrorCodes,
	SnowflakeUtil,
} from 'discord.js';
import { InteractionLimits, MessageLimits } from '@sapphire/discord-utilities';
import { stripIndent } from 'common-tags';
import { logger } from '#logger';
import { CustomIdKey, GUILD_ID_ALL, UnicodeEmoji } from '#constants';
import {
	assertNever,
	buildVisibilityButton,
	makeContent,
	seconds,
	validateDiscordId,
	validateMinecraftUuid,
} from '#functions';
import { MessageUtil, ChannelUtil, UserUtil } from '.';
import type {
	APIActionRowComponent,
	APIMessageActionRowComponent,
	AutocompleteInteraction,
	BaseGuildTextChannel,
	ButtonInteraction,
	CacheType,
	ChatInputCommandInteraction,
	EmojiIdentifierResolvable,
	Interaction,
	InteractionDeferReplyOptions,
	InteractionDeferUpdateOptions,
	InteractionReplyOptions,
	InteractionUpdateOptions,
	Message,
	MessageActionRowComponentBuilder,
	MessageResolvable,
	ModalBuilder,
	TextBasedChannel,
	WebhookEditMessageOptions,
} from 'discord.js';
import type { SplitOptions } from '#functions';
import type { HypixelGuild } from '#structures/database/models/HypixelGuild';
import type { Player } from '#structures/database/models/Player';
import type { SendDMOptions } from '.';

interface InteractionData {
	deferReplyPromise: Promise<InteractionResponse | Message> | null;
	deferUpdatePromise: Promise<InteractionResponse> | null;
	useEphemeral: boolean;
	autoDeferTimeout: NodeJS.Timeout | null;
}

export type RepliableInteraction<Cached extends CacheType = 'cachedOrDM'> = Extract<
	Interaction<Cached>,
	{ reply: unknown }
>;

export type ModalRepliableInteraction<Cached extends CacheType = 'cachedOrDM'> = Extract<
	Interaction<Cached>,
	{ showModal: unknown }
>;

export type FromMessageInteraction<Cached extends CacheType = 'cachedOrDM'> = Extract<
	Interaction<Cached>,
	{ message: Message }
>;

interface DeferReplyOptions extends InteractionDeferReplyOptions {
	rejectOnError?: boolean;
}

export interface InteractionUtilReplyOptions extends InteractionReplyOptions {
	split?: SplitOptions | boolean;
	code?: string | boolean;
	rejectOnError?: boolean;
}

interface EditReplyOptions extends WebhookEditMessageOptions {
	rejectOnError?: boolean;
}

interface DeferUpdateOptions extends InteractionDeferUpdateOptions {
	rejectOnError?: boolean;
}

interface UpdateOptions extends InteractionUpdateOptions {
	rejectOnError?: boolean;
}

interface GetPlayerOptions {
	/** whether to use the current user in case that no player / target option is provided */
	fallbackToCurrentUser?: boolean;
	/** whether to throw an error if no linked player is found */
	throwIfNotFound?: boolean;
}

interface GetHypixelGuildOptions {
	/** whether to use the current user in case that no player / target option is provided */
	fallbackIfNoInput?: boolean;
	/** whether the return value may also be a string with GUILD_ID_ALL */
	includeAll?: boolean;
}

interface AwaitReplyOptions extends InteractionReplyOptions {
	question?: string;
	/** time in milliseconds to wait for a response */
	time?: number;
}

interface AwaitConfirmationOptions extends Omit<InteractionReplyOptions, 'fetchReply' | 'rejectOnError'> {
	question?: string;
	/** time in milliseconds to wait for a response */
	time?: number;
	errorMessage?: string;
}

export class InteractionUtil extends null {
	/**
	 * cache
	 */
	static CACHE = new WeakMap<Exclude<Interaction<'cachedOrDM'>, AutocompleteInteraction>, InteractionData>();

	static AUTO_DEFER_TIMEOUT = seconds(1);

	/**
	 * adds the interaction to the WeakMap which holds InteractionData and schedules deferring
	 * @param interaction
	 */
	static add(interaction: RepliableInteraction<'cachedOrDM'>) {
		const { channel } = interaction;
		const interactionData: InteractionData = {
			deferReplyPromise: null,
			deferUpdatePromise: null,
			useEphemeral:
				this.checkEphemeralOption(interaction) ??
				(channel !== null && channel.type !== ChannelType.DM
					? !channel.name.includes('command') && !channel.name.includes('ᴄᴏᴍᴍᴀɴᴅ') // guild channel
					: false), // DM channel
			autoDeferTimeout: setTimeout(
				// interactions must be acked within 3 seconds
				() => {
					logger.warn(
						this.logInfo(interaction),
						`[INTERACTION UTIL]: auto defer triggered after ${Date.now() - interaction.createdTimestamp} ms`,
					);

					void this.defer(interaction);

					interactionData.autoDeferTimeout = null;
				},
				this.AUTO_DEFER_TIMEOUT,
			),
		};

		this.CACHE.set(interaction, interactionData);

		return interactionData;
	}

	/**
	 * checks the command options for the ephemeral option
	 * @param interaction
	 */
	static checkEphemeralOption(interaction: Interaction<'cachedOrDM'>) {
		if (!interaction.isChatInputCommand()) return null;

		switch (interaction.options.getString('visibility')) {
			case 'everyone':
				return false;

			case 'just me':
				return true;

			default:
				return null;
		}
	}

	/**
	 * whether the error is due to an interaction reply
	 * @param error
	 */
	static isInteractionError(error: unknown): error is DiscordAPIError {
		if (!(error instanceof DiscordAPIError)) return false;

		switch (error.code) {
			case RESTJSONErrorCodes.UnknownWebhook:
			case RESTJSONErrorCodes.UnknownInteraction:
			case RESTJSONErrorCodes.InteractionHasAlreadyBeenAcknowledged:
			case RESTJSONErrorCodes.InvalidWebhookToken:
				return true;

			default:
				return false;
		}
	}

	/**
	 * @param interaction
	 */
	static logInfo(interaction: Interaction<'cachedOrDM'>) {
		switch (interaction.type) {
			case InteractionType.ApplicationCommand:
				switch (interaction.commandType) {
					case ApplicationCommandType.ChatInput:
						return {
							type: InteractionType[interaction.type],
							command: interaction.toString(),
							user: interaction.member
								? `${interaction.member.displayName} | ${interaction.user.tag}`
								: interaction.user.tag,
							channel: interaction.guildId
								? (interaction.channel as BaseGuildTextChannel)?.name ?? interaction.channelId
								: 'DM',
							guild: interaction.guild?.name ?? null,
						};

					case ApplicationCommandType.Message:
					case ApplicationCommandType.User:
						return {
							type: ApplicationCommandType[interaction.commandType],
							command: interaction.commandName,
							user: interaction.member
								? `${interaction.member.displayName} | ${interaction.user.tag}`
								: interaction.user.tag,
							channel: interaction.guildId
								? (interaction.channel as BaseGuildTextChannel)?.name ?? interaction.channelId
								: 'DM',
							guild: interaction.guild?.name ?? null,
						};

					default:
						return assertNever(interaction);
				}

			case InteractionType.ApplicationCommandAutocomplete:
				return {
					type: InteractionType[interaction.type],
					command: interaction.commandName,
					focused: interaction.options.getFocused(true),
					user: interaction.member
						? `${interaction.member.displayName} | ${interaction.user.tag}`
						: interaction.user.tag,
					channel: interaction.guildId
						? (interaction.channel as BaseGuildTextChannel)?.name ?? interaction.channelId
						: 'DM',
					guild: interaction.guild?.name ?? null,
				};

			case InteractionType.MessageComponent:
				switch (interaction.componentType) {
					case ComponentType.Button:
						return {
							type: ComponentType[interaction.componentType],
							customId: interaction.customId,
							user: interaction.member
								? `${interaction.member.displayName} | ${interaction.user.tag}`
								: interaction.user.tag,
							channel: interaction.guildId
								? (interaction.channel as BaseGuildTextChannel)?.name ?? interaction.channelId
								: 'DM',
							guild: interaction.guild?.name ?? null,
						};

					case ComponentType.SelectMenu:
						return {
							type: ComponentType[interaction.componentType],
							customId: interaction.customId,
							values: interaction.values,
							user: interaction.member
								? `${interaction.member.displayName} | ${interaction.user.tag}`
								: interaction.user.tag,
							channel: interaction.guildId
								? (interaction.channel as BaseGuildTextChannel)?.name ?? interaction.channelId
								: 'DM',
							guild: interaction.guild?.name ?? null,
						};

					default:
						return assertNever(interaction);
				}

			// TODO: modal submit
			// case InteractionType.ModalSubmit:
			// 	return {};

			default:
				return {
					type: InteractionType[interaction.type],
					user: interaction.member
						? `${interaction.member.displayName} | ${interaction.user.tag}`
						: interaction.user.tag,
					channel: interaction.guildId
						? (interaction.channel as BaseGuildTextChannel)?.name ?? interaction.channelId
						: 'DM',
					guild: interaction.guild?.name ?? null,
				};
		}
	}

	/**
	 * appends the first option name if the command is a subcommand or subcommand group
	 * @param interaction
	 */
	static fullCommandName(interaction: Interaction) {
		switch (interaction.type) {
			case InteractionType.MessageComponent:
				return `${ComponentType[interaction.componentType]} '${interaction.customId}'`;

			case InteractionType.ApplicationCommandAutocomplete:
				return [
					interaction.commandName,
					interaction.options.getSubcommandGroup(),
					interaction.options.getSubcommand(false),
				]
					.filter((x) => x !== null)
					.join(' ');

			case InteractionType.ApplicationCommand:
				switch (interaction.commandType) {
					case ApplicationCommandType.ChatInput:
						return [
							interaction.commandName,
							interaction.options.getSubcommandGroup(),
							interaction.options.getSubcommand(false),
						]
							.filter((x) => x !== null)
							.join(' ');

					default:
						return interaction.commandName;
				}

			case InteractionType.ModalSubmit:
				return interaction.customId;

			default:
				return assertNever(interaction);
		}
	}

	/**
	 * whether the force option was set to true
	 * @param interaction
	 */
	static checkForce(interaction: ChatInputCommandInteraction<'cachedOrDM'> | AutocompleteInteraction<'cachedOrDM'>) {
		return interaction.options.getBoolean('force') ?? false;
	}

	/**
	 * whether the interaction is from a cached guild or DM	channel
	 * @param interaction
	 */
	static inCachedGuildOrDM(interaction: Interaction): interaction is Interaction<'cachedOrDM'> {
		// guilds are sent with all their channels -> cached channel implies cached guild
		return interaction.client.channels.cache.has(interaction.channelId!);
	}

	/**
	 * whether the interaction has a message attached
	 * @param interaction
	 */
	static isFromMessage<T extends Interaction<'cachedOrDM'>>(interaction: T): interaction is T & FromMessageInteraction {
		return Boolean((interaction as any).message);
	}

	/**
	 * deferUpdate for components, else deferReply
	 * @param interaction
	 * @param options
	 */
	static defer<T extends RepliableInteraction>(
		interaction: T,
		options?: T extends FromMessageInteraction ? DeferUpdateOptions : DeferReplyOptions,
	) {
		// deferUpdate for interactions which have a message attached (MessageComponentInteractions or ModalSubmitInteractions from MessageComponents)
		if (this.isFromMessage(interaction)) return this.deferUpdate(interaction, options);

		// deferReply if there is no message yet
		return this.deferReply(interaction, options);
	}

	/**
	 * update for components, else reply
	 * @param interaction
	 * @param options
	 */
	static replyOrUpdate<T extends RepliableInteraction>(
		interaction: T,
		options: string | (T extends FromMessageInteraction ? UpdateOptions : InteractionUtilReplyOptions),
	) {
		if (this.isFromMessage(interaction)) return this.update(interaction, options as UpdateOptions);

		return this.reply(interaction, options as InteractionUtilReplyOptions);
	}

	/**
	 * @param interaction
	 * @param options
	 */
	static async deferReply(
		interaction: RepliableInteraction,
		options?: DeferReplyOptions & { fetchReply: true; rejectOnError: true },
	): Promise<Message>;
	static async deferReply(interaction: RepliableInteraction, options?: DeferReplyOptions): Promise<void | Message>;
	static async deferReply(interaction: RepliableInteraction, options?: DeferReplyOptions) {
		const cached = this.CACHE.get(interaction)!;
		if (cached.deferReplyPromise) return cached.deferReplyPromise;

		if (interaction.replied) {
			if (options?.rejectOnError) {
				throw new Error(`${Object.entries(this.logInfo(interaction))}: already replied`);
			}
			return logger.warn({ ...this.logInfo(interaction), data: options }, '[INTERACTION DEFER REPLY]: already replied');
		}

		clearTimeout(cached.autoDeferTimeout!);

		try {
			return await (cached.deferReplyPromise = interaction.deferReply({ ephemeral: cached.useEphemeral, ...options }));
		} catch (error) {
			if (options?.rejectOnError) throw error;
			logger.error({ err: error, ...this.logInfo(interaction), data: options }, '[INTERACTION DEFER REPLY]');
		}
	}

	/**
	 * adds a "change visibility button" to the option's components
	 * @param options
	 */
	private static _addVisibilityButton(options: Pick<InteractionReplyOptions, 'components' | 'ephemeral'>) {
		if (!options.ephemeral) return;

		switch (options.components?.length) {
			case undefined:
			case 0:
				options.components = [
					new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(buildVisibilityButton()),
				];
				break;

			default: {
				// convert all rows to plain JSON
				const components = options.components!.map((x) =>
					isJSONEncodable(x) ? x.toJSON() : (x as APIActionRowComponent<APIMessageActionRowComponent>),
				);
				options.components = components;

				const LAST_NON_FULL_ROW = components.findLastIndex(
					({ components: c }) =>
						c[0]?.type !== ComponentType.SelectMenu && c.length < InteractionLimits.MaximumButtonsPerActionRow,
				);

				// non empty row found
				if (LAST_NON_FULL_ROW !== -1) {
					components[LAST_NON_FULL_ROW]!.components.push(buildVisibilityButton().toJSON());
					return;
				}

				// all rows are full
				if (components.length === MessageLimits.MaximumActionRows) return;

				// add a new row
				components.push(
					new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(buildVisibilityButton()).toJSON(),
				);
			}
		}
	}

	/**
	 * @param interaction
	 * @param options
	 */
	static async reply(
		interaction: RepliableInteraction,
		options: InteractionUtilReplyOptions & { rejectOnError: true; fetchReply: true },
	): Promise<Message>;
	static async reply(
		interaction: RepliableInteraction,
		options: InteractionUtilReplyOptions & { rejectOnError: true },
	): Promise<InteractionResponse | Message>;
	static async reply(
		interaction: RepliableInteraction,
		options: string | InteractionUtilReplyOptions,
	): Promise<null | InteractionResponse | Message>;
	static async reply(
		interaction: RepliableInteraction,
		options: string | InteractionUtilReplyOptions,
	): Promise<null | InteractionResponse | Message> {
		const cached = this.CACHE.get(interaction)!;
		const _options =
			typeof options === 'string'
				? { ephemeral: cached.useEphemeral, content: options }
				: { ephemeral: cached.useEphemeral, ...options };

		try {
			/**
			 * allow split option for ChatInputCommandInteraction#reply
			 */
			if (_options.split || _options.code) {
				const parts = makeContent(_options.content ?? '', { split: _options.split, code: _options.code });
				const lastPart = parts.pop()!;

				for (const content of parts) {
					await this.reply(interaction, { ..._options, content, split: false, code: false });
				}
				return await this.reply(interaction, { ..._options, content: lastPart, split: false, code: false });
			}

			this._addVisibilityButton(_options);

			// replied
			if (interaction.replied) return await interaction.followUp(_options);

			// await defers
			if (cached.deferReplyPromise) await cached.deferReplyPromise;
			if (cached.deferUpdatePromise) await cached.deferUpdatePromise;

			// deferred but not replied
			if (interaction.deferred) {
				// "change" ephemeral state if the defer was a deferReply
				if (!this.isFromMessage(interaction)) {
					if (interaction.ephemeral) {
						if (!_options.ephemeral) await interaction.editReply('\u200B'); // ephemeral defer -> not ephemeraly reply
					} else if (_options.ephemeral) {
						await interaction.deleteReply(); // not ephemeral defer -> ephemeral reply
					}
				}

				return await interaction.followUp(_options);
			}

			// initial reply
			clearTimeout(cached.autoDeferTimeout!);
			return await interaction.reply(_options);
		} catch (error) {
			if (this.isInteractionError(error)) {
				logger.error({ err: error, ...this.logInfo(interaction), data: _options }, '[INTERACTION REPLY]');
				if (_options.ephemeral) return UserUtil.sendDM(interaction.user, _options as SendDMOptions);
				return ChannelUtil.send(interaction.channel!, _options as SendDMOptions);
			}

			if (_options.rejectOnError) throw error;
			logger.error({ err: error, ...this.logInfo(interaction), data: _options }, '[INTERACTION REPLY]');
			return null;
		}
	}

	/**
	 * @param interaction
	 * @param options
	 * @param message optional followUp Message to edit
	 */
	static async editReply(
		interaction: RepliableInteraction,
		options: EditReplyOptions,
		message: MessageResolvable,
	): Promise<Message>;
	static async editReply(
		interaction: RepliableInteraction,
		options: EditReplyOptions & { rejectOnError: true },
	): Promise<Message>;
	static async editReply(
		interaction: RepliableInteraction,
		options: string | EditReplyOptions,
	): Promise<null | Message>;
	static async editReply(
		interaction: RepliableInteraction,
		options: string | EditReplyOptions,
		message?: MessageResolvable,
	) {
		const _options = typeof options === 'string' ? { content: options } : { ...options };

		this._addVisibilityButton(_options);

		try {
			if (message) return await interaction.webhook.editMessage(message, _options);

			const { deferReplyPromise, deferUpdatePromise } = this.CACHE.get(interaction)!;

			if (deferReplyPromise) await deferReplyPromise;
			if (deferUpdatePromise) await deferUpdatePromise;

			return await interaction.editReply(_options);
		} catch (error) {
			if (this.isInteractionError(error)) {
				logger.error({ err: error, ...this.logInfo(interaction), data: _options }, '[INTERACTION EDIT REPLY]');

				try {
					return MessageUtil.edit(await interaction.fetchReply(), options, interaction.appPermissions ?? undefined);
				} catch (_error) {
					if (_options.rejectOnError) throw _error;
					logger.error({ err: _error, ...this.logInfo(interaction), data: _options }, '[INTERACTION EDIT REPLY]');
					return null;
				}
			}

			if (_options.rejectOnError) throw error;
			logger.error({ err: error, ...this.logInfo(interaction), data: _options }, '[INTERACTION EDIT REPLY]');
			return null;
		}
	}

	/**
	 * @param interaction
	 * @param options
	 */
	static async deferUpdate(
		interaction: FromMessageInteraction,
		options?: DeferReplyOptions & { fetchReply: true; rejectOnError: true },
	): Promise<Message>;
	static async deferUpdate(
		interaction: FromMessageInteraction,
		options?: DeferReplyOptions,
	): Promise<InteractionResponse | Message>;
	static async deferUpdate(
		interaction: FromMessageInteraction,
		options?: DeferUpdateOptions,
	): Promise<InteractionResponse | Message> {
		const cached = this.CACHE.get(interaction)!;
		if (cached.deferUpdatePromise) return cached.deferUpdatePromise;

		if (interaction.replied) {
			logger.warn({ ...this.logInfo(interaction), data: options }, '[INTERACTION DEFER UPDATE]: already replied');
			return Reflect.construct(InteractionResponse, [interaction, interaction.message.interaction?.id]);
		}

		clearTimeout(cached.autoDeferTimeout!);

		try {
			return await (cached.deferUpdatePromise = interaction.deferUpdate(options));
		} catch (error) {
			if (options?.rejectOnError) throw error;
			logger.error({ err: error, ...this.logInfo(interaction), data: options }, '[INTERACTION DEFER UPDATE]');
			return Reflect.construct(InteractionResponse, [interaction, interaction.message.interaction?.id]);
		}
	}

	/**
	 * @param interaction
	 * @param options
	 */
	static async update(
		interaction: FromMessageInteraction,
		options: UpdateOptions & { rejectOnError: true },
	): Promise<Message>;
	static async update(
		interaction: FromMessageInteraction,
		options: string | UpdateOptions,
	): Promise<InteractionResponse | Message>;
	static async update(
		interaction: FromMessageInteraction,
		options: string | UpdateOptions,
	): Promise<InteractionResponse | Message> {
		const cached = this.CACHE.get(interaction)!;
		const _options =
			typeof options === 'string'
				? { ephemeral: MessageUtil.isEphemeral(interaction.message), content: options }
				: { ephemeral: MessageUtil.isEphemeral(interaction.message), ...options };

		this._addVisibilityButton(_options);

		try {
			if (cached.deferReplyPromise) await cached.deferReplyPromise;

			// replied
			if (interaction.replied) {
				return (await interaction.webhook.editMessage(
					interaction.message,
					_options as WebhookEditMessageOptions,
				)) as Message;
			}

			// await defer
			if (cached.deferUpdatePromise) await cached.deferUpdatePromise;

			// deferred but not replied
			if (interaction.deferred) return await interaction.editReply(_options as WebhookEditMessageOptions);

			// initial reply
			clearTimeout(cached.autoDeferTimeout!);
			return await interaction.update(_options);
		} catch (error) {
			if (this.isInteractionError(error)) {
				logger.error({ err: error, ...this.logInfo(interaction), data: _options }, '[INTERACTION UPDATE]');
				return MessageUtil.edit(interaction.message, _options, interaction.appPermissions ?? undefined);
			}

			if (_options.rejectOnError) throw error;
			logger.error({ err: error, ...this.logInfo(interaction), data: _options }, '[INTERACTION UPDATE]');
			return Reflect.construct(InteractionResponse, [interaction, interaction.message.interaction?.id]);
		}
	}

	/**
	 * deletes the message which the component is attached to
	 * @param interaction
	 */
	static async deleteMessage(interaction: FromMessageInteraction) {
		const cached = this.CACHE.get(interaction)!;

		try {
			if (cached.deferReplyPromise) await cached.deferReplyPromise;

			// replied
			if (interaction.replied) return MessageUtil.delete(interaction.message);

			await this.deferUpdate(interaction, { rejectOnError: true });

			if (MessageUtil.isEphemeral(interaction.message)) {
				logger.warn(
					this.logInfo(interaction),
					`[INTERACTION DELETE MESSAGE]: unable to delete ephemeral message in ${MessageUtil.channelLogInfo(
						interaction.message,
					)}`,
				);
				return null;
			}

			await interaction.deleteReply();

			return interaction.message;
		} catch (error) {
			logger.error({ err: error, ...this.logInfo(interaction) }, '[INTERACTION DELETE MESSAGE]');
			return MessageUtil.delete(interaction.message);
		}
	}

	/**
	 * @param interaction
	 * @param modal
	 */
	static showModal(interaction: ModalRepliableInteraction, modal: ModalBuilder) {
		const cached = this.CACHE.get(interaction)!;

		// showModal is an initial reply
		if (cached.deferReplyPromise || cached.deferUpdatePromise) {
			throw new Error('[INTERACTION SHOW MODAL]: interaction already acknowledged');
		}

		clearTimeout(cached.autoDeferTimeout!);

		return interaction.showModal(modal);
	}

	/**
	 * posts question in same channel and returns content of first reply or null if timeout
	 * @param interaction
	 * @param options
	 */
	static async awaitReply(interaction: RepliableInteraction, options: string | AwaitReplyOptions = {}) {
		const {
			question = 'confirm this action?',
			time = seconds(60),
			..._options
		} = typeof options === 'string' ? { question: options } : options;

		try {
			const channel =
				interaction.channel ??
				(interaction.channelId !== null
					? ((await interaction.client.channels.fetch(interaction.channelId)) as TextBasedChannel)
					: null);

			if (!channel) throw `no channel with the id '${interaction.channelId}'`;

			await this.reply(interaction, {
				content: question,
				rejectOnError: true,
				..._options,
			});

			const collected = await channel.awaitMessages({
				filter: (msg) => msg.author.id === interaction.user.id,
				max: 1,
				time,
			});

			return collected.first()?.content ?? null;
		} catch (error) {
			logger.error({ err: error, ...this.logInfo(interaction), data: options }, '[INTERACTION AWAIT REPLY]');
			return null;
		}
	}

	/**
	 * confirms the action via a button collector
	 * @param interaction
	 * @param options
	 */
	static async awaitConfirmation(interaction: RepliableInteraction, options: string | AwaitConfirmationOptions = {}) {
		const {
			question = 'confirm this action?',
			time = seconds(60),
			errorMessage = 'the command has been cancelled',
			..._options
		} = typeof options === 'string' ? { question: options } : options;
		const SUCCESS_ID = `${CustomIdKey.Confirm}:${SnowflakeUtil.generate()}`;
		const CANCEL_ID = `${CustomIdKey.Confirm}:${SnowflakeUtil.generate()}`;
		const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
			new ButtonBuilder() //
				.setCustomId(SUCCESS_ID)
				.setStyle(ButtonStyle.Success)
				.setEmoji({ name: UnicodeEmoji.Y }),
			new ButtonBuilder() //
				.setCustomId(CANCEL_ID)
				.setStyle(ButtonStyle.Danger)
				.setEmoji({ name: UnicodeEmoji.X }),
		);

		let res: InteractionResponse | Message;

		try {
			res = await this.reply(interaction, {
				embeds: [interaction.client.defaultEmbed.setDescription(question)],
				components: [row],
				fetchReply: false,
				rejectOnError: true,
				..._options,
			});
		} catch (error) {
			logger.error({ err: error, ...this.logInfo(interaction), data: _options }, '[INTERACTION AWAIT CONFIRMATION]');
			throw errorMessage;
		}

		const collector = res.createMessageComponentCollector({
			componentType: ComponentType.Button,
			filter: (i) => {
				// wrong button
				if (![SUCCESS_ID, CANCEL_ID].includes(i.customId)) return false;

				// wrong user
				if (i.user.id !== interaction.user.id) {
					void this.reply(interaction, {
						content: 'that is not up to you to decide',
						ephemeral: true,
					});
					return false;
				}

				return true;
			},
			max: 1,
			time,
		});

		return new Promise<void>((resolve, reject) => {
			collector.once('end', async (collected, reason) => {
				switch (reason) {
					case 'limit': {
						const buttonInteraction = collected.first() as ButtonInteraction<'cachedOrDM'>;
						const success = buttonInteraction.customId === SUCCESS_ID;

						for (const component of row.components) component.setDisabled(true);

						void this.update(buttonInteraction, {
							embeds: [
								new EmbedBuilder()
									.setColor(interaction.client.config.get(success ? 'EMBED_GREEN' : 'EMBED_RED'))
									.setDescription(
										stripIndent`
											${question}
											\\> ${success ? 'confirmed' : 'cancelled'}
										`,
									)
									.setTimestamp(),
							],
							components: [row],
						});

						if (success) return resolve();
						break;
					}

					case 'time': {
						for (const component of row.components) component.setDisabled(true);

						const editOptions = {
							embeds: [
								new EmbedBuilder()
									.setColor(Colors.NotQuiteBlack)
									.setDescription(
										stripIndent`
											${question}
											\\> timeout
										`,
									)
									.setTimestamp(),
							],
							components: [row],
						};

						try {
							await this.editReply(interaction, editOptions, (res as Message).id ?? '@original');
						} catch (error) {
							logger.error(
								{ err: error, ...this.logInfo(interaction), data: _options },
								'[INTERACTION AWAIT CONFIRMATION]',
							);
							void this.reply(interaction, editOptions);
						}
						break;
					}
				}

				reject(errorMessage);
			});
		});
	}

	/**
	 * react in order if the message is not deleted and the client has 'ADD_REACTIONS', catching promise rejections
	 * @param interaction
	 * @param emojis
	 */
	static async react(interaction: ChatInputCommandInteraction<'cachedOrDM'>, ...emojis: EmojiIdentifierResolvable[]) {
		if (interaction.ephemeral) return null;

		try {
			return MessageUtil.react(await interaction.fetchReply(), ...emojis);
		} catch (error) {
			return logger.error({ err: error, ...this.logInfo(interaction), data: emojis }, '[INTERACTION REACT]');
		}
	}

	/**
	 * returns the player object, optional fallback to the interaction.user's player
	 * @param interaction
	 * @param options
	 */
	static getPlayer(
		interaction: ChatInputCommandInteraction<'cachedOrDM'>,
		options: GetPlayerOptions & { throwIfNotFound: true },
	): Player;
	static getPlayer(interaction: ChatInputCommandInteraction<'cachedOrDM'>, options?: GetPlayerOptions): Player | null;
	static getPlayer(
		interaction: ChatInputCommandInteraction<'cachedOrDM'>,
		{ fallbackToCurrentUser = false, throwIfNotFound = false } = {},
	) {
		if (
			!(
				// @ts-expect-error
				interaction.options._hoistedOptions.length
			)
		) {
			if (fallbackToCurrentUser) {
				const player = UserUtil.getPlayer(interaction.user);
				if (throwIfNotFound && !player) throw `no player linked to \`${interaction.user.tag}\` found`;
				return player;
			}
			return null;
		}

		const INPUT = (interaction.options.getString('player') ?? interaction.options.getString('target'))
			?.replace(/\W/g, '')
			.toLowerCase();

		if (!INPUT) {
			if (fallbackToCurrentUser) {
				const player = UserUtil.getPlayer(interaction.user);
				if (throwIfNotFound && !player) throw `no player linked to \`${interaction.user.tag}\` found`;
				return player;
			}
			return null;
		}

		if (validateDiscordId(INPUT)) {
			const player = interaction.client.players.getById(INPUT);
			if (throwIfNotFound && !player) throw `no player linked to \`${INPUT}\` found`;
			return player;
		}

		if (validateMinecraftUuid(INPUT)) {
			const player = interaction.client.players.cache.get(INPUT) ?? null;
			if (throwIfNotFound && !player) throw `no player linked to \`${INPUT}\` found`;
			return player;
		}

		const player =
			(this.checkForce(interaction)
				? interaction.client.players.cache.find(({ ign }) => ign.toLowerCase() === INPUT)
				: interaction.client.players.getByIgn(INPUT)) ?? null;
		if (throwIfNotFound && !player) throw `no player linked to \`${INPUT}\` found`;
		return player;
	}

	/**
	 * returns the player object's IGN, optional fallback to interaction.user's player
	 * @param interaction
	 * @param options
	 */
	static getIgn(
		interaction: ChatInputCommandInteraction<'cachedOrDM'>,
		options: GetPlayerOptions & { throwIfNotFound: true },
	): string;
	static getIgn(interaction: ChatInputCommandInteraction<'cachedOrDM'>, options?: GetPlayerOptions): string | null;
	static getIgn(interaction: ChatInputCommandInteraction<'cachedOrDM'>, options?: GetPlayerOptions) {
		if (this.checkForce(interaction)) {
			const IGN =
				(interaction.options.getString('player') ?? interaction.options.getString('target'))?.toLowerCase() ??
				(options?.fallbackToCurrentUser ? UserUtil.getPlayer(interaction.user)?.ign ?? null : null);
			if (options?.throwIfNotFound && !IGN) throw 'no IGN specified';
			return IGN;
		}
		return this.getPlayer(interaction, options)?.ign ?? null;
	}

	/**
	 * returns a HypixelGuild instance
	 * @param interaction
	 * @param options
	 */
	static getHypixelGuild(
		interaction: Interaction<'cachedOrDM'>,
		options: { fallbackIfNoInput?: true; includeAll: true },
	): HypixelGuild | typeof GUILD_ID_ALL;
	static getHypixelGuild(
		interaction: Interaction<'cachedOrDM'>,
		options: { fallbackIfNoInput: false; includeAll: true },
	): HypixelGuild | typeof GUILD_ID_ALL | null;
	static getHypixelGuild(
		interaction: Interaction<'cachedOrDM'>,
		options?: { fallbackIfNoInput?: true; includeAll?: false },
	): HypixelGuild;
	static getHypixelGuild(
		interaction: Interaction<'cachedOrDM'>,
		options: { fallbackIfNoInput: false; includeAll?: false },
	): HypixelGuild | null;
	static getHypixelGuild(
		interaction: Interaction<'cachedOrDM'>,
		{ fallbackIfNoInput = true, includeAll = false }: GetHypixelGuildOptions = {},
	) {
		const INPUT = (interaction as ChatInputCommandInteraction<'cachedOrDM'>).options?.getString('guild');

		if (INPUT) {
			if (includeAll && INPUT.toUpperCase() === GUILD_ID_ALL) return GUILD_ID_ALL;

			const hypixelGuild =
				interaction.client.hypixelGuilds.cache.get(INPUT) ?? interaction.client.hypixelGuilds.findByName(INPUT);

			if (hypixelGuild) return hypixelGuild;
		}

		if (fallbackIfNoInput) {
			return (
				(interaction.guildId
					? interaction.client.hypixelGuilds.findByDiscordGuild(interaction.guild)
					: UserUtil.getPlayer(interaction.user)?.hypixelGuild) ?? interaction.client.hypixelGuilds.mainGuild
			);
		}

		return null;
	}
}
