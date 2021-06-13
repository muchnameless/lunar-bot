'use strict';

const { Constants } = require('discord.js');
const { stripIndents } = require('common-tags');
const { EMBED_DESCRIPTION_MAX_CHARS } = require('../../constants/discord');
const { trim } = require('../../functions/util');
const hypixel = require('../../api/hypixel');
const mojang = require('../../api/mojang');
const SlashCommand = require('../../structures/commands/SlashCommand');
// const logger = require('../../functions/logger');


module.exports = class FriendCheckCommand extends SlashCommand {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'checks which friends of the player are in the guild',
			options: [{
				name: 'ign',
				type: Constants.ApplicationCommandOptionTypes.STRING,
				description: 'IGN | minecraftUUID',
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
		const { uuid, ign: IGN } = await mojang.ignOrUuid(interaction.options.get('ign').value);
		const friends = (await hypixel.friends.uuid(uuid)).map(x => (x.uuidSender === uuid ? x.uuidReceiver : x.uuidSender));

		return interaction.reply({
			embeds: [
				this.client.defaultEmbed
					.setTitle(`${IGN}'s friends in the guild`)
					.setDescription(stripIndents`\`\`\`
						${trim(
							this.client.players.cache
							.filter((_, minecraftUUID) => friends.includes(minecraftUUID))
							.map(({ ign }) => ign)
							.join('\n'),
							EMBED_DESCRIPTION_MAX_CHARS - 8, // 2 * (3 [```] + 1 [\n])
						)}
					\`\`\``),
			],
		});
	}
};
