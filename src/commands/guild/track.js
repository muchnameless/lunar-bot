import { SlashCommandBuilder } from '@discordjs/builders';
import { MessageAttachment } from 'discord.js';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { oneLine } from 'common-tags';
import { optionalPlayerOption, xpTypeOption } from '../../structures/commands/commonOptions.js';
import { InteractionUtil } from '../../util/index.js';
import { upperCaseFirstChar } from '../../functions/index.js';
import { SlashCommand } from '../../structures/commands/SlashCommand.js';


export default class TrackCommand extends SlashCommand {
	constructor(context) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('stats graph from the last 30 days')
				.addStringOption(optionalPlayerOption)
				.addStringOption(xpTypeOption),
			cooldown: 1,
		});
	}

	/**
	 * execute the command
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async runSlash(interaction) {
		const type = interaction.options.getString('type') ?? this.config.get('CURRENT_COMPETITION');
		const player = InteractionUtil.getPlayer(interaction, true);

		if (!player) {
			return await InteractionUtil.reply(interaction, oneLine`${interaction.options.get('player')
				? `\`${interaction.options.getString('player')}\` is`
				: 'you are'
			} not in the player db`);
		}

		const days = 30;

		let datasets;

		switch (type) {
			case 'weight': {
				const weightHistory = [ ...Array(days).keys() ].map(x => player.getSenitherWeightHistory(x));

				datasets = [{
					label: 'Weight',
					backgroundColor: 'rgba(0, 0, 255, 0.25)',
					borderColor: 'rgb(0, 0, 128)',
					data: weightHistory.map(({ weight }) => weight),
				}, {
					label: 'Overflow',
					backgroundColor: 'rgba(0, 255, 0, 0.25)',
					borderColor: 'rgb(0, 128, 0)',
					data: weightHistory.map(({ overflow }) => overflow),
				}, {
					label: 'Total Weight',
					backgroundColor: 'rgba(255, 0, 0, 0.25)',
					borderColor: 'rgb(128, 0, 0)',
					data: weightHistory.map(({ totalWeight }) => totalWeight),
				}];
				break;
			}

			case 'skill-average': {
				const skillAverageHistory = [ ...Array(days).keys() ].map(x => player.getSkillAverageHistory(x));

				datasets = [{
					label: 'Skill Average',
					backgroundColor: 'rgba(0, 0, 255, 0.25)',
					borderColor: 'rgb(0, 0, 128)',
					data: skillAverageHistory.map(({ skillAverage }) => skillAverage),
				}, {
					label: 'True Average',
					backgroundColor: 'rgba(0, 255, 0, 0.25)',
					borderColor: 'rgb(0, 128, 0)',
					data: skillAverageHistory.map(({ trueAverage }) => trueAverage),
				}];
				break;
			}

			case 'slayer': {
				datasets = [{
					label: 'Slayer XP',
					backgroundColor: 'rgba(0, 0, 255, 0.25)',
					borderColor: 'rgb(0, 0, 128)',
					data: [ ...Array(days).keys() ].map(x => player.getSlayerTotalHistory(x)),
				}];
				break;
			}

			case 'zombie':
			case 'spider':
			case 'wolf':
			case 'guild': {
				datasets = [{
					label: `${upperCaseFirstChar(type)} XP`,
					backgroundColor: 'rgba(0, 0, 255, 0.25)',
					borderColor: 'rgb(0, 0, 128)',
					data: [ ...Array(days).keys() ].map(x => player[`${type}XpHistory`][x]),
				}];
				break;
			}

			default: {
				datasets = [{
					label: `${upperCaseFirstChar(type)} XP`,
					backgroundColor: 'rgba(0, 0, 255, 0.25)',
					borderColor: 'rgb(0, 0, 128)',
					data: [ ...Array(days).keys() ].map(x => player.getSkillLevelHistory(type, x).nonFlooredLevel),
				}];
			}
		}

		const canvas = new ChartJSNodeCanvas({
			width: 800,
			height: 400,
		});

		const image = await canvas.renderToBuffer({
			type: 'line',
			data: {
				labels: [ ...Array(days).keys() ].map(x => days - 1 - x),
				datasets,
			},
		});

		return await InteractionUtil.reply(interaction, {
			embeds: [
				this.client.defaultEmbed
					.setAuthor(`${player}${player.mainProfileName ? ` (${player.mainProfileName})` : ''}`, await player.imageURL, player.url)
					.setTitle(`${upperCaseFirstChar(datasets[0].label)} history (${days} days)`)
					.setImage('attachment://file.jpg'),
			],
			files: [
				new MessageAttachment(image, 'file.jpg'),
			],
		});
	}
}
