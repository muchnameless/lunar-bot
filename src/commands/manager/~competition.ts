import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { DUNGEON_TYPES, SKILLS } from '#constants';
import { autocorrect, commaListOr, seconds } from '#functions';
import { ApplicationCommand } from '#structures/commands/ApplicationCommand.js';
import { type CommandContext } from '#structures/commands/BaseCommand.js';
import { InteractionUtil } from '#utils';

/**
 * Roadmap: (project discontinued)
 *  - input via modals (date option, autocomplete)
 *  - use guild scheduled events to register event for players to participate
 */

export default class CompetitionCommand extends ApplicationCommand {
	/**
	 * possible types for a competition
	 */
	private readonly COMPETITION_TYPES = [...SKILLS, 'slayer', ...DUNGEON_TYPES];

	public constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder().setDescription('WIP'),
			cooldown: seconds(1),
		});
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 */
	public override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		const collector = interaction.channel?.createMessageCollector({
			filter: (msg) => msg.author.id === interaction.user.id,
			idle: seconds(30),
		});

		if (!collector) return void InteractionUtil.reply(interaction, { content: 'unknown channel', ephemeral: true });

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
			void InteractionUtil.reply(interaction, `competition type? ${commaListOr(this.COMPETITION_TYPES)}`);

			do {
				// eslint-disable-next-line n/callback-return
				const collected = await next();
				const result = autocorrect(collected, this.COMPETITION_TYPES);

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
				// eslint-disable-next-line n/callback-return
				const collected = await next();
				const result = new Date(collected);

				if (Number.isNaN(result.getTime())) {
					if (++retries >= this.config.get('USER_INPUT_MAX_RETRIES')) throw 'the command has been cancelled';

					void InteractionUtil.reply(interaction, `\`${collected}\` is not a valid date`);
				} else {
					startingTime = result;
					retries = 0;
				}
			} while (!startingTime);

			void InteractionUtil.reply(interaction, 'ending time?');

			do {
				// eslint-disable-next-line n/callback-return
				const collected = await next();

				const result = new Date(collected);

				if (Number.isNaN(result.getTime())) {
					if (++retries >= this.config.get('USER_INPUT_MAX_RETRIES')) throw 'the command has been cancelled';

					void InteractionUtil.reply(interaction, `\`${collected}\` is not a valid date`);
				} else {
					endingTime = result;
					retries = 0;
				}
			} while (!endingTime);

			return InteractionUtil.reply(
				interaction,
				`type: ${type}, starting time: ${startingTime.toUTCString()}, ending time: ${endingTime.toUTCString()}`,
			);
		} finally {
			collector.stop();
		}
	}
}
