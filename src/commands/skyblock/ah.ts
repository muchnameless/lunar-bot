import { type Components } from '@zikeji/hypixel';
import { stripIndents } from 'common-tags';
import {
	ActionRowBuilder,
	SelectMenuBuilder,
	SelectMenuOptionBuilder,
	SlashCommandBuilder,
	time,
	TimestampStyles,
	type APISelectMenuOption,
	type ChatInputCommandInteraction,
	type EmbedBuilder,
	type MessageActionRowComponentBuilder,
	type SelectMenuInteraction,
	type Snowflake,
} from 'discord.js';
import { getSkyBlockProfiles, hypixel } from '#api';
import { PROFILE_EMOJIS, STATS_URL_BASE, type FindProfileStrategy } from '#constants';
import {
	formatError,
	findSkyblockProfile,
	getUuidAndIgn,
	seconds,
	shortenNumber,
	upperCaseFirstChar,
	uuidToBustURL,
} from '#functions';
import { logger } from '#logger';
import { ApplicationCommand } from '#structures/commands/ApplicationCommand.js';
import { type CommandContext } from '#structures/commands/BaseCommand.js';
import {
	optionalIgnOption,
	skyblockFindProfileOption,
	skyblockFindProfileOptionName,
	skyblockProfileOption,
} from '#structures/commands/commonOptions.js';
import { InteractionUtil } from '#utils';

interface GenerateCustomIdOptions {
	ign: string;
	userId: Snowflake;
	uuid: string;
}

interface GenerateReplyOptions {
	ign: string;
	profileId: string;
	profiles: APISelectMenuOption[];
	userId: Snowflake;
	uuid: string;
}

export default class AhCommand extends ApplicationCommand {
	public constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder()
				.setDescription('SkyBlock auctions')
				.addStringOption(optionalIgnOption)
				.addStringOption(skyblockProfileOption)
				.addStringOption(skyblockFindProfileOption),
			cooldown: seconds(1),
		});
	}

	/**
	 * @param options
	 */
	private _generateCustomId({ uuid, ign, userId }: GenerateCustomIdOptions) {
		return `${this.baseCustomId}:${uuid}:${ign}:${userId}` as const;
	}

	/**
	 * @param options
	 */
	private async _generateReply({ ign, uuid, profileId, profiles, userId }: GenerateReplyOptions) {
		const { label: PROFILE_NAME } = profiles.find(({ value }) => value === profileId)!;
		const embed = this.client.defaultEmbed //
			.setAuthor({
				name: ign,
				iconURL: uuidToBustURL(uuid),
				url: `${STATS_URL_BASE}${ign}/${PROFILE_NAME}`,
			});

		try {
			const auctions = (await hypixel.skyblock.auction.profile(profileId)).auctions
				.filter(({ claimed }) => !claimed)
				.sort(({ end: a }, { end: b }) => a - b);

			if (!auctions.length) {
				return {
					embeds: [embed.setDescription('no unclaimed auctions')],
					components: [
						new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
							new SelectMenuBuilder()
								.setCustomId(this._generateCustomId({ uuid, ign, userId }))
								.setPlaceholder(`Profile: ${PROFILE_NAME}`)
								.addOptions(profiles),
						),
					],
				};
			}

			let totalCoins = 0;
			let totalUnclaimedCoins = 0;
			let endedAuctions = 0;

			for (const {
				highest_bid_amount: highestBid,
				starting_bid: startingBid,
				bids,
				end,
				item_name: item,
				tier,
				bin,
				item_lore: lore,
				auctioneer,
			} of auctions) {
				embed.addFields({
					name: `${item}${
						item.startsWith('[Lvl ')
							? ` - ${upperCaseFirstChar(tier)}`
							: item === 'Enchanted Book'
							? (() => {
									const matched = lore.match(/(?<=^(?:§[\da-gk-or])+)[^\n§]+/)?.[0];
									if (matched) return ` - ${matched}`;
									return '';
							  })()
							: ''
					}${auctioneer === uuid ? '' : ' [CO-OP]'}`,
					value: `${
						bin
							? `BIN: ${shortenNumber(startingBid)}`
							: bids.length
							? ((totalCoins += highestBid), `Highest Bid: ${shortenNumber(highestBid)}`)
							: `Starting Bid: ${shortenNumber(startingBid)}`
					} • ${
						end < Date.now()
							? highestBid
								? (++endedAuctions, (totalUnclaimedCoins += highestBid), 'sold')
								: 'expired'
							: 'ends'
					} ${time(seconds.fromMilliseconds(end), TimestampStyles.RelativeTime)}`,
				});
			}

			totalCoins += totalUnclaimedCoins;

			return {
				embeds: [
					embed.setDescription(stripIndents`
						unclaimed: ${shortenNumber(totalUnclaimedCoins)} coins from ${endedAuctions} auctions
						total: ${shortenNumber(totalCoins)} coins from ${auctions.length} auctions
					`),
				],
				components: [
					new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
						new SelectMenuBuilder()
							.setCustomId(this._generateCustomId({ uuid, ign, userId }))
							.setPlaceholder(`Profile: ${PROFILE_NAME}`)
							.addOptions(profiles),
					),
				],
			};
		} catch (error) {
			logger.error(error);

			return {
				embeds: [
					embed //
						.setColor(this.config.get('EMBED_RED'))
						.setDescription(formatError(error)),
				],
			};
		}
	}

	private _generateProfileOptions(profiles: NonNullable<Components.Schemas.SkyBlockProfileCuteName>[]) {
		return profiles.map(({ cute_name, profile_id }) =>
			new SelectMenuOptionBuilder()
				.setEmoji({ name: PROFILE_EMOJIS[cute_name as keyof typeof PROFILE_EMOJIS] })
				.setLabel(cute_name)
				.setValue(profile_id)
				.toJSON(),
		);
	}

	/**
	 * replies with 'no profiles found embed'
	 *
	 * @param interaction
	 * @param embed reply embed
	 * @param ign player ign
	 * @param uuid player minecraft uuid
	 */
	private _handleNoProfiles(
		interaction: ChatInputCommandInteraction<'cachedOrDM'>,
		embed: EmbedBuilder,
		ign: string,
		uuid: string,
	) {
		return InteractionUtil.reply(interaction, {
			embeds: [
				embed
					.setAuthor({
						name: ign,
						iconURL: uuidToBustURL(uuid),
						url: `${STATS_URL_BASE}${ign}`,
					})
					.setDescription('no SkyBlock profiles'),
			],
			components: [
				new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
					new SelectMenuBuilder()
						.setCustomId(this._generateCustomId({ uuid, ign, userId: interaction.user.id }))
						.setDisabled(true)
						.setPlaceholder('Profile: None'),
				),
			],
		});
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 * @param args parsed customId, split by ':'
	 */
	public override async selectMenuRun(interaction: SelectMenuInteraction<'cachedOrDM'>, args: string[]) {
		const [uuid, ign, userId] = args as [string, string, string];
		const [profileId] = interaction.values as [string];
		const profiles = interaction.component.options;

		// interaction from original requester -> edit message
		if (interaction.user.id === userId) {
			return InteractionUtil.update(interaction, await this._generateReply({ uuid, ign, profileId, profiles, userId }));
		}

		// interaction from new requester -> new message
		return InteractionUtil.reply(
			interaction,
			await this._generateReply({ uuid, ign, profileId, profiles, userId: interaction.user.id }),
		);
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 */
	public override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		try {
			const { ign, uuid } = await getUuidAndIgn(interaction, interaction.options.getString('ign'));
			const profiles = await getSkyBlockProfiles(uuid);
			const embed = this.client.defaultEmbed;

			if (!profiles?.length) return this._handleNoProfiles(interaction, embed, ign, uuid);

			const PROFILE_NAME_INPUT = interaction.options.getString('profile');

			let profileId: string | undefined;
			let profileName: string;

			if (PROFILE_NAME_INPUT) {
				profileName = PROFILE_NAME_INPUT;
				profileId = profiles.find(({ cute_name: name }) => name === PROFILE_NAME_INPUT)?.profile_id;

				if (!profileId) {
					return InteractionUtil.reply(interaction, {
						embeds: [
							embed
								.setAuthor({
									name: ign,
									iconURL: uuidToBustURL(uuid),
									url: `${STATS_URL_BASE}${ign}`,
								})
								.setDescription(`no SkyBlock profile named \`${profileName}\``),
						],
						components: [
							new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
								new SelectMenuBuilder()
									.setCustomId(this._generateCustomId({ uuid, ign, userId: interaction.user.id }))
									.setPlaceholder(`Profile: ${profileName} (invalid)`)
									.addOptions(this._generateProfileOptions(profiles)),
							),
						],
					});
				}
			} else {
				const mainProfile = findSkyblockProfile(
					profiles,
					uuid,
					interaction.options.getString(skyblockFindProfileOptionName) as FindProfileStrategy | null,
				);

				if (!mainProfile) return this._handleNoProfiles(interaction, embed, ign, uuid);

				({ profile_id: profileId, cute_name: profileName } = mainProfile);
			}

			return InteractionUtil.reply(
				interaction,
				await this._generateReply({
					ign,
					uuid,
					profileId,
					profiles: this._generateProfileOptions(profiles),
					userId: interaction.user.id,
				}),
			);
		} catch (error) {
			logger.error(error);
			return InteractionUtil.reply(interaction, formatError(error));
		}
	}
}
