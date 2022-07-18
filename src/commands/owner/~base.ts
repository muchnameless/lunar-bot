import { Buffer } from 'node:buffer';
import { env } from 'node:process';
import { inspect } from 'node:util';
import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, embedLength } from 'discord.js';
import { regExpEsc } from '@sapphire/utilities';
import { EmbedLimits } from '@sapphire/discord-utilities';
import { InteractionUtil } from '#utils';
import { ApplicationCommand } from '#structures/commands/ApplicationCommand';
import { UnicodeEmoji } from '#constants';
import { buildDeleteButton, buildPinButton, splitForEmbedFields } from '#functions';
import type {
	AttachmentPayload,
	MessageActionRowComponentBuilder,
	MessageComponentInteraction,
	EmbedBuilder,
	JSONEncodable,
} from 'discord.js';
import type { RepliableInteraction } from '#utils';

export default class BaseOwnerCommand extends ApplicationCommand {
	/**
	 * slightly less than 8 MB
	 */
	static MAX_FILE_SIZE = 8_387_600;

	/**
	 * replaces the client's token in 'text' and escapes `
	 * @param input
	 */
	protected _cleanOutput(input: string) {
		return (
			input
				// escape codeblock markdown
				.replaceAll('`', '`\u200B')
				// replace the client token
				.replace(new RegExp(this.client.token!, 'gi'), '***')
				// replace other .env values
				.replace(
					new RegExp(
						Object.entries(env)
							.filter(([key, value]) => value && /KEY|PASSWORD|TOKEN|URI/i.test(key))
							.flatMap(([, value]) => regExpEsc(value!).split(/\s+/))
							// sort descendingly by length
							.sort(({ length: a }, { length: b }) => b - a)
							.join('|'),
						'gi',
					),
					'***',
				)
				// home directories
				.replaceAll(env.HOME!, '~')
				.replaceAll(env.USER!, 'user')
		);
	}

	/**
	 * returns an attachment trimmed to the max file size
	 * @param content
	 */
	protected static _getFiles(interaction: RepliableInteraction, content: string) {
		// uploading files might take some time
		void InteractionUtil.defer(interaction);

		return [
			new AttachmentBuilder()
				.setFile(Buffer.from(content).subarray(0, BaseOwnerCommand.MAX_FILE_SIZE))
				.setName('result.js'),
		];
	}

	/**
	 * gets the original eval input from the result embed
	 * @param message
	 */
	protected static _getInputFromMessage(message: MessageComponentInteraction['message'] | null) {
		const fields = message?.embeds[0]?.fields;

		if (!fields) throw 'unable to extract the input from the attached message';

		let input = '';

		for (const { name, value } of fields) {
			if (['Output', 'Error'].includes(name)) break;

			input += value.replace(/^```[a-z]*\n|\n?```$/g, '');
		}

		return input;
	}

	/**
	 * @param responseEmbed
	 * @param input
	 * @param isAsync
	 */
	protected static _addInputToResponseEmbed(
		responseEmbed: EmbedBuilder,
		input: string,
		code: string,
		isAsync?: boolean,
	) {
		for (const [index, inputPart] of splitForEmbedFields(input, code).entries()) {
			responseEmbed.addFields({
				name: index ? '\u200B' : isAsync ? 'Async Input' : 'Input',
				value: inputPart,
			});
		}
	}

	/**
	 * removes sensitive information from the output, adds it to the embed and if overflowing returns a files array
	 * @param interaction
	 * @param responseEmbed
	 * @param output
	 * @param code
	 * @param footerField
	 */
	protected _addOutputToResponseEmbed(
		interaction: RepliableInteraction,
		responseEmbed: EmbedBuilder,
		output: string,
		code: 'ts' | 'bash',
		footerField?: string,
	) {
		const cleanedOutput = this._cleanOutput(output);

		let files: JSONEncodable<AttachmentPayload>[] | undefined;
		let length = embedLength(responseEmbed.data) + '\u200B'.length + (footerField?.length ?? 0);

		// add output fields till embed character limit is reached
		for (const [index, value] of splitForEmbedFields(cleanedOutput, code).entries()) {
			const name = index ? '\u200B' : 'Output';

			// embed size overflow -> convert output to file
			if ((length += name.length + value.length) > EmbedLimits.MaximumTotalCharacters) {
				// remove result fields
				responseEmbed.spliceFields(responseEmbed.data.fields!.length - index, Number.POSITIVE_INFINITY, {
					name: 'Output',
					value: 'result.js',
				});
				// add files
				files = BaseOwnerCommand._getFiles(interaction, cleanedOutput);
				break;
			}

			responseEmbed.addFields({ name, value });
		}

		if (footerField) {
			responseEmbed.addFields({
				name: '\u200B',
				value: footerField,
			});
		}

		return files;
	}

	/**
	 * @param interaction
	 * @param error
	 * @param responseEmbed
	 * @param footerField
	 * @param inspectDepth
	 */
	protected _respondWithError(
		interaction: RepliableInteraction<'cachedOrDM'>,
		error: unknown,
		responseEmbed: EmbedBuilder,
		footerField?: string,
		inspectDepth?: number,
	) {
		const CLEANED_OUTPUT = this._cleanOutput(inspect(error, { depth: Number.POSITIVE_INFINITY }));

		let files: JSONEncodable<AttachmentPayload>[] | undefined;
		let length = embedLength(responseEmbed.data) + '\u200B'.length + (footerField?.length ?? 0);

		for (const [index, value] of splitForEmbedFields(CLEANED_OUTPUT, 'xl').entries()) {
			const name = index ? '\u200B' : 'Error';

			// embed size overflow -> convert output to file
			if ((length += name.length + value.length) > EmbedLimits.MaximumTotalCharacters) {
				// remove error fields
				responseEmbed.spliceFields(responseEmbed.data.fields!.length - index, Number.POSITIVE_INFINITY, {
					name: 'Error',
					value: 'result.js',
				});
				// add files
				files = BaseOwnerCommand._getFiles(interaction, CLEANED_OUTPUT);
				break;
			}

			responseEmbed.addFields({ name, value });
		}

		if (footerField) {
			responseEmbed.addFields({
				name: '\u200B',
				value: footerField,
			});
		}

		return this._respond(interaction, responseEmbed, files, inspectDepth);
	}

	/**
	 * @param interaction
	 * @param responseEmbed
	 * @param files
	 * @param inspectDepth
	 */
	protected _respond(
		interaction: RepliableInteraction<'cachedOrDM'>,
		responseEmbed: EmbedBuilder,
		files: JSONEncodable<AttachmentPayload>[] | undefined,
		inspectDepth?: number,
	) {
		const customId = typeof inspectDepth === 'number' ? `:${inspectDepth}` : '';

		return InteractionUtil.replyOrUpdate(interaction, {
			embeds: [responseEmbed],
			components: [
				new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
					new ButtonBuilder()
						.setCustomId(`${this.baseCustomId}:edit${customId}`)
						.setEmoji({ name: UnicodeEmoji.EditMessage })
						.setStyle(ButtonStyle.Secondary),
					new ButtonBuilder()
						.setCustomId(`${this.baseCustomId}:repeat${customId}`)
						.setEmoji({ name: UnicodeEmoji.Reload })
						.setStyle(ButtonStyle.Secondary),
					buildPinButton(),
					buildDeleteButton(interaction.user.id),
				),
			],
			files,
		});
	}
}
