import { exec } from 'node:child_process';
import { env } from 'node:process';
import { promisify } from 'node:util';
import { Stopwatch } from '@sapphire/stopwatch';
import {
	ModalBuilder,
	SlashCommandBuilder,
	userMention,
	type AttachmentPayload,
	type ButtonInteraction,
	type ChatInputCommandInteraction,
	type Message,
	type MessageContextMenuCommandInteraction,
	type ModalSubmitInteraction,
	type JSONEncodable,
} from 'discord.js';
import BaseOwnerCommand from './~base.js';
import { logger } from '#logger';
import { type CommandContext } from '#structures/commands/BaseCommand.js';
import { type RepliableInteraction, InteractionUtil } from '#utils';

const pExec = promisify(exec);

export default class ExecCommand extends BaseOwnerCommand {
	public constructor(context: CommandContext) {
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

	private async _sharedRun(interaction: RepliableInteraction, input: string) {
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

			logger.error(error, '[EXEC CMD]');

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
	 *
	 * @param interaction
	 * @param message
	 */
	public override async messageContextMenuRun(
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
	 *
	 * @param interaction
	 * @param args parsed customId, split by ':'
	 */
	public override buttonRun(interaction: ButtonInteraction<'cachedOrDM'>, args: string[]) {
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
	 *
	 * @param interaction
	 * @param args parsed customId, split by ':'
	 */
	public override async modalSubmitRun(interaction: ModalSubmitInteraction<'cachedOrDM'>, args: string[]) {
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
	 *
	 * @param interaction
	 */
	public override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		return this._sharedRun(interaction, interaction.options.getString('input', true));
	}
}
