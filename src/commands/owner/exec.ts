import { promisify } from 'node:util';
import { exec } from 'node:child_process';
import { env } from 'node:process';
import { ModalBuilder, SlashCommandBuilder, userMention } from 'discord.js';
import { Stopwatch } from '@sapphire/stopwatch';
import { InteractionUtil } from '#utils';
import { logger } from '#logger';
import BaseOwnerCommand from './~base';
import type { RepliableInteraction } from '#utils';
import type {
	AttachmentPayload,
	ButtonInteraction,
	ChatInputCommandInteraction,
	Message,
	MessageContextMenuCommandInteraction,
	ModalSubmitInteraction,
	JSONEncodable,
} from 'discord.js';
import type { CommandContext } from '#structures/commands/BaseCommand';

const pExec = promisify(exec);

export default class ExecCommand extends BaseOwnerCommand {
	constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder() //
				.setDescription('executes bash code')
				.addStringOption((option) =>
					option //
						.setName('input')
						.setDescription('bash code')
						.setRequired(true),
				),
			cooldown: 0,
		});
	}

	protected async _sharedRun(interaction: RepliableInteraction, input: string) {
		if (interaction.user.id !== this.client.ownerId) {
			throw `exec is restricted to ${userMention(this.client.ownerId)}`;
		}

		const me = interaction.guild?.members.me ?? null;
		const responseEmbed = this.client.defaultEmbed //
			.setFooter({
				text: me?.displayName ?? this.client.user!.username,
				iconURL: (me ?? this.client.user!).displayAvatarURL(),
			});

		ExecCommand._addInputToResponseEmbed(responseEmbed, input, 'bash');

		const stopwatch = new Stopwatch();

		try {
			const { stdout, stderr } = await pExec(input);

			stopwatch.stop();

			const files: JSONEncodable<AttachmentPayload>[] = [];

			for (const std of [stdout, stderr]) {
				if (!std) continue;

				const outFiles = this._addOutputToResponseEmbed(
					interaction,
					responseEmbed,
					std,
					'bash',
					`shell: ${env.SHELL} • time taken: \`${stopwatch}\``,
				);

				if (outFiles) files.push(...outFiles);
			}

			return this._respond(interaction, responseEmbed, files);
		} catch (error) {
			stopwatch.stop();

			logger.error(error, '[EXEC]');

			return this._respondWithError(
				interaction,
				error,
				responseEmbed,
				`shell: ${env.SHELL} • time taken: \`${stopwatch}\``,
			);
		}
	}

	/**
	 * execute the command
	 * @param interaction
	 * @param message
	 */
	override messageContextMenuRun(
		interaction: MessageContextMenuCommandInteraction<'cachedOrDM'>,
		{ content, author }: Message,
	) {
		if (author.id !== this.client.ownerId) {
			throw `cannot evaluate a message from ${author}`;
		}

		if (!content) {
			throw 'no content to evaluate';
		}

		return this._sharedRun(interaction, content);
	}

	/**
	 * execute the command
	 * @param interaction
	 * @param args parsed customId, split by ':'
	 */
	override buttonRun(interaction: ButtonInteraction<'cachedOrDM'>, args: string[]) {
		const [subcommand] = args as [string];

		switch (subcommand) {
			case 'edit': {
				return InteractionUtil.showModal(
					interaction,
					new ModalBuilder()
						.setTitle(this.name)
						.setCustomId(interaction.customId)
						.addComponents(ExecCommand._buildInputTextInput(interaction)),
				);
			}

			case 'repeat': {
				const input = ExecCommand._getInputFromMessage(interaction.message);

				return this._sharedRun(interaction, input);
			}

			default:
				throw new Error(`unknown subcommand '${subcommand}'`);
		}
	}

	/**
	 * execute the command
	 * @param interaction
	 * @param args parsed customId, split by ':'
	 */
	override modalSubmitRun(interaction: ModalSubmitInteraction<'cachedOrDM'>, args: string[]) {
		const [subcommand] = args as [string];

		switch (subcommand) {
			case 'edit':
				return this._sharedRun(
					interaction,
					interaction.fields.getTextInputValue('input') || ExecCommand._getInputFromMessage(interaction.message),
				);

			default:
				throw new Error(`unknown subcommand '${subcommand}'`);
		}
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		return this._sharedRun(interaction, interaction.options.getString('input', true));
	}
}
