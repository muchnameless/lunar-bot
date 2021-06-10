'use strict';

const { oneLine, commaListsOr } = require('common-tags');
const hypixel = require('../../api/hypixel');
const mojang = require('../../api/mojang');
const { Constants } = require('discord.js');
const SlashCommand = require('../../structures/commands/SlashCommand');
const logger = require('../../functions/logger');


module.exports = class VerifyCommand extends SlashCommand {
	/**
	 * @param {import('../../structures/commands/SlashCommand').CommandData} commandData
	 */
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'link your discord account to your minecraft account (guild members only)',
			options: [{
				name: 'ign',
				type: Constants.ApplicationCommandOptionTypes.STRING,
				description: 'IGN',
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
	async run(interaction) { // eslint-disable-line no-unused-vars
		interaction.defer();

		const { hypixelGuilds, players } = this.client;
		const IGN = interaction.options.get('ign').value;

		let player = players.getByIGN(IGN);

		/**
		 * @type {import('../../structures/database/models/Player')}
		 */
		const playerLinkedToID = interaction.user.player;

		// already linked to this discord user
		if (player?.minecraftUUID === playerLinkedToID?.minecraftUUID) return interaction.reply('you are already linked with this discord account.');

		const ERROR_STRING = 'Try again in a few minutes if you believe this is an error.';
		const { uuid, ign = IGN } = await mojang.ign(IGN).catch(error => logger.error('[VERIFY]: ign fetch', error) ?? {});

		// non existing ign
		if (!uuid) return interaction.reply(`unable to find the minecraft UUID of \`${ign}\`. ${ERROR_STRING}`);

		const hypixelGuild = await hypixel.guild.player(uuid).catch(error => logger.error('[VERIFY]: guild fetch', error));

		// not in a guild
		if (!hypixelGuild) return interaction.reply(`unable to find the hypixel guild of \`${ign}\`. ${ERROR_STRING}`);

		const { _id: GUILD_ID } = hypixelGuild;

		// not in one of the guilds that the bot manages
		if (!hypixelGuilds.cache.keyArray().includes(GUILD_ID)) return interaction.reply(commaListsOr`
			according to the hypixel API, \`${ign}\` is not in ${hypixelGuilds.cache.map(({ name }) => name)}. ${ERROR_STRING}
		`);

		const hypixelPlayer = await hypixel.player.uuid(uuid).catch(error => logger.error('[VERIFY]: player fetch', error));

		// hypixel player api error
		if (!hypixelPlayer) return interaction.reply(`unable to find \`${ign}\` on hypixel. ${ERROR_STRING}`);

		const LINKED_DISCORD_TAG = hypixelPlayer.socialMedia?.links?.DISCORD;

		// no linked discord tag
		if (!LINKED_DISCORD_TAG) return interaction.reply(`no linked discord tag for \`${ign}\` on hypixel. ${ERROR_STRING}`);

		// linked discord tag doesn't match author's tag
		if (LINKED_DISCORD_TAG !== interaction.user.tag) return interaction.reply(oneLine`
			the linked discord tag \`${LINKED_DISCORD_TAG}\` for \`${ign}\` does not match yours: \`${interaction.user.tag}\`.
			Keep in mind that discord tags are case sensitive.
		`);

		// already linked to another discord user
		if (playerLinkedToID) {
			const ANSWER = await interaction.awaitReply(`your discord account is already linked to \`${playerLinkedToID.ign}\`. Overwrite this?`);

			if (!this.config.getArray('REPLY_CONFIRMATION').includes(ANSWER?.toLowerCase())) return interaction.reply('the command has been cancelled.');

			await playerLinkedToID.unlink(`linked account switched to ${interaction.user.tag}`);
		}

		// create new db entry if non exitent
		try {
			if (!player) [ player ] = await players.model.findOrCreate({
				where: { minecraftUUID: uuid },
				defaults: { ign },
			});
		} catch (error) {
			logger.error('[VERIFY]: database', error);
			return interaction.reply(`an error occurred while updating the guild player database. Contact ${await this.client.ownerInfo}`);
		}

		player.guildID = GUILD_ID;

		const discordMember = interaction.member ?? await this.client.lgGuild?.members.fetch(interaction.user.id).catch(error => logger.error('[VERIFY]: guild member fetch', error)) ?? null;

		await player.link(discordMember ?? interaction.user.id, 'verified with the bot');

		return interaction.reply(`successfully linked your discord account to \`${ign}\`.`);
	}
};
