'use strict';

const { Constants } = require('discord.js');
const { Op } = require('sequelize');
const { oneLine } = require('common-tags');
const SlashCommand = require('../../structures/commands/SlashCommand');
// const logger = require('../../functions/logger');


module.exports = class UnlinkCommand extends SlashCommand {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'remove a link between a discord user and a minecraft ign',
			options: [{
				name: 'player',
				type: Constants.ApplicationCommandOptionTypes.STRING,
				description: 'IGN | uuid | discordID | @mention',
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
		const PLAYER_INPUT = interaction.options.getString('player', true);
		const player = this.getPlayer(interaction)
			?? await this.client.players.model.findOne({
				where: {
					[Op.or]: [{
						ign: { [Op.iLike]: PLAYER_INPUT },
						minecraftUuid: PLAYER_INPUT.toLowerCase(),
						discordId: PLAYER_INPUT,
					}],
				},
			});

		if (!player?.discordId) return interaction.reply(`\`${PLAYER_INPUT}\` is not linked`);

		interaction.defer();

		const { discordId: OLD_LINKED_ID } = player;
		const currentLinkedMember = await player.discordMember;
		const WAS_SUCCESSFUL = await player.unlink(`unlinked by ${interaction.user.tag}`);

		return interaction.reply({
			content: oneLine`
				\`${player.ign}\` is no longer linked to ${currentLinkedMember ?? `\`${OLD_LINKED_ID}\``}
				${WAS_SUCCESSFUL ? '' : ' (unable to update the currently linked member)'}
			`,
			allowedMentions: { parse: [] },
		});
	}
};
