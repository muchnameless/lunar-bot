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
				description: 'IGN | UUID | discord ID | @mention',
				required: true,
			}],
			cooldown: 1,
		});
	}

	/**
	 * execute the command
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async run(interaction) {
		const PLAYER_INPUT = interaction.options.getString('player', true);
		const player = this.getPlayer(interaction)
			?? await this.client.players.fetch({
				[Op.or]: [{
					ign: { [Op.iLike]: PLAYER_INPUT },
					minecraftUuid: PLAYER_INPUT.toLowerCase(),
					discordId: PLAYER_INPUT,
				}],
				cache: false,
			});

		if (!player?.discordId) return await this.reply(interaction, `\`${PLAYER_INPUT}\` is not linked`);

		this.deferReply(interaction);

		const { discordId: OLD_LINKED_ID } = player;
		const currentLinkedMember = await player.discordMember;
		const WAS_SUCCESSFUL = await player.unlink(`unlinked by ${interaction.user.tag}`);

		return await this.reply(interaction, {
			content: oneLine`
				\`${player}\` is no longer linked to ${currentLinkedMember ?? `\`${OLD_LINKED_ID}\``}
				${WAS_SUCCESSFUL ? '' : ' (unable to update the currently linked member)'}
			`,
			allowedMentions: { parse: [] },
		});
	}
};
