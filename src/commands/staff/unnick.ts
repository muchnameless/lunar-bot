import { ContextMenuCommandBuilder, SlashCommandBuilder } from '@discordjs/builders';
import { UNKNOWN_IGN } from '../../constants';
import { logger } from '../../functions';
import { GuildMemberUtil, InteractionUtil } from '../../util';
import { ApplicationCommand } from '../../structures/commands/ApplicationCommand';
import type { CommandInteraction, ContextMenuInteraction, GuildMember, User } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';


export default class UnnickCommand extends ApplicationCommand {
	constructor(context: CommandContext) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('resets a user\'s nickname')
				.addUserOption(option => option
					.setName('user')
					.setDescription('the user to unnick')
					.setRequired(true),
				)
				.setDefaultPermission(false),
			user: new ContextMenuCommandBuilder()
				.setName('Reset nickname')
				.setDefaultPermission(false),
			cooldown: 0,
		});
	}

	/**
	 * @param interaction
	 * @param member
	 */
	// eslint-disable-next-line class-methods-use-this
	async #run(interaction: CommandInteraction | ContextMenuInteraction, member: GuildMember | null) {
		// input validation
		if (!member) return InteractionUtil.reply(interaction, {
			content: `${interaction.options.getUser('user', true)} is not in the discord server`,
			allowedMentions: { parse: [] },
		});

		// permission check(s)
		if (!member.manageable) return InteractionUtil.reply(interaction, {
			content: `missing permissions to reset ${member}'s nickname`,
			allowedMentions: { parse: [] },
		});

		// determine new nickname
		const player = GuildMemberUtil.getPlayer(member);
		const NEW_NICK = player && player.ign !== UNKNOWN_IGN
			? player.ign
			: null; // remove to username if IGN is unknown

		// check if change is neccessary
		if (NEW_NICK === null) {
			if (!member.nickname) return InteractionUtil.reply(interaction, {
				content: `${member} has no nickname`,
				allowedMentions: { parse: [] },
			});
		} else if (member.displayName === NEW_NICK) {
			return InteractionUtil.reply(interaction, {
				content: `${member} is already nicked with their IGN`,
				allowedMentions: { parse: [] },
			});
		}

		// API call
		try {
			await member.setNickname(null, `reset by ${interaction.user.tag}`);

			return InteractionUtil.reply(interaction, {
				content: `successfully reset ${member}'s nickname`,
				allowedMentions: { parse: [] },
			});
		} catch (error) {
			logger.error(error);

			return InteractionUtil.reply(interaction, {
				content: `error resetting ${member}'s nickname: ${error}`,
				allowedMentions: { parse: [] },
			});
		}
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override runUser(interaction: ContextMenuInteraction, _: User, member: GuildMember | null) {
		return this.#run(interaction, member);
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override runSlash(interaction: CommandInteraction) { // eslint-disable-line @typescript-eslint/no-unused-vars
		return this.#run(interaction, interaction.options.getMember('user') as GuildMember | null);
	}
}
