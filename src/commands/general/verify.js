'use strict';

const { Constants } = require('discord.js');
const { Op } = require('sequelize');
const { oneLine, commaListsOr } = require('common-tags');
const hypixel = require('../../api/hypixel');
const mojang = require('../../api/mojang');
const SlashCommand = require('../../structures/commands/SlashCommand');
const logger = require('../../functions/logger');


module.exports = class VerifyCommand extends SlashCommand {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'link your discord account to your minecraft account (guild members only)',
			options: [{
				name: 'ign',
				type: Constants.ApplicationCommandOptionTypes.STRING,
				description: 'IGN | uuid',
				required: true,
			}],
			defaultPermission: true,
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) {
		interaction.defer();

		const IGN = interaction.options.getString('ign', true);
		/** @type {import('../../structures/database/models/Player')} */
		const playerLinkedToId = interaction.user.player;

		let player = this.client.players.getByIgn(IGN)
			?? await this.client.players.model.findOne({
				where: {
					[Op.or]: [{
						ign: { [Op.iLike]: IGN },
						minecraftUuid: IGN.toLowerCase(),
					}],
				},
			});

		// already linked to this discord user
		if (player && player.minecraftUuid === playerLinkedToId?.minecraftUuid) return interaction.reply('you are already linked with this discord account');

		const { uuid, ign } = await mojang.ign(IGN).catch(error => logger.error('[VERIFY]: ign fetch', error) ?? {});

		// non existing ign
		if (!uuid) return interaction.reply(`unable to find the minecraft Uuid of \`${ign}\``);

		const hypixelGuild = await hypixel.guild.player(uuid).catch(error => logger.error('[VERIFY]: guild fetch', error));

		// not in a guild
		if (!hypixelGuild) return interaction.reply(`unable to find the hypixel guild of \`${ign}\``);

		const { _id: GUILD_ID } = hypixelGuild;

		// not in one of the guilds that the bot manages
		if (!this.client.hypixelGuilds.cache.keyArray().includes(GUILD_ID)) return interaction.reply(commaListsOr`according to the hypixel API, \`${ign}\` is not in ${this.client.hypixelGuilds.cache.map(({ name }) => name)}`);

		const hypixelPlayer = await hypixel.player.uuid(uuid).catch(error => logger.error('[VERIFY]: player fetch', error));

		// hypixel player api error
		if (!hypixelPlayer) return interaction.reply(`unable to find \`${ign}\` on hypixel`);

		const LINKED_DISCORD_TAG = hypixelPlayer.socialMedia?.links?.DISCORD;

		// no linked discord tag
		if (!LINKED_DISCORD_TAG) return interaction.reply(`no linked discord tag for \`${ign}\` on hypixel`);

		// linked discord tag doesn't match author's tag
		if (LINKED_DISCORD_TAG !== interaction.user.tag) return interaction.reply(oneLine`
			the linked discord tag \`${LINKED_DISCORD_TAG}\` for \`${ign}\` does not match yours: \`${interaction.user.tag}\`.
			Keep in mind that discord tags are case sensitive
		`);

		// already linked to another discord user
		if (playerLinkedToId) {
			await interaction.awaitConfirmation(`your discord account is already linked to \`${playerLinkedToId.ign}\`. Overwrite this?`);

			await playerLinkedToId.unlink(`linked account switched to ${interaction.user.tag}`);
		}

		// create new db entry if non exitent
		try {
			if (!player) [ player ] = await this.client.players.model.findOrCreate({
				where: { minecraftUuid: uuid },
				defaults: {
					ign,
					guildId: GUILD_ID,
				},
			});
		} catch (error) {
			logger.error('[VERIFY]: database', error);
			return interaction.reply(`an error occurred while updating the guild player database. Contact ${await this.client.ownerInfo}`);
		}

		player.guildId = GUILD_ID;

		const discordMember = interaction.member
			?? await this.client.lgGuild?.members.fetch(interaction.user.id).catch(error => logger.error('[VERIFY]: guild member fetch', error))
			?? null;

		await player.link(discordMember ?? interaction.user.id, 'verified with the bot');

		return interaction.reply(`successfully linked your discord account to \`${ign}\``);
	}
};
