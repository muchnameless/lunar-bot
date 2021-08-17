import { Formatters, Constants } from 'discord.js';
import { stripIndents } from 'common-tags';
import { EMBED_DESCRIPTION_MAX_CHARS } from '../../constants/discord.js';
import { trim } from '../../functions/util.js';
import { hypixel } from '../../api/hypixel.js';
import { mojang } from '../../api/mojang.js';
import { SlashCommand } from '../../structures/commands/SlashCommand.js';
// import { logger } from '../../functions/logger.js';


export default class FriendCheckCommand extends SlashCommand {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'checks which friends of the player are in the guild',
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
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async run(interaction) {
		this.deferReply(interaction);

		const { uuid, ign: IGN } = await mojang.ignOrUuid(interaction.options.getString('ign', true));
		const friends = (await hypixel.friends.uuid(uuid)).map(x => (x.uuidSender === uuid ? x.uuidReceiver : x.uuidSender));

		return await this.reply(interaction, {
			embeds: [
				this.client.defaultEmbed
					.setTitle(`${IGN}'s friends in the guild`)
					.setDescription(Formatters.codeBlock(stripIndents`
						${trim(
							this.client.players.cache
							.filter((_, minecraftUuid) => friends.includes(minecraftUuid))
							.map(({ ign }) => ign)
							.join('\n'),
							EMBED_DESCRIPTION_MAX_CHARS - 8, // 2 * (3 [```] + 1 [\n])
						)}
					`)),
			],
		});
	}
}
