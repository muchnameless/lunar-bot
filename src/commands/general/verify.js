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
				description: 'IGN | UUID',
				required: true,
			}],
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) {
		interaction.deferReply();

		const IGN = interaction.options.getString('ign', true);
		/** @type {import('../../structures/database/models/Player')} */
		const playerLinkedToId = interaction.user.player;

		let player = this.client.players.getByIgn(IGN)
			?? await this.client.players.fetch({
				[Op.or]: [{
					ign: { [Op.iLike]: IGN },
					minecraftUuid: IGN.toLowerCase(),
				}],
				cache: false,
			});

		// already linked to this discord user
		if (player && player.minecraftUuid === playerLinkedToId?.minecraftUuid) return await interaction.reply('you are already linked with this discord account');

		let uuid;
		let ign;
		let guildId;
		let hypixelPlayer;

		try {
			({ uuid, ign } = await mojang.ign(IGN));
			({ _id: guildId } = await hypixel.guild.player(uuid));

			// not in one of the guilds that the bot manages
			if (!this.client.hypixelGuilds.cache.has(guildId)) return interaction.reply(commaListsOr`according to the hypixel API, \`${ign}\` is not in ${this.client.hypixelGuilds.cache.map(({ name }) => name)}`);

			hypixelPlayer = await hypixel.player.uuid(uuid);
		} catch (error) {
			logger.error(error);
			return await interaction.reply(`${error}`);
		}

		const LINKED_DISCORD_TAG = hypixelPlayer?.socialMedia?.links?.DISCORD;

		// no linked discord tag
		if (!LINKED_DISCORD_TAG) return await interaction.reply(`no linked discord tag for \`${ign}\` on hypixel`);

		// linked discord tag doesn't match author's tag
		if (LINKED_DISCORD_TAG !== interaction.user.tag) return await interaction.reply(oneLine`
			the linked discord tag \`${LINKED_DISCORD_TAG}\` for \`${ign}\` does not match yours: \`${interaction.user.tag}\`.
			Keep in mind that discord tags are case sensitive
		`);

		// already linked to another discord user
		if (playerLinkedToId) {
			await interaction.awaitConfirmation(`your discord account is already linked to \`${playerLinkedToId}\`. Overwrite this?`);

			await playerLinkedToId.unlink(`linked account switched to ${interaction.user.tag}`);
		}

		// create new db entry if non exitent
		try {
			if (!player) [ player ] = await this.client.players.model.findOrCreate({
				where: { minecraftUuid: uuid },
				defaults: {
					ign,
					guildId,
				},
			});
		} catch (error) {
			logger.error('[VERIFY]: database', error);
			return await interaction.reply(`an error occurred while updating the guild player database. Contact ${await this.client.ownerInfo}`);
		}

		player.guildId = guildId;

		const discordMember = interaction.member
			?? await this.client.lgGuild?.members.fetch(interaction.user.id).catch(error => logger.error('[VERIFY]: guild member fetch', error))
			?? null;

		await player.link(discordMember ?? interaction.user.id, 'verified with the bot');

		return await interaction.reply(`successfully linked your discord account to \`${ign}\``);
	}
};
