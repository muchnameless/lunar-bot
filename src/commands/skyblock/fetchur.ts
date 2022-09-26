import { SlashCommandBuilder, time, TimestampStyles, type ChatInputCommandInteraction } from 'discord.js';
import { DateTime } from 'luxon';
import { type HypixelUserMessage } from '#chatBridge/HypixelMessage.js';
import { type CommandContext } from '#structures/commands/BaseCommand.js';
import { DualCommand } from '#structures/commands/DualCommand.js';
import { InteractionUtil } from '#utils';

export default class FetchurCommand extends DualCommand {
	public constructor(context: CommandContext) {
		super(
			context,
			{
				slash: new SlashCommandBuilder().setDescription('shows the current fetchur item'),
				cooldown: 0,
			},
			{
				aliases: ['f'],
			},
		);
	}

	private readonly FETCHUR_ITEMS = [
		'20 yellow stained glass (Wool Weaver near builder merch in hub)',
		'1 compass (4 iron + 1 redstone)',
		'20 mithril',
		'1 firework (1 gunpowder + 1 paper)',
		'cheap coffee (bartender in hub)',
		'door (wooden or iron)',
		'3 rabbit feet',
		'SuperBoom TNT',
		'1 pumpkin',
		'1 flint and steel',
		'50 quartz ore (mine with silk touch)',
		'50 red wool (Wool Weaver near builder merch in hub)',
	] as const;

	/**
	 * execute the command
	 */
	private _generateReply() {
		const now = DateTime.local({ zone: 'America/New_York' }); // hypixel's time zone

		return `item: ${this.FETCHUR_ITEMS[(now.day - 1) % this.FETCHUR_ITEMS.length]}, changes ${time(
			now.startOf('day').plus({ days: 1 }).toUnixInteger(),
			TimestampStyles.RelativeTime,
		)}`;
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 */
	public override chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		return InteractionUtil.reply(interaction, this._generateReply());
	}

	/**
	 * execute the command
	 *
	 * @param hypixelMessage
	 */
	public override minecraftRun(hypixelMessage: HypixelUserMessage) {
		return hypixelMessage.reply(this._generateReply());
	}
}
