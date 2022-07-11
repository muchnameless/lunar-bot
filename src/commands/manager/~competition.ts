import { SlashCommandBuilder } from 'discord.js';
import { InteractionUtil } from '#utils';
import { ApplicationCommand } from '#structures/commands/ApplicationCommand';
import { DUNGEON_TYPES, SKILLS } from '#constants';
import { autocorrect, commaListOr, seconds } from '#functions';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandContext } from '#structures/commands/BaseCommand';

/**
 * Roadmap: (project discontinued)
 *  - input via modals (date option, autocomplete)
 *  - use guild scheduled events to register event for players to participate
 */

export class CompetitionCommand extends ApplicationCommand {
	constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder().setDescription('WIP'),
			cooldown: seconds(1),
		});
	}

	/**
	 * possible types for a competition
	 */
	static COMPETITION_TYPES = [...SKILLS, 'slayer', ...DUNGEON_TYPES];

	/**
	 * execute the command
	 * @param interaction
	 */
	override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		const collector = interaction.channel!.createMessageCollector({
			filter: (msg) => msg.author.id === interaction.user.id,
			idle: seconds(30),
		});
		const next = async () => {
			const { content } = await collector.next;
			if (/^(?:abort|cancel|end|stop)$/i.test(content)) throw 'command cancelled';
			return content;
		};

		let type: string | undefined;
		let startingTime: Date | undefined;
		let endingTime: Date | undefined;
		let retries = 0;

		try {
			void InteractionUtil.reply(interaction, `competition type? ${commaListOr(CompetitionCommand.COMPETITION_TYPES)}`);

			do {
				const collected = await next();
				const result = autocorrect(collected, CompetitionCommand.COMPETITION_TYPES);

				if (result.similarity >= this.config.get('AUTOCORRECT_THRESHOLD')) {
					type = result.value;
					retries = 0;
				} else {
					if (++retries >= this.config.get('USER_INPUT_MAX_RETRIES')) throw 'the command has been cancelled';

					void InteractionUtil.reply(interaction, `\`${collected}\` is not a valid type`);
				}
			} while (!type);

			void InteractionUtil.reply(interaction, 'starting time?');

			do {
				const collected = await next();
				const result = new Date(collected);

				if (!Number.isNaN(result.getTime())) {
					startingTime = result;
					retries = 0;
				} else {
					if (++retries >= this.config.get('USER_INPUT_MAX_RETRIES')) throw 'the command has been cancelled';

					void InteractionUtil.reply(interaction, `\`${collected}\` is not a valid date`);
				}
			} while (!startingTime);

			void InteractionUtil.reply(interaction, 'ending time?');

			do {
				const collected = await next();

				const result = new Date(collected);

				if (!Number.isNaN(result.getTime())) {
					endingTime = result;
					retries = 0;
				} else {
					if (++retries >= this.config.get('USER_INPUT_MAX_RETRIES')) throw 'the command has been cancelled';

					void InteractionUtil.reply(interaction, `\`${collected}\` is not a valid date`);
				}
			} while (!endingTime);

			void InteractionUtil.reply(
				interaction,
				`type: ${type}, starting time: ${startingTime.toUTCString()}, ending time: ${endingTime.toUTCString()}`,
			);
		} finally {
			collector.stop();
		}
	}
}
