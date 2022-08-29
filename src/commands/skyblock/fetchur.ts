import { SlashCommandBuilder, time, TimestampStyles } from 'discord.js';
import { zone, TimeStruct, DateFunctions } from 'timezonecomplete';
import { InteractionUtil } from '#utils';
import { DualCommand } from '#structures/commands/DualCommand';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { HypixelUserMessage } from '#chatBridge/HypixelMessage';
import type { CommandContext } from '#structures/commands/BaseCommand';

export default class FetchurCommand extends DualCommand {
	constructor(context: CommandContext) {
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

	static FETCHUR_ITEMS = [
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
	];

	/**
	 * execute the command
	 */
	private _generateReply() {
		const date = new Date();
		const OFFSET = zone('America/New_York').offsetForUtc(TimeStruct.fromDate(date, DateFunctions.GetUTC)) / 60;
		date.setUTCHours(date.getUTCHours() + OFFSET); // EST

		const today = new Date();
		today.setUTCHours(Math.abs(OFFSET), 0, 0, 0);

		let nextResetDate: Date;

		if (today.getTime() >= Date.now()) {
			nextResetDate = today;
		} else {
			// reset already happened today
			const tomorrow = new Date();
			tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
			tomorrow.setUTCHours(Math.abs(OFFSET), 0, 0, 0);

			nextResetDate = tomorrow;
		}

		return `item: ${
			FetchurCommand.FETCHUR_ITEMS[(date.getUTCDate() - 1) % FetchurCommand.FETCHUR_ITEMS.length]
		}, changes ${time(nextResetDate, TimestampStyles.RelativeTime)}`;
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		return InteractionUtil.reply(interaction, this._generateReply());
	}

	/**
	 * execute the command
	 * @param hypixelMessage
	 */
	override minecraftRun(hypixelMessage: HypixelUserMessage) {
		return hypixelMessage.reply(this._generateReply());
	}
}
