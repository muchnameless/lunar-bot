import { SlashCommandBuilder } from '@discordjs/builders';
import { Formatters } from 'discord.js';
import { zone, TimeStruct } from 'timezonecomplete';
import { InteractionUtil } from '../../util';
import { DualCommand } from '../../structures/commands/DualCommand';
import type { CommandInteraction } from 'discord.js';
import type { HypixelMessage } from '../../structures/chat_bridge/HypixelMessage';
import type { CommandContext } from '../../structures/commands/BaseCommand';


export default class FetchurCommand extends DualCommand {
	constructor(context: CommandContext) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('shows the current fetchur item'),
			cooldown: 0,
		}, {
			aliases: [ 'f' ],
			args: false,
			usage: '',
		});
	}

	static FETCHUR_ITEMS = [
		'20 mithril',
		'1 firework (1 gunpowder + 1 paper)',
		'cheap coffee (bartender in hub)',
		'door (wooden or iron)',
		'3 rabbit feet',
		'SuperBoom TNT',
		'1 https://youtu.be/9L7Y681bKz8', // @underappreciated '1 pumpkin'
		'1 flint and steel',
		'50 quartz ore (mine with silk touch)',
		'16 enderpearls',
		'50 red wool (Wool Weaver near builder merch in hub)',
		'20 yellow stained glass (Wool Weaver near builder merch in hub)',
		'1 compass (4 iron + 1 redstone)',
	];

	/**
	 * execute the command
	 */
	#generateReply() { // eslint-disable-line class-methods-use-this
		const date = new Date();
		// @ts-expect-error wrong type from TimeStruct
		const OFFSET = zone('America/New_York').offsetForUtc(TimeStruct.fromDate(date)) / 60;
		date.setUTCHours(date.getUTCHours() + OFFSET); // EST

		const tomorrow = new Date();
		tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
		tomorrow.setUTCHours(Math.abs(OFFSET), 0, 0, 0);

		const today = new Date();
		today.setUTCHours(Math.abs(OFFSET), 0, 0, 0);

		const RESET_TIME = Math.min(
			...[
				tomorrow.getTime(),
				today.getTime(),
			].filter(time => time >= Date.now()),
		);

		return `item: ${FetchurCommand.FETCHUR_ITEMS[(date.getUTCDate() - 1) % FetchurCommand.FETCHUR_ITEMS.length]}, changes ${Formatters.time(new Date(RESET_TIME), Formatters.TimestampStyles.RelativeTime)}`;
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async runSlash(interaction: CommandInteraction) {
		return await InteractionUtil.reply(interaction, this.#generateReply());
	}

	/**
	 * execute the command
	 * @param hypixelMessage
	 */
	override async runMinecraft(hypixelMessage: HypixelMessage) {
		return await hypixelMessage.reply(this.#generateReply());
	}
}
