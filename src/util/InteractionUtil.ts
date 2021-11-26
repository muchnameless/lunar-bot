import { MessageActionRow, MessageButton, MessageEmbed, SnowflakeUtil, DiscordAPIError, Constants } from 'discord.js';
import { RESTJSONErrorCodes } from 'discord-api-types/v9';
import { stripIndent } from 'common-tags';
import { GUILD_ID_ALL, X_EMOJI, Y_EMOJI } from '../constants';
import { logger, makeContent, seconds, validateDiscordId, validateMinecraftUuid } from '../functions';
import { MessageUtil, ChannelUtil, UserUtil } from '.';
import type {
	BaseGuildTextChannel,
	CommandInteraction,
	CommandInteractionOptionResolver,
	ContextMenuInteraction,
	EmojiIdentifierResolvable,
	GuildMember,
	Interaction,
	InteractionDeferReplyOptions,
	InteractionDeferUpdateOptions,
	InteractionReplyOptions,
	InteractionUpdateOptions,
	Message,
	MessageComponentInteraction,
	MessageResolvable,
	TextBasedChannels,
	WebhookEditMessageOptions,
} from 'discord.js';
import type { SplitOptions } from '../functions';
import type { LunarClient } from '../structures/LunarClient';
import type { HypixelGuild } from '../structures/database/models/HypixelGuild';
import type { Player } from '../structures/database/models/Player';

interface InteractionData {
	deferReplyPromise: Promise<void | Message> | null;
	deferUpdatePromise: Promise<void> | null;
	useEphemeral: boolean;
	autoDefer: NodeJS.Timeout | null;
}

export type ChatInteraction = CommandInteraction | MessageComponentInteraction | ContextMenuInteraction;

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
	/** wether to use the current user in case that no player / target option is provided */
	fallbackToCurrentUser?: boolean;
	/** wether to throw an error if no linked player is found */
	throwIfNotFound?: boolean;
}

interface GetHypixelGuildOptions {
	/** wether to use the current user in case that no player / target option is provided */
	fallbackIfNoInput?: boolean;
	/** wether the return value may also be a string with GUILD_ID_ALL */
	includeAll?: boolean;
}

interface AwaitReplyOptions extends InteractionReplyOptions {
	question?: string;
	/** time in milliseconds to wait for a response */
	time?: number;
}

interface AwaitConfirmationOptions extends InteractionReplyOptions {
	question?: string;
	/** time in milliseconds to wait for a response */
	time?: number;
	errorMessage?: string;
}

export default class InteractionUtil extends null {
	/**
	 * cache
	 */
	static CACHE = new WeakMap<Interaction, InteractionData>();

	static AUTO_DEFER_TIMEOUT = seconds(1);

	/**
	 * @param interaction
	 */
	static add(interaction: ChatInteraction) {
		const { channel } = interaction;
		const interactionData: InteractionData = {
			deferReplyPromise: null,
			deferUpdatePromise: null,
			useEphemeral:
				this.#checkEphemeralOption(interaction) ??
				(channel !== null && channel.type !== 'DM'
					? !channel.name.includes('command') && !channel.name.includes('ᴄᴏᴍᴍᴀɴᴅ') // guild channel
					: false), // DM channel
			autoDefer: setTimeout(
				// interactions must be acked within 3 seconds
				() => {
					logger.warn(
						`[INTERACTION UTIL]: ${this.logInfo(interaction)}: auto defer triggered after ${
							Date.now() - interaction.createdTimestamp
						} ms`,
					);

					if (interaction.isMessageComponent()) {
						this.deferUpdate(interaction);
					} else {
						this.deferReply(interaction);
					}

					interactionData.autoDefer = null;
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
	static #checkEphemeralOption(interaction: ChatInteraction) {
		if (interaction.isMessageComponent()) return null;

		switch ((interaction.options as CommandInteractionOptionResolver).getString('visibility')) {
			case 'everyone':
				return false;

			case 'just me':
				return true;

			default:
				return null;
		}
	}

	/**
	 * wether the error is due to an interaction reply
	 * @param error
	 */
	static isInteractionError(error: unknown) {
		if (!(error instanceof DiscordAPIError)) return false;

		switch (error.code) {
			case RESTJSONErrorCodes.UnknownInteraction:
			case RESTJSONErrorCodes.UnknownWebhook:
			case RESTJSONErrorCodes.InvalidWebhookToken:
				return true;

			default:
				return false;
		}
	}

	/**
	 * @param interaction
	 */
	static logInfo(interaction: Interaction) {
		if (interaction.isCommand()) {
			return `${interaction.type} '${interaction}' by ${interaction.user.tag}${
				interaction.guildId ? ` | ${(interaction.member as GuildMember).displayName}` : ''
			} in ${
				interaction.guildId
					? `#${(interaction.channel as BaseGuildTextChannel)?.name ?? interaction.channelId} | ${
							interaction.guild!.name
					  }`
					: 'DMs'
			}`;
		}

		if (interaction.isButton()) {
			return `${interaction.componentType} '${interaction.customId}' by ${interaction.user.tag}${
				interaction.guildId ? ` | ${(interaction.member as GuildMember).displayName}` : ''
			} in ${
				interaction.guildId
					? `#${(interaction.channel as BaseGuildTextChannel)?.name ?? interaction.channelId} | ${
							interaction.guild!.name
					  }`
					: 'DMs'
			}`;
		}

		if (interaction.isSelectMenu()) {
			return `${interaction.componentType} '${interaction.customId} [${interaction.values}]' by ${
				interaction.user.tag
			}${interaction.guildId ? ` | ${(interaction.member as GuildMember).displayName}` : ''} in ${
				interaction.guildId
					? `#${(interaction.channel as BaseGuildTextChannel)?.name ?? interaction.channelId} | ${
							interaction.guild!.name
					  }`
					: 'DMs'
			}`;
		}

		if (interaction.isContextMenu()) {
			return `${interaction.targetType} '${interaction.commandName}' by ${interaction.user.tag}${
				interaction.guildId ? ` | ${(interaction.member as GuildMember).displayName}` : ''
			} in ${
				interaction.guildId
					? `#${(interaction.channel as BaseGuildTextChannel)?.name ?? interaction.channelId} | ${
							interaction.guild!.name
					  }`
					: 'DMs'
			}`;
		}

		return `unknown type '${interaction.type}' by ${interaction.user.tag}${
			interaction.guildId ? ` | ${(interaction.member as GuildMember).displayName}` : ''
		} in ${
			interaction.guildId
				? `#${(interaction.channel as BaseGuildTextChannel)?.name ?? interaction.channelId} | ${
						interaction.guild!.name
				  }`
				: 'DMs'
		}`;
	}

	/**
	 * appends the first option name if the command is a subcommand or subcommand group
	 * @param interaction
	 */
	static fullCommandName(interaction: Interaction) {
		if (interaction.isMessageComponent()) {
			return `${interaction.componentType} '${interaction.customId}'`;
		}

		return [
			(interaction as CommandInteraction).commandName,
			(interaction as CommandInteraction).options.getSubcommandGroup(false),
			(interaction as CommandInteraction).options.getSubcommand(false),
		]
			.filter((x) => x !== null)
			.join(' ');
	}

	/**
	 * wether the force option was set to true
	 * @param interaction
	 */
	static checkForce(interaction: CommandInteraction) {
		return interaction.options.getBoolean('force') ?? false;
	}

	/**
	 * @param interaction
	 * @param options
	 */
	static async deferReply(
		interaction: ChatInteraction,
		options?: DeferReplyOptions & { fetchReply: true; rejectOnError: true },
	): Promise<Message>;
	static async deferReply(interaction: ChatInteraction, options?: DeferReplyOptions): Promise<void | Message>;
	static async deferReply(interaction: ChatInteraction, options?: DeferReplyOptions) {
		const cached = this.CACHE.get(interaction)!;
		if (cached.deferReplyPromise) return cached.deferReplyPromise;

		if (interaction.replied) {
			if (options?.rejectOnError) throw new Error(`[INTERACTION UTIL]: ${this.logInfo(interaction)}: already replied`);
			return logger.warn(`[INTERACTION UTIL]: ${this.logInfo(interaction)}: already replied`);
		}

		clearTimeout(cached.autoDefer!);

		try {
			return await (cached.deferReplyPromise = interaction.deferReply({ ephemeral: cached.useEphemeral, ...options }));
		} catch (error) {
			if (options?.rejectOnError) throw error;
			logger.error(error, `[INTERACTION UTIL]: ${this.logInfo(interaction)}: deferReply`);
		}
	}

	/**
	 * @param interaction
	 * @param options
	 */
	static async reply(
		interaction: ChatInteraction,
		options: InteractionUtilReplyOptions & { rejectOnError: true; fetchReply: true },
	): Promise<Message>;
	static async reply(
		interaction: ChatInteraction,
		options: InteractionUtilReplyOptions & { rejectOnError: true },
	): Promise<void | Message>;
	static async reply(
		interaction: ChatInteraction,
		options: string | InteractionUtilReplyOptions,
	): Promise<void | null | Message>;
	static async reply(
		interaction: ChatInteraction,
		options: string | InteractionUtilReplyOptions,
	): Promise<void | null | Message> {
		const cached = this.CACHE.get(interaction)!;
		const _options =
			typeof options === 'string'
				? { ephemeral: cached.useEphemeral, content: options }
				: { ephemeral: cached.useEphemeral, ...options };

		try {
			/**
			 * allow split option for CommandInteraction#reply
			 */
			if (_options.split || _options.code) {
				for (const content of makeContent(_options.content ?? '', { split: _options.split, code: _options.code })) {
					await this.reply(interaction, { ..._options, content, split: false, code: false });
				}
				return;
			}

			// replied
			if (interaction.replied) return (await interaction.followUp(_options)) as Message;

			// await defers
			if (cached.deferReplyPromise) await cached.deferReplyPromise;
			if (cached.deferUpdatePromise) await cached.deferUpdatePromise;

			// deferred but not replied
			if (interaction.deferred) {
				// "change" ephemeral state
				if (interaction.ephemeral) {
					if (!_options.ephemeral) await interaction.editReply('\u200B'); // ephemeral defer -> not ephemeraly reply
				} else if (_options.ephemeral) {
					await interaction.deleteReply(); // not ephemeral defer -> ephemeral reply
				}

				return (await interaction.followUp(_options)) as Message;
			}

			// initial reply
			clearTimeout(cached.autoDefer!);
			return await interaction.reply(_options);
		} catch (error) {
			if (this.isInteractionError(error)) {
				logger.error(error);
				if (_options.ephemeral) return UserUtil.sendDM(interaction.user, _options);
				return ChannelUtil.send(interaction.channel!, _options);
			}

			if (_options.rejectOnError) throw error;
			logger.error(error);
		}
	}

	/**
	 * @param interaction
	 * @param options
	 * @param message optional followUp Message to edit
	 */
	static async editReply(
		interaction: ChatInteraction,
		options: EditReplyOptions,
		message: MessageResolvable,
	): Promise<Message>;
	static async editReply(
		interaction: ChatInteraction,
		options: EditReplyOptions & { rejectOnError: true },
	): Promise<Message>;
	static async editReply(interaction: ChatInteraction, options: string | EditReplyOptions): Promise<null | Message>;
	static async editReply(
		interaction: ChatInteraction,
		options: string | EditReplyOptions,
		message?: MessageResolvable,
	) {
		try {
			if (message) return (await interaction.webhook.editMessage(message, options)) as Message;

			const { deferReplyPromise, deferUpdatePromise } = this.CACHE.get(interaction)!;

			if (deferReplyPromise) await deferReplyPromise;
			if (deferUpdatePromise) await deferUpdatePromise;

			return (await interaction.editReply(options)) as Message;
		} catch (error) {
			if (this.isInteractionError(error)) {
				logger.error(error);

				try {
					return MessageUtil.edit((await interaction.fetchReply()) as Message, options);
				} catch (error_) {
					if (typeof options !== 'string' && options.rejectOnError) throw error_;
					logger.error(error_);
					return null;
				}
			}

			if (typeof options !== 'string' && options.rejectOnError) throw error;
			logger.error(error);
			return null;
		}
	}

	/**
	 * @param interaction
	 * @param options
	 */
	static async deferUpdate(
		interaction: ChatInteraction,
		options?: DeferReplyOptions & { fetchReply: true; rejectOnError: true },
	): Promise<Message>;
	static async deferUpdate(interaction: ChatInteraction, options?: DeferReplyOptions): Promise<void | Message>;
	static async deferUpdate(
		interaction: MessageComponentInteraction,
		options?: DeferUpdateOptions,
	): Promise<void | Message> {
		const cached = this.CACHE.get(interaction)!;
		if (cached.deferUpdatePromise) return cached.deferUpdatePromise;

		if (interaction.replied) return logger.warn(`[INTERACTION UTIL]: ${this.logInfo(interaction)}: already replied`);

		clearTimeout(cached.autoDefer!);

		try {
			return await (cached.deferUpdatePromise = interaction.deferUpdate(options));
		} catch (error) {
			if (options?.rejectOnError) throw error;
			logger.error(error, `[INTERACTION UTIL]: ${this.logInfo(interaction)}: deferUpdate`);
		}
	}

	/**
	 * @param interaction
	 * @param options
	 */
	static async update(
		interaction: MessageComponentInteraction,
		options: UpdateOptions & { rejectOnError: true },
	): Promise<Message>;
	static async update(interaction: MessageComponentInteraction, options: UpdateOptions): Promise<void | Message>;
	static async update(interaction: MessageComponentInteraction, options: UpdateOptions): Promise<void | Message> {
		const cached = this.CACHE.get(interaction)!;

		try {
			if (cached.deferReplyPromise) await cached.deferReplyPromise;

			// replied
			if (interaction.replied) {
				return (await interaction.webhook.editMessage(
					interaction.message as Message,
					options as WebhookEditMessageOptions,
				)) as Message;
			}

			// await defer
			if (cached.deferUpdatePromise) await cached.deferUpdatePromise;

			// deferred but not replied
			if (interaction.deferred) return (await interaction.editReply(options as WebhookEditMessageOptions)) as Message;

			// initial reply
			clearTimeout(cached.autoDefer!);
			return await interaction.update(options);
		} catch (error) {
			if (this.isInteractionError(error)) {
				logger.error(error);
				return MessageUtil.edit(interaction.message as Message, options);
			}

			if (options.rejectOnError) throw error;
			logger.error(error);
		}
	}

	/**
	 * deletes the message which the component is attached to
	 * @param interaction
	 */
	static async deleteMessage(interaction: MessageComponentInteraction) {
		const cached = this.CACHE.get(interaction)!;

		try {
			if (cached.deferReplyPromise) await cached.deferReplyPromise;

			// replied
			if (interaction.replied) return MessageUtil.delete(interaction.message as Message);

			await this.deferUpdate(interaction, { rejectOnError: true });
			await interaction.deleteReply();

			return interaction.message as Message;
		} catch (error) {
			logger.error(error, `[INTERACTION UTIL]: ${this.logInfo(interaction)}: deleteMessage`);
			return interaction.message as Message;
		}
	}

	/**
	 * posts question in same channel and returns content of first reply or null if timeout
	 * @param interaction
	 * @param options
	 */
	static async awaitReply(interaction: ChatInteraction, options: string | AwaitReplyOptions = {}) {
		const {
			question = 'confirm this action?',
			time = seconds(60),
			..._options
		} = typeof options === 'string' ? { question: options } : options;

		try {
			const channel =
				interaction.channel ?? ((await interaction.client.channels.fetch(interaction.channelId!)) as TextBasedChannels);

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
			logger.error(error);
			return null;
		}
	}

	/**
	 * confirms the action via a button collector
	 * @param interaction
	 * @param options
	 */
	static async awaitConfirmation(interaction: ChatInteraction, options: string | AwaitConfirmationOptions = {}) {
		const {
			question = 'confirm this action?',
			time = seconds(60),
			errorMessage = 'the command has been cancelled',
			..._options
		} = typeof options === 'string' ? { question: options } : options;
		const SUCCESS_ID = `confirm:${SnowflakeUtil.generate()}`;
		const CANCLE_ID = `confirm:${SnowflakeUtil.generate()}`;
		const row = new MessageActionRow().addComponents(
			new MessageButton().setCustomId(SUCCESS_ID).setStyle(Constants.MessageButtonStyles.SUCCESS).setEmoji(Y_EMOJI),
			new MessageButton().setCustomId(CANCLE_ID).setStyle(Constants.MessageButtonStyles.DANGER).setEmoji(X_EMOJI),
		);

		let channel: TextBasedChannels;
		let message: Message | void;

		try {
			channel =
				interaction.channel ?? ((await interaction.client.channels.fetch(interaction.channelId)) as TextBasedChannels);

			message = await this.reply(interaction, {
				embeds: [(interaction.client as LunarClient).defaultEmbed.setDescription(question)],
				components: [row],
				fetchReply: false,
				rejectOnError: true,
				..._options,
			});
		} catch (error) {
			logger.error(error);
			throw errorMessage;
		}

		let success = false;

		try {
			const result = await channel.awaitMessageComponent({
				componentType: Constants.MessageComponentTypes.BUTTON,
				filter: (i) => {
					if (i.user.id !== interaction.user.id) {
						this.reply(interaction, {
							content: 'that is not up to you to decide',
							ephemeral: true,
						});
						return false;
					}

					return [SUCCESS_ID, CANCLE_ID].includes(i.customId);
				},
				time,
			});

			success = result.customId === SUCCESS_ID;

			this.update(result, {
				embeds: [
					new MessageEmbed()
						.setColor((interaction.client as LunarClient).config.get(success ? 'EMBED_GREEN' : 'EMBED_RED'))
						.setDescription(
							stripIndent`
								${question}
								\\> ${success ? 'confirmed' : 'cancelled'}
							`,
						)
						.setTimestamp(),
				],
				components: [row.setComponents(row.components.map((c) => c.setDisabled()))],
			});
		} catch (error) {
			const editOptions = {
				embeds: [
					new MessageEmbed()
						.setColor('NOT_QUITE_BLACK')
						.setDescription(
							stripIndent`
								${question}
								\\> timeout
							`,
						)
						.setTimestamp(),
				],
				components: [row.setComponents(row.components.map((c) => c.setDisabled()))],
			};

			try {
				await this.editReply(interaction, editOptions, message ?? '@original');
			} catch (error_) {
				logger.error(error_);
				this.reply(interaction, editOptions);
			}

			logger.debug(error);
		}

		if (!success) throw errorMessage;
	}

	/**
	 * react in order if the message is not deleted and the client has 'ADD_REACTIONS', catching promise rejections
	 * @param interaction
	 * @param emojis
	 */
	static async react(interaction: CommandInteraction, ...emojis: EmojiIdentifierResolvable[]) {
		if (interaction.ephemeral) return null;

		try {
			return MessageUtil.react((await interaction.fetchReply()) as Message, ...emojis);
		} catch (error) {
			return logger.error(error);
		}
	}

	/**
	 * returns the player object, optional fallback to the interaction.user's player
	 * @param interaction
	 * @param options
	 */
	static getPlayer(interaction: CommandInteraction, options: GetPlayerOptions & { throwIfNotFound: true }): Player;
	static getPlayer(interaction: CommandInteraction, options?: GetPlayerOptions): Player | null;
	static getPlayer(interaction: CommandInteraction, { fallbackToCurrentUser = false, throwIfNotFound = false } = {}) {
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
			const player = (interaction.client as LunarClient).players.getById(INPUT);
			if (throwIfNotFound && !player) throw `no player linked to \`${INPUT}\` found`;
			return player;
		}

		if (validateMinecraftUuid(INPUT)) {
			const player = (interaction.client as LunarClient).players.cache.get(INPUT) ?? null;
			if (throwIfNotFound && !player) throw `no player linked to \`${INPUT}\` found`;
			return player;
		}

		const player =
			(this.checkForce(interaction)
				? (interaction.client as LunarClient).players.cache.find(({ ign }) => ign.toLowerCase() === INPUT)
				: (interaction.client as LunarClient).players.getByIgn(INPUT)) ?? null;
		if (throwIfNotFound && !player) throw `no player linked to \`${INPUT}\` found`;
		return player;
	}

	/**
	 * returns the player object's IGN, optional fallback to interaction.user's player
	 * @param interaction
	 * @param fallbackToCurrentUser
	 */
	static getIgn(interaction: CommandInteraction, options: GetPlayerOptions & { throwIfNotFound: true }): string;
	static getIgn(interaction: CommandInteraction, options?: GetPlayerOptions): string | null;
	static getIgn(interaction: CommandInteraction, options?: GetPlayerOptions) {
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
	 */
	static getHypixelGuild(
		interaction: Interaction,
		options: { fallbackIfNoInput?: true; includeAll: true },
	): HypixelGuild | typeof GUILD_ID_ALL;
	static getHypixelGuild(
		interaction: Interaction,
		options: { fallbackIfNoInput: false; includeAll: true },
	): HypixelGuild | typeof GUILD_ID_ALL | null;
	static getHypixelGuild(
		interaction: Interaction,
		options?: { fallbackIfNoInput?: true; includeAll?: false },
	): HypixelGuild;
	static getHypixelGuild(
		interaction: Interaction,
		options: { fallbackIfNoInput: false; includeAll?: false },
	): HypixelGuild | null;
	static getHypixelGuild(
		interaction: Interaction,
		{ fallbackIfNoInput = true, includeAll = false }: GetHypixelGuildOptions = {},
	) {
		const INPUT = (interaction as CommandInteraction).options?.getString('guild');

		if (INPUT) {
			if (includeAll && INPUT.toUpperCase() === GUILD_ID_ALL) return GUILD_ID_ALL;

			const hypixelGuild =
				(interaction.client as LunarClient).hypixelGuilds.cache.get(INPUT) ??
				(interaction.client as LunarClient).hypixelGuilds.findByName(INPUT);

			if (hypixelGuild) return hypixelGuild;
		}

		if (fallbackIfNoInput) {
			return (
				(interaction.guildId
					? (interaction.client as LunarClient).hypixelGuilds.findByDiscordGuild(interaction.guild)
					: UserUtil.getPlayer(interaction.user)?.hypixelGuild) ??
				(interaction.client as LunarClient).hypixelGuilds.mainGuild
			);
		}

		return null;
	}
}
