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
				description: 'IGN | minecraftUUID',
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

		const { user, member } = interaction.options.get('user');
		const IGN_INPUT = interaction.options.get('ign').value;

		let uuid;
		let ign;
		let guildID;
		/** @type {?import('../../structures/database/models/Player')} */
		let player;

		try {
			({ uuid, ign } = await mojang.ignOrUuid(IGN_INPUT));
			({ _id: guildID } = await hypixel.guild.player(uuid));
		} catch (error) {
			logger.error('[LINK]', error);
		}

		if (!this.client.hypixelGuilds.cache.keyArray().includes(guildID)) {
			player = this.client.players.getByIGN(IGN_INPUT);

			if (player) {
				({ minecraftUUID: uuid, ign } = this.client.players.getByIGN(IGN_INPUT) ?? {});
			}
		}

		if (!uuid) return interaction.reply(stripIndents`
			\`${IGN_INPUT}\` is neither a valid IGN nor minecraft uuid.
			Make sure to provide the full ign if the player database is not already updated (check ${this.client.loggingChannel ?? '#lunar-logs'})
		`);

		player ??= (await this.client.players.model.findOrCreate({
			where: { minecraftUUID: uuid },
			defaults: {
				ign,
				guildID,
			},
		}))?.[0];

		// discordID already linked to another player
		const playerLinkedToID = this.client.players.getByID(user.id);

		if (playerLinkedToID) {
			let linkedUserIsDeleted = false;

			const linkedUser = await playerLinkedToID.discordUser.catch((error) => {
				if (error instanceof DiscordAPIError && error.code === Constants.APIErrors.UNKNOWN_USER) {
					linkedUserIsDeleted = true;
					return logger.error(`[LINK]: ${playerLinkedToID.logInfo}: deleted discord user: ${playerLinkedToID.discordID}`, error);
				}
				return logger.error(`[LINK]: ${playerLinkedToID.logInfo}: error fetching already linked user`, error);
			});

			if (!linkedUserIsDeleted) {
				await interaction.awaitConfirmation({
					question: `${linkedUser ?? `\`${user.id}\``} is already linked to \`${playerLinkedToID.ign}\`. Overwrite this?`,
					allowedMentions: { parse: [] },
				});
			}

			if (!await playerLinkedToID.unlink(`unlinked by ${interaction.user.tag}`) && linkedUser) {
				await interaction.reply({
					content: `unable to update roles and nickname for the currently linked member ${linkedUser}`,
					allowedMentions: { parse: [] },
				});
			}
		}

		// player already linked
		if (validateNumber(player.discordID)) {
			let linkedUserIsDeleted = false;

			const linkedUser = await player.discordUser.catch((error) => {
				if (error instanceof DiscordAPIError && error.code === Constants.APIErrors.UNKNOWN_USER) {
					linkedUserIsDeleted = true;
					return logger.error(`[LINK]: ${player.logInfo}: deleted discord user: ${player.discordID}`);
				}
				return logger.error(`[LINK]: ${player.logInfo}: error fetching already linked user`, error);
			});

			if (!linkedUserIsDeleted) {
				if (player.discordID === user.id) return interaction.reply({
					content: `\`${player.ign}\` is already linked to ${linkedUser ?? `\`${player.discordID}\``}`,
					allowedMentions: { parse: [] },
				});

				await interaction.awaitConfirmation({
					question: stripIndents`
						\`${player.ign}\` is already linked to ${linkedUser ?? `\`${player.discordID}\``}. Overwrite this?
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
