import { SlashCommandBuilder } from '@discordjs/builders';
import { MessageActionRow, MessageSelectMenu, Formatters } from 'discord.js';
import { stripIndents } from 'common-tags';
import { COMMAND_KEY } from '../../constants';
import { hypixel } from '../../api/hypixel';
import { optionalIgnOption, skyblockProfileOption } from '../../structures/commands/commonOptions';
import { InteractionUtil } from '../../util';
import { getUuidAndIgn, logger, upperCaseFirstChar, uuidToImgurBustURL } from '../../functions';
import { SlashCommand } from '../../structures/commands/SlashCommand';
import type { CommandInteraction, HexColorString, SelectMenuInteraction, Snowflake } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';


export default class AhCommand extends SlashCommand {
	constructor(context: CommandContext) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('SkyBlock auctions')
				.addStringOption(optionalIgnOption)
				.addStringOption(skyblockProfileOption),
			cooldown: 0,
		});
	}

	/**
	 * 99_137 -> 99K, 1_453_329 -> 1.5M
	 * @param number
	 */
	static shortenNumber(number: number) {
		let str;
		let suffix;

		if (number < 1e3) {
			str = number;
			suffix = '';
		} else if (number < 1e6) {
			str = Math.round(number / 1e3);
			suffix = 'K';
		} else if (number < 1e9) {
			str = Math.round(number / (1e6 / 10)) / 10;
			suffix = 'M';
		} else if (number < 1e12) {
			str = Math.round(number / (1e9 / 10)) / 10;
			suffix = 'B';
		} else if (number < 1e15) {
			str = Math.round(number / (1e12 / 10)) / 10;
			suffix = 'T';
		}

		return `${str}${suffix}`;
	}

	/**
	 * @param param0
	 */
	#generateCustomId({ uuid, ign, userId }: { ign: string; uuid: string; userId: Snowflake; }) {
		return `${COMMAND_KEY}:${this.name}:${uuid}:${ign}:${userId}`;
	}

	/**
	 * @param param0
	 */
	async #generateReply({ ign, uuid, profileId, profiles, userId }: { ign: string; uuid: string; profileId: string; profiles: { label: string; value: string; }[]; userId: Snowflake; }) {
		const { label: PROFILE_NAME } = profiles.find(({ value }) => value === profileId);
		const embed = this.client.defaultEmbed
			.setAuthor(ign, (await uuidToImgurBustURL(uuid))!, `https://sky.shiiyu.moe/stats/${ign}/${PROFILE_NAME}`);

		try {
			const auctions = (await hypixel.skyblock.auction.profile(profileId))
				.filter(({ claimed }) => !claimed)
				.sort((a, b) => a.end - b.end);

			if (!auctions.length) {
				return {
					embeds: [
						embed.setDescription('no unclaimed auctions'),
					],
					components: [
						new MessageActionRow().addComponents(
							new MessageSelectMenu()
								.setCustomId(this.#generateCustomId({ uuid, ign, userId }))
								.setPlaceholder(`Profile: ${PROFILE_NAME}`)
								.addOptions(profiles),
						),
					],
				};
			}

			let totalCoins = 0;
			let totalUnclaimedCoins = 0;
			let endedAuctions = 0;

			for (const { highest_bid_amount: highestBid, starting_bid: startingBid, bids, end, item_name: item, tier, bin, item_lore: lore, auctioneer } of auctions) {
				embed.addFields({
					name: `${item}${
						item.startsWith('[Lvl ')
							? ` - ${upperCaseFirstChar(tier)}`
							: item === 'Enchanted Book'
								? (() => {
									const matched = lore.match(/(?<=^(§[\da-gk-or])+)[^\n§]+/)?.[0];
									if (matched) return ` - ${matched}`;
									return '';
								})()
								: ''
					}${auctioneer === uuid ? '' : ' [CO-OP]'}`,
					value: `${
						bin
							? `BIN: ${AhCommand.shortenNumber(startingBid)}`
							: bids.length
								? (totalCoins += highestBid, `Highest Bid: ${AhCommand.shortenNumber(highestBid)}`)
								: `Starting Bid: ${AhCommand.shortenNumber(startingBid)}`
					} • ${
						end < Date.now()
							? highestBid
								? (++endedAuctions, totalUnclaimedCoins += highestBid, 'sold')
								: 'expired'
							: 'ends'
					} ${Formatters.time(new Date(end), Formatters.TimestampStyles.RelativeTime)}`,
				});
			}

			totalCoins += totalUnclaimedCoins;

			return {
				embeds: [
					embed.setDescription(stripIndents`
						unclaimed: ${AhCommand.shortenNumber(totalUnclaimedCoins)} coins from ${endedAuctions} auctions
						total: ${AhCommand.shortenNumber(totalCoins)} coins from ${auctions.length} auctions
					`),
				],
				components: [
					new MessageActionRow().addComponents(
						new MessageSelectMenu()
							.setCustomId(this.#generateCustomId({ uuid, ign, userId }))
							.setPlaceholder(`Profile: ${PROFILE_NAME}`)
							.addOptions(profiles),
					),
				],
			};
		} catch (error) {
			logger.error(error);

			return {
				embeds: [
					embed
						.setColor(this.config.get('EMBED_RED') as HexColorString)
						.setDescription(`${error}`),
				],
			};
		}
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async runSelect(interaction: SelectMenuInteraction) {
		try {
			const [ , , uuid, ign, userId ] = interaction.customId.split(':');
			const [ profileId ] = interaction.values;
			const profiles = interaction.message.components![0].components[0].options;

			// interaction from original requester -> edit message
			if (interaction.user.id === userId) {
				return await InteractionUtil.update(interaction, await this.#generateReply({ uuid, ign, profileId, profiles, userId }));
			}

			// interaction from new requester -> new message
			return await InteractionUtil.reply(interaction, await this.#generateReply({ uuid, ign, profileId, profiles, userId: interaction.user.id }));
		} catch (error) {
			logger.error(error);

			return await InteractionUtil.reply(interaction, {
				content: `${error}`,
				ephemeral: true,
			});
		}
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async runSlash(interaction: CommandInteraction) {
		try {
			const { ign, uuid } = await getUuidAndIgn(interaction, interaction.options.getString('ign'));
			const profiles = await hypixel.skyblock.profiles.uuid(uuid);
			const embed = this.client.defaultEmbed;

			if (!profiles.length) {
				return await InteractionUtil.reply(interaction, {
					embeds: [
						embed
							.setAuthor(ign, (await uuidToImgurBustURL(uuid))!, `https://sky.shiiyu.moe/stats/${ign}`)
							.setDescription('no SkyBlock profiles'),
					],
					components: [
						new MessageActionRow().addComponents(
							new MessageSelectMenu()
								.setCustomId(this.#generateCustomId({ uuid, ign, userId: interaction.user.id }))
								.setDisabled(true)
								.setPlaceholder('Profile: None'),
						),
					],
				});
			}

			const PROFILE_NAME_INPUT = interaction.options.getString('profile');

			let profileId;
			let profileName;

			if (!PROFILE_NAME_INPUT) {
				// get profile with the latest last_save, profiles without that property are treated as last candidates
				[{ profile_id: profileId, cute_name: profileName }] = profiles.sort((a, b) => (Reflect.has(b.members[uuid], 'last_save') ? b.members[uuid].last_save - a.members[uuid].last_save : -1));
			} else {
				profileName = PROFILE_NAME_INPUT;
				profileId = profiles.find(({ cute_name: name }) => name === PROFILE_NAME_INPUT)?.profile_id;

				if (!profileId) {
					return await InteractionUtil.reply(interaction, {
						embeds: [
							embed
								.setAuthor(ign, (await uuidToImgurBustURL(uuid))!, `https://sky.shiiyu.moe/stats/${ign}`)
								.setDescription(`no SkyBlock profile named \`${profileName}\``),
						],
						components: [
							new MessageActionRow().addComponents(
								new MessageSelectMenu()
									.setCustomId(this.#generateCustomId({ uuid, ign, userId: interaction.user.id }))
									.setPlaceholder(`Profile: ${profileName} (invalid)`)
									.addOptions(profiles.map(({ cute_name: name, profile_id: id }) => ({ label: name, value: id }))),
							),
						],
					});
				}
			}

			return await InteractionUtil.reply(interaction, await this.#generateReply({
				ign,
				uuid,
				profileId,
				profiles: profiles.map(({ cute_name: name, profile_id: id }) => ({ label: name, value: id })),
				userId: interaction.user.id,
			}));
		} catch (error) {
			logger.error(error);
			return await InteractionUtil.reply(interaction, `${error}`);
		}
	}
}
