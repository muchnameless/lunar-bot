'use strict';

const { MessageActionRow, MessageSelectMenu, MessageEmbed, Formatters, Constants } = require('discord.js');
const { stripIndents } = require('common-tags');
const { upperCaseFirstChar } = require('../../functions/util');
const { getUuidAndIgn } = require('../../functions/input');
const { AH_KEY } = require('../../constants/redis');
const hypixel = require('../../api/hypixel');
const SlashCommand = require('../../structures/commands/SlashCommand');
const logger = require('../../functions/logger');


module.exports = class AhCommand extends SlashCommand {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'SkyBlock auctions',
			options: [{
				name: 'ign',
				type: Constants.ApplicationCommandOptionTypes.STRING,
				description: 'IGN | UUID',
				required: false,
			}, SlashCommand.SKYBLOCK_PROFILE_OPTION ],
			cooldown: 0,
		});
	}

	/**
	 * 99_137 -> 99K, 1_453_329 -> 1.5M
	 * @param {number} number
	 * @param {number} [decimalPlaces=0]
	 */
	static shortenNumber(number) {
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
	 * @param {{ ign: string, uuid: string, profileId: string, profiles: { label: string, value: string }[] }} param0
	 */
	async #generateReply({ ign, uuid, profileId, profiles }) {
		try {
			const { label: PROFILE_NAME } = profiles.find(({ value }) => value === profileId);
			const embed = this.client.defaultEmbed
				.setAuthor(ign, `https://visage.surgeplay.com/bust/${uuid}`, `https://sky.shiiyu.moe/stats/${ign}/${PROFILE_NAME}`);
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
								.setCustomId(`${AH_KEY}:${uuid}:${ign}`)
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
									const matched = lore.match(/(?<=^(§[0-9a-gk-or])+)[^§\n]+/)?.[0];
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
							.setCustomId(`${AH_KEY}:${uuid}:${ign}`)
							.setPlaceholder(`Profile: ${PROFILE_NAME}`)
							.addOptions(profiles),
					),
				],
			};
		} catch (error) {
			logger.error(error);

			return {
				embeds: [
					new MessageEmbed()
						.setColor(this.config.get('EMBED_RED'))
						.setDescription(`${error}`)
						.setTimestamp(),
				],
			};
		}
	}

	/**
	 * @param {import('discord.js').SelectMenuInteraction} interaction
	 */
	async runSelect(interaction) {
		this.deferUpdate(interaction);

		try {
			const [ , uuid, ign ] = interaction.customId.split(':');
			const [ profileId ] = interaction.values;
			const profiles = interaction.message.components[0]?.components[0].options
				?? (await hypixel.skyblock.profiles.uuid(uuid)).map(({ cute_name: name, profile_id: id }) => ({ label: name, value: id }));

			// interaction from original requester -> edit message
			if (interaction.user.id === interaction.message.interaction?.user.id) return interaction.update(await this.#generateReply({ uuid, ign, profileId, profiles }));

			// interaction from new requester -> new message
			return this.followUp(interaction, await this.#generateReply({ uuid, ign, profileId, profiles }));
		} catch (error) {
			logger.error(error);

			return this.followUp(interaction, {
				content: `${error}`,
				ephemeral: true,
			});
		}
	}

	/**
	 * execute the command
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async run(interaction) {
		this.deferReply(interaction);

		try {
			const { ign, uuid } = await getUuidAndIgn(interaction, interaction.options.getString('ign'));
			const profiles = await hypixel.skyblock.profiles.uuid(uuid);
			const embed = this.client.defaultEmbed;

			if (!profiles.length) {
				return this.reply(interaction, {
					embeds: [
						embed
							.setAuthor(ign, `https://visage.surgeplay.com/bust/${uuid}`, `https://sky.shiiyu.moe/stats/${ign}`)
							.setDescription('no SkyBlock profiles'),
					],
					components: [
						new MessageActionRow().addComponents(
							new MessageSelectMenu()
								.setCustomId(`${AH_KEY}:${uuid}:${ign}`)
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
				const LAST_PROFILE_SAVE = Math.max(...profiles.map(({ members }) => members[uuid].last_save));

				({ profile_id: profileId, cute_name: profileName } = profiles.find(({ members }) => members[uuid].last_save === LAST_PROFILE_SAVE));
			} else {
				profileName = PROFILE_NAME_INPUT;
				profileId = profiles.find(({ cute_name: name }) => name === PROFILE_NAME_INPUT)?.profile_id;

				if (!profileId) {
					return this.reply(interaction, {
						embeds: [
							embed
								.setAuthor(ign, `https://visage.surgeplay.com/bust/${uuid}`, `https://sky.shiiyu.moe/stats/${ign}`)
								.setDescription(`no SkyBlock profile named \`${profileName}\``),
						],
						components: [
							new MessageActionRow().addComponents(
								new MessageSelectMenu()
									.setCustomId(`${AH_KEY}:${uuid}:${ign}`)
									.setPlaceholder(`Profile: ${profileName} (invalid)`)
									.addOptions(profiles.map(({ cute_name: name, profile_id: id }) => ({ label: name, value: id }))),
							),
						],
					});
				}
			}

			return this.reply(interaction, await this.#generateReply({ ign, uuid, profileId, profiles: profiles.map(({ cute_name: name, profile_id: id }) => ({ label: name, value: id })) }));
		} catch (error) {
			logger.error(error);
			return await this.reply(interaction, `${error}`);
		}
	}
};
