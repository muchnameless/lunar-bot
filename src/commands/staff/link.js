'use strict';

const { DiscordAPIError, Constants } = require('discord.js');
const { stripIndents } = require('common-tags');
const { validateNumber } = require('../../functions/stringValidators');
const hypixel = require('../../api/hypixel');
const mojang = require('../../api/mojang');
const SlashCommand = require('../../structures/commands/SlashCommand');
const logger = require('../../functions/logger');


module.exports = class LinkCommand extends SlashCommand {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'link a discord user to a minecraft ign',
			options: [{
				name: 'ign',
				type: Constants.ApplicationCommandOptionTypes.STRING,
				description: 'IGN | UUID',
				required: true,
			}, {
				name: 'user',
				type: Constants.ApplicationCommandOptionTypes.USER,
				description: 'discord user',
				required: true,
			}],
			defaultPermission: true,
			cooldown: 1,
		});
	}


	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) {
		interaction.defer();

		const IGN_OR_UUID = interaction.options.getString('ign', true);
		const user = interaction.options.getUser('user', true);
		const member = interaction.options.getMember('user', true);

		let uuid;
		let ign;
		let guildId;

		try {
			({ uuid, ign } = await mojang.ignOrUuid(IGN_OR_UUID));
			({ _id: guildId } = await hypixel.guild.player(uuid));
		} catch (error) {
			logger.error('[LINK]', error);
		}

		/** @type {?import('../../structures/database/models/Player')} */
		let player;

		if (!this.client.hypixelGuilds.cache.keyArray().includes(guildId)) { // IGN_OR_Uuid is neither a valid ign nor uuid from a player in the guild -> autocomplete to IGN
			player = this.client.players.getByIgn(IGN_OR_UUID);

			if (player) ({ minecraftUuid: uuid, ign } = player);
		} else if (uuid) { // IGN_OR_Uuid could be resolved to a valid uuid in guild
			player = this.client.players.cache.get(uuid)
				?? (await this.client.players.model.findOrCreate({
					where: { minecraftUuid: uuid },
					defaults: {
						ign,
						guildId,
					},
				}))?.[0];
		}

		if (!player) return interaction.reply(stripIndents`
			\`${IGN_OR_UUID}\` is neither a valid IGN nor minecraft uuid.
			Make sure to provide the full ign if the player database is not already updated (check ${this.client.loggingChannel ?? '#lunar-logs'})
		`);

		// discordId already linked to another player
		const playerLinkedToId = this.client.players.getById(user.id)
			?? await this.client.players.model.findOne({
				where: { discordId: user.id },
			});

		if (playerLinkedToId) {
			let linkedUserIsDeleted = false;

			const linkedUser = await playerLinkedToId.discordUser.catch((error) => {
				if (error instanceof DiscordAPIError && error.code === Constants.APIErrors.UNKNOWN_USER) {
					linkedUserIsDeleted = true;
					return logger.error(`[LINK]: ${playerLinkedToId.logInfo}: deleted discord user: ${playerLinkedToId.discordId}`, error);
				}
				return logger.error(`[LINK]: ${playerLinkedToId.logInfo}: error fetching already linked user`, error);
			});

			if (!linkedUserIsDeleted) {
				await interaction.awaitConfirmation({
					question: `${linkedUser ?? `\`${user.id}\``} is already linked to \`${playerLinkedToId.ign}\`. Overwrite this?`,
					allowedMentions: { parse: [] },
				});
			}

			if (!await playerLinkedToId.unlink(`unlinked by ${interaction.user.tag}`) && linkedUser) {
				await interaction.reply({
					content: `unable to update roles and nickname for the currently linked member ${linkedUser}`,
					allowedMentions: { parse: [] },
				});
			}
		}

		// player already linked
		if (validateNumber(player.discordId)) {
			let linkedUserIsDeleted = false;

			const linkedUser = await player.discordUser.catch((error) => {
				if (error instanceof DiscordAPIError && error.code === Constants.APIErrors.UNKNOWN_USER) {
					linkedUserIsDeleted = true;
					return logger.error(`[LINK]: ${player.logInfo}: deleted discord user: ${player.discordId}`);
				}
				return logger.error(`[LINK]: ${player.logInfo}: error fetching already linked user`, error);
			});

			if (!linkedUserIsDeleted) {
				if (player.discordId === user.id) return interaction.reply({
					content: `\`${player.ign}\` is already linked to ${linkedUser ?? `\`${player.discordId}\``}`,
					allowedMentions: { parse: [] },
				});

				await interaction.awaitConfirmation({
					question: stripIndents`
						\`${player.ign}\` is already linked to ${linkedUser ?? `\`${player.discordId}\``}. Overwrite this?
						Make sure to provide the full ign if the player database is not already updated (check ${this.client.loggingChannel ?? '#lunar-logs'})
					`,
					allowedMentions: { parse: [] },
				});
			}

			if (!await player.unlink(`unlinked by ${interaction.user.tag}`) && linkedUser) {
				await interaction.reply({
					content: `unable to update roles and nickname for the currently linked member ${linkedUser}`,
					allowedMentions: { parse: [] },
				});
			}
		}

		// try to find the linked users member data
		const discordMember = member ?? await this.client.lgGuild?.members.fetch(user.id).catch(error => logger.error('[LINK]: error fetching member to link', error));

		// no discord member for the user to link found
		if (!discordMember) {
			await player.link(user.id);
			return interaction.reply(`\`${player.ign}\` linked to \`${user.id}\` but could not be found on the Lunar Guard discord server`);
		}

		// user to link is in discord -> update roles
		await player.link(discordMember, `linked by ${interaction.author.tag}`);

		let reply = `\`${player.ign}\` linked to ${discordMember}`;

		if (!discordMember.roles.cache.has(this.config.get('VERIFIED_ROLE_ID')))	{
			reply += ` (missing ${this.client.lgGuild?.roles.cache.get(this.config.get('VERIFIED_ROLE_ID'))?.name ?? this.config.get('VERIFIED_ROLE_ID')} role)`;
		}

		interaction.reply({
			content: reply,
			allowedMentions: { parse: [] },
		});
	}
};
