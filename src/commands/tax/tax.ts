import { SlashCommandBuilder } from '@discordjs/builders';
import { Permissions, Formatters } from 'discord.js';
import pkg from 'sequelize';
const { Op } = pkg;
import {
	hypixelGuildOption,
	optionalPlayerOption,
	requiredPlayerOption,
} from '../../structures/commands/commonOptions';
import { ChannelUtil, InteractionUtil } from '../../util';
import { escapeIgn, formatNumber, logger, safePromiseAll, validateNumber } from '../../functions';
import { TransactionTypes } from '../../structures/database/models/Transaction';
import { ApplicationCommand } from '../../structures/commands/ApplicationCommand';
import type { CommandInteraction, MessageEmbed, TextChannel } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';

export default class TaxCommand extends ApplicationCommand {
	includeAllHypixelGuilds = true;

	constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder()
				.setDescription('guild tax')
				.addSubcommandGroup((subcommandGroup) =>
					subcommandGroup
						.setName('ah')
						.setDescription('add / remove a player as tax collector')
						.addSubcommand((subcommand) =>
							subcommand
								.setName('add')
								.setDescription('add a player as tax collector')
								.addStringOption(requiredPlayerOption),
						)
						.addSubcommand((subcommand) =>
							subcommand
								.setName('remove')
								.setDescription('remove a player from tax collectors')
								.addStringOption(requiredPlayerOption),
						),
				)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('amount')
						.setDescription('set the tax amount')
						.addIntegerOption((option) => option.setName('amount').setDescription('new tax amount').setRequired(true)),
				)
				.addSubcommand((subcommand) =>
					subcommand.setName('collected').setDescription('show a list of taxahs and their collected tax amount'),
				)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('paid')
						.setDescription('manually set a player to paid')
						.addStringOption(requiredPlayerOption)
						.addIntegerOption((option) =>
							option.setName('amount').setDescription('amount to overwrite the current tax amount').setRequired(false),
						),
				)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('reminder')
						.setDescription('ping all guild members who have not paid')
						.addBooleanOption((option) =>
							option
								.setName('ghostping')
								.setDescription('wether to immediatly delete the pings after sending them')
								.setRequired(false),
						)
						.addStringOption(hypixelGuildOption)
						.addStringOption((option) =>
							option.setName('exclude').setDescription('IGNs to exclude from the ping').setRequired(false),
						),
				)
				.addSubcommand((subcommand) =>
					subcommand.setName('reset').setDescription('reset the tax database').addStringOption(optionalPlayerOption),
				),
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async runSlash(interaction: CommandInteraction) {
		switch (interaction.options.getSubcommandGroup(false)) {
			case 'ah': {
				const player = InteractionUtil.getPlayer(interaction, { throwIfNotFound: true });

				let log: string;

				switch (interaction.options.getSubcommand()) {
					case 'add':
						if (this.client.taxCollectors.cache.get(player.minecraftUuid)?.isCollecting) {
							return InteractionUtil.reply(interaction, `\`${player}\` is already a tax collector`);
						}

						await this.client.taxCollectors.add(player);
						if (!player.paid) player.setToPaid(); // let collector collect their own tax if they have not paid already
						log = `\`${player}\` is now a tax collector`;
						break;

					case 'remove': {
						const taxCollector = this.client.taxCollectors.cache.get(player.minecraftUuid);

						if (!taxCollector?.isCollecting) {
							return InteractionUtil.reply(interaction, `\`${player}\` is not a tax collector`);
						}

						// remove self paid if only the collector paid the default amount at his own ah
						if (
							taxCollector.collectedTax === this.config.get('TAX_AMOUNT') &&
							(await player.transactions)[0].to === player.minecraftUuid
						) {
							logger.info(`[TAX AH]: ${player}: removed and reset tax paid`);
							await player.resetTax();
							await taxCollector.remove();
						} else {
							await taxCollector.update({ isCollecting: false });
						}

						log = `\`${taxCollector}\` is no longer a tax collector`;
						break;
					}

					default:
						throw new Error(`unknown subcommand '${interaction.options.getSubcommand()}'`);
				}

				this.client.log(this.client.defaultEmbed.setTitle('Guild Tax').setDescription(log));

				return InteractionUtil.reply(interaction, log);
			}

			case null: {
				switch (interaction.options.getSubcommand()) {
					case 'amount': {
						const NEW_AMOUNT = interaction.options.getInteger('amount', true);

						if (NEW_AMOUNT < 0) {
							throw 'tax amount must be a non-negative number';
						}

						const OLD_AMOUNT = this.config.get('TAX_AMOUNT');

						await safePromiseAll([
							// update tax amount
							this.config.set('TAX_AMOUNT', NEW_AMOUNT),

							// update tax collectors
							...this.client.taxCollectors.activeCollectors.map((taxCollector) =>
								taxCollector.update({ collectedTax: taxCollector.collectedTax + NEW_AMOUNT - OLD_AMOUNT }),
							),
						]);

						// logging
						this.client.log(
							this.client.defaultEmbed
								.setTitle('Guild Tax')
								.setDescription(`${interaction.user.tag} | ${interaction.user} changed the guild tax amount`)
								.addFields(
									{
										name: 'Old amount',
										value: Formatters.codeBlock(formatNumber(OLD_AMOUNT)),
										inline: true,
									},
									{
										name: 'New amount',
										value: Formatters.codeBlock(formatNumber(NEW_AMOUNT)),
										inline: true,
									},
								),
						);

						return InteractionUtil.reply(
							interaction,
							`changed the guild tax amount from \`${formatNumber(OLD_AMOUNT)}\` to \`${formatNumber(NEW_AMOUNT)}\``,
						);
					}

					case 'collected': {
						return InteractionUtil.reply(interaction, {
							embeds: [this.client.taxCollectors.createTaxCollectedEmbed()],
						});
					}

					case 'paid': {
						const collector = this.client.taxCollectors.getById(interaction.user.id);

						if (!collector?.isCollecting) {
							throw 'this command is restricted to tax collectors';
						}

						const player = InteractionUtil.getPlayer(interaction, { throwIfNotFound: true });

						if (player.paid) {
							await InteractionUtil.awaitConfirmation(
								interaction,
								`\`${player}\` is already set to paid with an amount of \`${formatNumber(
									(await player.taxAmount) ?? Number.NaN,
								)}\`. Overwrite this?`,
							);

							await player.resetTax();
						}

						const AMOUNT = interaction.options.getInteger('amount') ?? this.config.get('TAX_AMOUNT');

						await player.setToPaid({
							amount: AMOUNT,
							collectedBy: collector.minecraftUuid,
						});

						this.client.log(
							this.client.defaultEmbed.setTitle('Guild Tax').addFields({
								name: `/ah ${collector}`,
								value: Formatters.codeBlock(`${player}: ${formatNumber(AMOUNT)} (manually)`),
							}),
						);

						return InteractionUtil.reply(
							interaction,
							`\`${player}\` manually set to paid with ${
								AMOUNT === this.config.get('TAX_AMOUNT') ? 'the default' : 'a custom'
							} amount of \`${formatNumber(AMOUNT)}\``,
						);
					}

					case 'reminder': {
						const SHOULD_GHOST_PING = interaction.options.getBoolean('ghostping') ?? false;
						const hypixelGuild = interaction.options.get('guild') ? InteractionUtil.getHypixelGuild(interaction) : null;
						const EXCLUDED_INPUT = interaction.options.getString('exclude');
						const excluded = EXCLUDED_INPUT
							? new Set(
									EXCLUDED_INPUT.split(/\W/).flatMap((x) => (x ? x.toLowerCase() : [])), // lower case IGN array
							  )
							: null;
						const playersToRemind = (hypixelGuild?.players ?? this.client.players.inGuild).filter(
							({ paid, ign }) => !paid && !excluded?.has(ign.toLowerCase()),
						);
						const [playersPingable, playersOnlyIgn] = playersToRemind.partition(
							({ inDiscord, discordId }) => inDiscord && validateNumber(discordId),
						);
						const AMOUNT_TO_PING = playersPingable.size;

						if (!AMOUNT_TO_PING) {
							throw `no members to ping from ${hypixelGuild ?? 'all guilds'}`;
						}

						await InteractionUtil.awaitConfirmation(
							interaction,
							`${SHOULD_GHOST_PING ? 'ghost' : ''}ping \`${AMOUNT_TO_PING}\` member${
								AMOUNT_TO_PING !== 1 ? 's' : ''
							} from ${hypixelGuild ?? 'all guilds'}?`,
						);

						let pingMessage = '';

						for (const player of playersPingable.values())
							pingMessage += ` ${Formatters.userMention(player.discordId!)}`;
						for (const player of playersOnlyIgn.values()) pingMessage += ` ${escapeIgn(player.ign)}`;

						// send ping message and split between pings if too many chars
						await InteractionUtil.reply(interaction, {
							content: pingMessage,
							split: { char: ' ' },
							ephemeral: false,
						});

						// optional ghost ping (delete ping message(s))
						if (!SHOULD_GHOST_PING) return;

						const replyMessage = await interaction.fetchReply();
						const fetched = await interaction.channel?.messages
							.fetch({ after: replyMessage.id })
							.catch((error) => logger.error(error, '[TAX REMINDER]: ghost ping'));
						if (!fetched) return;

						return ChannelUtil.deleteMessages(interaction.channel, [
							replyMessage.id,
							...fetched
								.filter(({ author: { id } }) => [this.client.user!.id, interaction.user.id].includes(id))
								.keys(),
						]);
					}

					case 'reset': {
						const { players, taxCollectors } = this.client;
						const PLAYER_INPUT = interaction.options.getString('player');

						let currentTaxEmbed: MessageEmbed | null = null;
						let currentTaxCollectedEmbed!: MessageEmbed;
						let result: string;

						// individual player
						if (PLAYER_INPUT) {
							const player =
								InteractionUtil.getPlayer(interaction) ??
								(await players.fetch({
									guildId: null,
									ign: { [Op.iLike]: PLAYER_INPUT },
									cache: false,
								}));

							if (!player) {
								return InteractionUtil.reply(interaction, `\`${PLAYER_INPUT}\` is not in the player db`);
							}

							if (!player.paid) return InteractionUtil.reply(interaction, `\`${player}\` is not set to paid`);

							const OLD_AMOUNT = await player.taxAmount;

							await InteractionUtil.awaitConfirmation(
								interaction,
								`reset tax paid from \`${player}\` (amount: ${OLD_AMOUNT ? formatNumber(OLD_AMOUNT) : 'unknown'})?`,
							);

							await player.resetTax();

							result = `reset tax paid from \`${player}\` (amount: ${
								OLD_AMOUNT ? formatNumber(OLD_AMOUNT) : 'unknown'
							})`;

							// all players
						} else {
							await InteractionUtil.awaitConfirmation(interaction, 'reset tax paid from all guild members?');

							// get current tax embed from #guild-tax channel
							currentTaxEmbed = await (async () => {
								const taxChannel = this.client.channels.cache.get(this.config.get('TAX_CHANNEL_ID'));

								if (
									!taxChannel?.isText() ||
									((taxChannel as TextChannel).guildId && !(taxChannel as TextChannel).guild?.available)
								) {
									logger.warn('[TAX RESET] tax channel error');
									return null;
								}

								try {
									return (await taxChannel.messages.fetch(this.config.get('TAX_MESSAGE_ID'))).embeds[0];
								} catch (error) {
									logger.error(error, '[TAX RESET] TAX_MESSAGE fetch error');
									return null;
								}
							})();

							if (!currentTaxEmbed) {
								await InteractionUtil.awaitConfirmation(
									interaction,
									`unable to retrieve the current tax embed from ${
										this.client.channels.cache.get(this.config.get('TAX_CHANNEL_ID')) ?? '#guild-tax'
									} to log it. Create a new one and continue?`,
								);

								currentTaxEmbed = this.client.db.createTaxEmbed();
							}

							currentTaxCollectedEmbed = taxCollectors.createTaxCollectedEmbed();

							// update database
							await safePromiseAll([
								// remove retired collectors and reset active ones
								...taxCollectors.cache.map((taxCollector) => {
									if (!taxCollector.isCollecting) return taxCollector.remove();
									return safePromiseAll([
										taxCollector.resetAmount(TransactionTypes.TAX),
										taxCollector.resetAmount(TransactionTypes.DONATION),
									]);
								}),
								// reset players that left
								players.model.update(
									{ paid: false },
									{
										where: {
											guildId: null,
											paid: true,
										},
									},
								),
								// reset current players
								...players.cache.map((player) => player.update({ paid: false })),
								// ignore all auctions up until now
								this.config.set('TAX_AUCTIONS_START_TIME', Date.now()),
							]);

							await safePromiseAll(taxCollectors.cache.map(({ player }) => player?.setToPaid()));

							// delete players who left the guild
							players.sweepDb();

							result = 'reset the tax database. All auctions up until now will be ignored';
						}

						// logging
						(async () => {
							try {
								let logMessage = await this.client.log(
									currentTaxEmbed,
									currentTaxCollectedEmbed,
									this.client.defaultEmbed
										.setTitle('Guild Tax')
										.setDescription(`${interaction.user.tag} | ${interaction.user} ${result}`),
								);

								if (Array.isArray(logMessage)) logMessage = logMessage.find(Boolean);

								if (!logMessage || !currentTaxEmbed) return;

								const { channel } = logMessage;

								if (!ChannelUtil.botPermissions(channel).has(Permissions.FLAGS.MANAGE_MESSAGES)) return;

								const pinnedMessages = await channel.messages.fetchPinned();

								if (pinnedMessages.size >= 50) await pinnedMessages.last()!.unpin();

								logger.info('[TAX RESET]: unpinned old tax embed');

								await logMessage.pin();
							} catch (error) {
								logger.error(error, '[TAX RESET]: logging');
							}
						})();

						return InteractionUtil.reply(interaction, result);
					}

					default:
						throw new Error(`unknown subcommand '${interaction.options.getSubcommand()}'`);
				}
			}

			default:
				throw new Error(`unknown subcommand '${interaction.options.getSubcommandGroup()}'`);
		}
	}
}
