import { SlashCommandBuilder } from '@discordjs/builders';
import { Permissions, Formatters } from 'discord.js';
import pkg from 'sequelize';
const { Op, Model } = pkg;
import { validateNumber } from '../../functions/stringValidators.js';
import { escapeIgn, safePromiseAll } from '../../functions/util.js';
import { ChannelUtil } from '../../util/ChannelUtil.js';
import { buildGuildOption, requiredPlayerOption, optionalPlayerOption } from '../../structures/commands/commonOptions.js';
import { InteractionUtil } from '../../util/InteractionUtil.js';
import { SlashCommand } from '../../structures/commands/SlashCommand.js';
import { logger } from '../../functions/logger.js';


export default class TaxCommand extends SlashCommand {
	constructor(context) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('guild tax')
				.addSubcommand(subcommand => subcommand
					.setName('ah')
					.setDescription('add / remove a player as tax collector')
					.addStringOption(option => option // refactor this option to use group with sub cmds instead
						.setName('action')
						.setDescription('add / remove')
						.setRequired(true)
						.addChoices([ 'add', 'remove' ].map(x => [ x, x ])),
					)
					.addStringOption(requiredPlayerOption),
				)
				.addSubcommand(subcommand => subcommand
					.setName('amount')
					.setDescription('set the tax amount')
					.addIntegerOption(option => option
						.setName('amount')
						.setDescription('new tax amount')
						.setRequired(true),
					),
				)
				.addSubcommand(subcommand => subcommand
					.setName('collected')
					.setDescription('show a list of taxahs and their collected tax amount'),
				)
				.addSubcommand(subcommand => subcommand
					.setName('paid')
					.setDescription('manually set a player to paid')
					.addStringOption(requiredPlayerOption)
					.addIntegerOption(option => option
						.setName('amount')
						.setDescription('amount to overwrite the current tax amount')
						.setRequired(false),
					),
				)
				.addSubcommand(subcommand => subcommand
					.setName('reminder')
					.setDescription('ping all guild members who have not paid')
					.addBooleanOption(option => option
						.setName('ghostping')
						.setDescription('wether to immediatly delete the pings after sending them')
						.setRequired(false),
					)
					.addStringOption(buildGuildOption(context.client, true))
					.addStringOption(option => option
						.setName('exclude')
						.setDescription('IGNs to exclude from the ping')
						.setRequired(false),
					),
				)
				.addSubcommand(subcommand => subcommand
					.setName('reset')
					.setDescription('reset the tax database')
					.addStringOption(optionalPlayerOption),
				),
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async runSlash(interaction) {
		switch (interaction.options.getSubcommand()) {
			case 'ah': {
				const player = InteractionUtil.getPlayer(interaction);

				if (!player) {
					return await InteractionUtil.reply(interaction, `\`${interaction.options.getString('player', true)}\` is not in the player db`);
				}

				const action = interaction.options.getString('action', true);

				let log;

				switch (action) {
					case 'add':
						if (this.client.taxCollectors.cache.get(player.minecraftUuid)?.isCollecting) return await InteractionUtil.reply(interaction, `\`${player}\` is already a tax collector`);

						await this.client.taxCollectors.add(player);
						if (!player.paid) player.setToPaid(); // let collector collect their own tax if they have not paid already
						log = `\`${player}\` is now a tax collector`;
						break;

					case 'remove': {
						const taxCollector = this.client.taxCollectors.cache.get(player.minecraftUuid);

						if (!taxCollector?.isCollecting) return await InteractionUtil.reply(interaction, `\`${player}\` is not a tax collector`);

						// remove self paid if only the collector paid the default amount at his own ah
						if (taxCollector.collectedTax === this.config.get('TAX_AMOUNT') && player.collectedBy === player.minecraftUuid) {
							logger.info(`[TAX AH]: ${player}: removed and reset tax paid`);
							await player.resetTax();
							await taxCollector.remove();
						} else {
							taxCollector.isCollecting = false;
							taxCollector.save();
						}

						log = `\`${taxCollector}\` is no longer a tax collector`;
						break;
					}

					default:
						throw new Error(`unknown subcommand '${action}'`);
				}

				this.client.log(this.client.defaultEmbed
					.setTitle('Guild Tax')
					.setDescription(log),
				);

				return await InteractionUtil.reply(interaction, log);
			}

			case 'amount': {
				const NEW_AMOUNT = interaction.options.getInteger('amount', true);

				if (NEW_AMOUNT < 0) return await InteractionUtil.reply(interaction, {
					content: 'tax amount must be a non-negative number',
					ephemeral: true,
				});

				const OLD_AMOUNT = this.config.get('TAX_AMOUNT');

				await safePromiseAll([
					// update tax amount
					this.config.set('TAX_AMOUNT', NEW_AMOUNT),

					// update tax collectors
					...this.client.taxCollectors.activeCollectors.map(async (taxCollector) => {
						taxCollector.collectedTax += NEW_AMOUNT - OLD_AMOUNT;
						return taxCollector.save();
					}),
				]);

				// logging
				this.client.log(this.client.defaultEmbed
					.setTitle('Guild Tax')
					.setDescription(`${interaction.user.tag} | ${interaction.user} changed the guild tax amount`)
					.addFields({
						name: 'Old amount',
						value: Formatters.codeBlock(this.client.formatNumber(OLD_AMOUNT)),
						inline: true,
					}, {
						name: 'New amount',
						value: Formatters.codeBlock(this.client.formatNumber(NEW_AMOUNT)),
						inline: true,
					}),
				);

				return await InteractionUtil.reply(interaction, `changed the guild tax amount from \`${this.client.formatNumber(OLD_AMOUNT)}\` to \`${this.client.formatNumber(NEW_AMOUNT)}\``);
			}

			case 'collected': {
				return await InteractionUtil.reply(interaction, {
					embeds: [ this.client.taxCollectors.createTaxCollectedEmbed() ],
				});
			}

			case 'paid': {
				const collector = this.client.taxCollectors.getById(interaction.user.id);

				if (!collector?.isCollecting) return await InteractionUtil.reply(interaction, {
					content: 'this command is restricted to tax collectors',
					ephemeral: true,
				});

				const player = InteractionUtil.getPlayer(interaction);

				if (!player) {
					return await InteractionUtil.reply(interaction, `\`${interaction.options.getString('player', true)}\` is not in the player db`);
				}

				if (player.paid) {
					await InteractionUtil.awaitConfirmation(interaction, `\`${player}\` is already set to paid with an amount of \`${this.client.formatNumber(await player.taxAmount ?? NaN)}\`. Overwrite this?`);

					await player.resetTax();
				}

				const AMOUNT = interaction.options.getInteger('amount') ?? this.config.get('TAX_AMOUNT');

				await player.setToPaid({
					amount: AMOUNT,
					collectedBy: collector.minecraftUuid,
				});

				this.client.log(this.client.defaultEmbed
					.setTitle('Guild Tax')
					.addFields({
						name: `/ah ${collector}`,
						value: Formatters.codeBlock(`${player}: ${this.client.formatNumber(AMOUNT)} (manually)`),
					}),
				);

				return await InteractionUtil.reply(interaction, `\`${player}\` manually set to paid with ${AMOUNT === this.config.get('TAX_AMOUNT') ? 'the default' : 'a custom'} amount of \`${this.client.formatNumber(AMOUNT)}\``);
			}

			case 'reminder': {
				const SHOULD_GHOST_PING = interaction.options.getBoolean('ghostping') ?? false;
				const hypixelGuild = interaction.options.get('guild')
					? InteractionUtil.getHypixelGuild(interaction)
					: null;
				const excluded = interaction.options.getString('exclude')
					?.split(/\W/g)
					.flatMap(x => (x ? x.toLowerCase() : [])); // lower case IGN array
				/** @type {import('discord.js').Collection<string, import('../../structures/database/models/Player').Player>} */
				const playersToRemind = (hypixelGuild?.players ?? this.client.players.inGuild)
					.filter(({ paid, ign }) => !paid && excluded?.includes(ign.toLowerCase()));
				const [ playersPingable, playersOnlyIgn ] = playersToRemind.partition(({ inDiscord, discordId }) => inDiscord && validateNumber(discordId));
				const AMOUNT_TO_PING = playersPingable.size;

				if (!AMOUNT_TO_PING) return await InteractionUtil.reply(interaction, {
					content: `no members to ping from ${hypixelGuild?.name ?? 'all guilds'}`,
					ephemeral: true,
				});

				await InteractionUtil.awaitConfirmation(interaction, `${SHOULD_GHOST_PING ? 'ghost' : ''}ping \`${AMOUNT_TO_PING}\` member${AMOUNT_TO_PING !== 1 ? 's' : ''} from ${hypixelGuild?.name ?? 'all guilds'}?`);

				let pingMessage = '';

				for (const player of playersPingable.values()) pingMessage += ` ${Formatters.userMention(player.discordId)}`;
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
				const fetched = await interaction.channel?.messages.fetch({ after: replyMessage.id }).catch(error => logger.error('[TAX REMINDER]: ghost ping', error));
				if (!fetched) return;

				return ChannelUtil.deleteMessages(interaction.channel, [
					replyMessage.id,
					...fetched.filter(({ author: { id } }) => [ this.client.user.id, interaction.user.id ].includes(id)).keys(),
				]);
			}

			case 'reset': {
				const { players, taxCollectors } = this.client;
				const PLAYER_INPUT = interaction.options.getString('player');

				let currentTaxEmbed;
				let currentTaxCollectedEmbed;
				let result;

				// individual player
				if (PLAYER_INPUT) {
					const player = InteractionUtil.getPlayer(interaction)
						?? await players.fetch({
							guildId: null,
							ign: { [Op.iLike]: PLAYER_INPUT },
							cache: false,
						});

					if (!player) {
						return await InteractionUtil.reply(interaction, `\`${PLAYER_INPUT}\` is not in the player db`);
					}

					if (!player.paid) return await InteractionUtil.reply(interaction, `\`${player}\` is not set to paid`);

					const OLD_AMOUNT = await player.taxAmount;

					await InteractionUtil.awaitConfirmation(interaction, `reset tax paid from \`${player}\` (amount: ${OLD_AMOUNT ? this.client.formatNumber(OLD_AMOUNT) : 'unknown'})?`);

					await player.resetTax();

					result = `reset tax paid from \`${player}\` (amount: ${OLD_AMOUNT ? this.client.formatNumber(OLD_AMOUNT) : 'unknown'})`;

				// all players
				} else {
					await InteractionUtil.awaitConfirmation(interaction, 'reset tax paid from all guild members?');

					// get current tax embed from #guild-tax channel
					currentTaxEmbed = await (async () => {
						const taxChannel = this.client.lgGuild?.channels.cache.get(this.config.get('TAX_CHANNEL_ID'));

						if (!taxChannel) return logger.warn('[TAX RESET] tax channel error');

						const taxMessage = await taxChannel.messages.fetch(this.config.get('TAX_MESSAGE_ID')).catch(logger.error);

						if (!taxMessage) return logger.warn('[TAX RESET] TAX_MESSAGE fetch error');

						return taxMessage.embeds[0];
					})();

					if (!currentTaxEmbed) {
						await InteractionUtil.awaitConfirmation(interaction, `unable to retrieve the current tax embed from ${this.client.lgGuild?.channels.cache.get(this.config.get('TAX_CHANNEL_ID')) ?? '#guild-tax'} to log it. Create a new one and continue?`);

						currentTaxEmbed = this.client.db.createTaxEmbed();
					}

					currentTaxCollectedEmbed = taxCollectors.createTaxCollectedEmbed();


					// update database
					await safePromiseAll([
						...taxCollectors.cache.map(async (taxCollector) => { // remove retired collectors and reset active ones
							if (!taxCollector.isCollecting) return taxCollector.remove();
							return safePromiseAll([
								taxCollector.resetAmount('tax'),
								taxCollector.resetAmount('donation'),
							]);
						}),
						Model.update.call(players.model, // reset players that left
							{ paid: false },
							{
								where: {
									guildId: null,
									paid: true,
								},
							},
						),
						...players.cache.map(async (player) => { // reset current players
							player.paid = false;
							return player.save();
						}),
						this.config.set('TAX_AUCTIONS_START_TIME', Date.now()), // ignore all auctions up until now
					]);

					await safePromiseAll(taxCollectors.cache.map(async ({ player }) => player?.setToPaid()));

					// delete players who left the guild
					players.sweepDb();

					result = 'reset the tax database. All auctions up until now will be ignored';
				}

				// logging
				(async () => {
					try {
						/** @type {import('discord.js').Message} */
						const logMessage = await this.client.log(
							currentTaxEmbed,
							currentTaxCollectedEmbed,
							this.client.defaultEmbed
								.setTitle('Guild Tax')
								.setDescription(`${interaction.user.tag} | ${interaction.user} ${result}`),
						);

						if (!currentTaxEmbed) return;

						const { channel } = logMessage;

						if (!ChannelUtil.botPermissions(channel).has(Permissions.FLAGS.MANAGE_MESSAGES)) return;

						const pinnedMessages = await channel.messages.fetchPinned();

						if (pinnedMessages.size >= 50) await pinnedMessages.last().unpin({ reason: 'reached max pin amount' });

						logger.info('[TAX RESET]: unpinned old tax embed');

						await logMessage.pin({ reason: '#sheet-logs' });
					} catch (error) {
						logger.error('[TAX RESET]: logging', error);
					}
				})();

				return await InteractionUtil.reply(interaction, result);
			}

			default:
				throw new Error(`unknown subcommand '${interaction.options.getSubcommand()}'`);
		}
	}
}
