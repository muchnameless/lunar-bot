'use strict';

const { Constants } = require('discord.js');
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
		const player = this.getPlayer(interaction.options);

		if (!player.discordID) return interaction.reply(`\`${player.ign}\` is not linked`);

		interaction.defer();

		const { discordID: OLD_LINKED_ID } = player;
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
