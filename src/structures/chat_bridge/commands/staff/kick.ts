import { BridgeCommand } from '../../../commands/BridgeCommand';
import type { CommandContext } from '../../../commands/BaseCommand';
import type { HypixelMessage } from '../../HypixelMessage';
import type GuildCommand from '../../../../commands/guild/guild';
import type { Snowflake } from 'discord.js';


export default class KickBridgeCommand extends BridgeCommand {
	constructor(context: CommandContext) {
		super(context, {
			aliases: [],
			description: 'kick a player from the guild',
			args: 2,
			usage: '[`IGN`] [`reason`]',
			cooldown: 60,
			requiredRoles: () => [
				this.config.get('MODERATOR_ROLE_ID') as Snowflake,
				this.config.get('DANKER_STAFF_ROLE_ID') as Snowflake,
				this.config.get('SENIOR_STAFF_ROLE_ID') as Snowflake,
				this.config.get('MANAGER_ROLE_ID') as Snowflake,
			],
		});
	}

	/**
	 * execute the command
	 * @param hypixelMessage
	 */
	override async runMinecraft(hypixelMessage: HypixelMessage) {
		const targetInput = hypixelMessage.commandData!.args.shift()!;
		const { content } = await (this.client.commands.get('guild') as GuildCommand)?.runKick({
			target: this.client.players.getByIgn(targetInput) ?? targetInput,
			executor: hypixelMessage.player,
			reason: hypixelMessage.commandData!.args.join(' '),
			hypixelGuild: hypixelMessage.hypixelGuild!,
		});

		return hypixelMessage.author!.send(content);
	}
}
