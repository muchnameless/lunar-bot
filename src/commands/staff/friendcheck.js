import { SlashCommandBuilder } from '@discordjs/builders';
import { Formatters } from 'discord.js';
import { stripIndents } from 'common-tags';
import { EMBED_DESCRIPTION_MAX_CHARS } from '../../constants/discord.js';
import { trim } from '../../functions/util.js';
import { hypixel } from '../../api/hypixel.js';
import { mojang } from '../../api/mojang.js';
import { requiredIgnOption } from '../../structures/commands/commonOptions.js';
import { InteractionUtil } from '../../util/InteractionUtil.js';
import { SlashCommand } from '../../structures/commands/SlashCommand.js';
// import { logger } from '../../functions/logger.js';


export default class FriendCheckCommand extends SlashCommand {
	constructor(context) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('checks which friends of the player are in the guild')
				.addStringOption(requiredIgnOption),
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async runSlash(interaction) {
		InteractionUtil.deferReply(interaction);

		const { uuid, ign: IGN } = await mojang.ignOrUuid(interaction.options.getString('ign', true));
		const friends = (await hypixel.friends.uuid(uuid)).map(x => (x.uuidSender === uuid ? x.uuidReceiver : x.uuidSender));

		return await InteractionUtil.reply(interaction, {
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
