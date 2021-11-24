import { seconds } from '../../../../functions';
import { BridgeCommand } from '../../../commands/BridgeCommand';
import type { CommandContext } from '../../../commands/BaseCommand';
import type { HypixelUserMessage } from '../../HypixelMessage';
import type GuildCommand from '../../../../commands/guild/guild';

export default class KickBridgeCommand extends BridgeCommand {
	constructor(context: CommandContext) {
		super(context, {
			description: 'kick a player from the guild',
			args: 2,
			usage: '[`IGN`] [`reason`]',
			cooldown: seconds(10),
			requiredRoles: (hypixelGuild) => hypixelGuild.adminRoleIds,
		});
	}

	/**
	 * execute the command
	 * @param hypixelMessage
	 */
	override async runMinecraft(hypixelMessage: HypixelUserMessage) {
		const targetInput = hypixelMessage.commandData.args.shift()!;
		const hypixelGuild = hypixelMessage.hypixelGuild ?? hypixelMessage.player?.hypixelGuild;

		if (!hypixelGuild) return hypixelMessage.author.send('unable to determine the guild to perform the kick on');

		const { content } =
			(await (this.client.commands.get('guild') as GuildCommand)?.runKick({
				ctx: hypixelMessage,
				target: this.client.players.getByIgn(targetInput) ?? targetInput,
				executor: hypixelMessage.player,
				reason: hypixelMessage.commandData.args.join(' '),
				hypixelGuild,
			})) ?? {};

		return hypixelMessage.author.send(content ?? 'an unknown error occurred');
	}
}
