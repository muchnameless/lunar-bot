import { seconds } from '../../../../functions';
import { BridgeCommand } from '../../../commands/BridgeCommand';
import type { CommandContext } from '../../../commands/BaseCommand';
import type { HypixelMessage } from '../../HypixelMessage';
import type GuildCommand from '../../../../commands/guild/guild';


export default class KickBridgeCommand extends BridgeCommand {
	constructor(context: CommandContext) {
		super(context, {
			aliases: [],
			description: 'kick a player from the guild',
			args: 2,
			usage: '[`IGN`] [`reason`]',
			cooldown: seconds(10),
			requiredRoles: () => [
				this.config.get('MODERATOR_ROLE_ID'),
				this.config.get('DANKER_STAFF_ROLE_ID'),
				this.config.get('SENIOR_STAFF_ROLE_ID'),
				this.config.get('MANAGER_ROLE_ID'),
			],
		});
	}

	/**
	 * execute the command
	 * @param hypixelMessage
	 */
	override async runMinecraft(hypixelMessage: HypixelMessage<true>) {
		const targetInput = hypixelMessage.commandData.args.shift()!;
		const hypixelGuild = hypixelMessage.hypixelGuild ?? hypixelMessage.player?.hypixelGuild;

		if (!hypixelGuild) return hypixelMessage.author.send('unable to determine the guild to perform the kick on');

		const { content } = await (this.client.commands.get('guild') as GuildCommand)?.runKick({
			target: this.client.players.getByIgn(targetInput) ?? targetInput,
			executor: hypixelMessage.player,
			reason: hypixelMessage.commandData.args.join(' '),
			hypixelGuild,
		});

		return hypixelMessage.author.send(content);
	}
}
