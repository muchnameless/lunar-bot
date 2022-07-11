import { ContextMenuCommandBuilder, SlashCommandBuilder } from 'discord.js';
import { logger } from '#logger';
import { GuildMemberUtil, InteractionUtil } from '#utils';
import { ApplicationCommand } from '#structures/commands/ApplicationCommand';
import { UNKNOWN_IGN } from '#constants';
import type { ChatInputCommandInteraction, GuildMember, User, UserContextMenuCommandInteraction } from 'discord.js';
import type { CommandContext } from '#structures/commands/BaseCommand';

export default class UnnickCommand extends ApplicationCommand {
	constructor(context: CommandContext) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription("resets a user's nickname")
				.addUserOption((option) =>
					option //
						.setName('user')
						.setDescription('the user to unnick')
						.setRequired(true),
				)
				.setDMPermission(false),
			user: new ContextMenuCommandBuilder() //
				.setName('Reset nickname')
				.setDMPermission(false),
			cooldown: 0,
		});
	}

	/**
	 * @param interaction
	 * @param member
	 */
	private async _sharedRun(
		interaction: ChatInputCommandInteraction<'cachedOrDM'> | UserContextMenuCommandInteraction<'cachedOrDM'>,
		member: GuildMember | null,
	) {
		// input validation
		if (!member) {
			return InteractionUtil.reply(interaction, {
				content: `${interaction.options.getUser('user', true)} is not in the discord server`,
				allowedMentions: { parse: [] },
			});
		}

		// permission check(s)
		if (!member.manageable) {
			return InteractionUtil.reply(interaction, {
				content: `missing permissions to reset ${member}'s nickname`,
				allowedMentions: { parse: [] },
			});
		}

		// determine new nickname
		const player = GuildMemberUtil.getPlayer(member);
		const NEW_NICK = player && player.ign !== UNKNOWN_IGN ? player.ign : null; // remove to username if IGN is unknown

		// check if change is neccessary
		if (NEW_NICK === null) {
			if (!member.nickname) {
				return InteractionUtil.reply(interaction, {
					content: `${member} has no nickname`,
					allowedMentions: { parse: [] },
				});
			}
		} else if (member.displayName === NEW_NICK) {
			return InteractionUtil.reply(interaction, {
				content: `${member} is already nicked with their IGN`,
				allowedMentions: { parse: [] },
			});
		}

		// API call
		try {
			await member.setNickname(NEW_NICK, `reset by ${interaction.user.tag}`);

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
	override userContextMenuRun(
		interaction: UserContextMenuCommandInteraction<'cachedOrDM'>,
		_: User,
		member: GuildMember | null,
	) {
		return this._sharedRun(interaction, member);
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		return this._sharedRun(interaction, interaction.options.getMember('user'));
	}
}
