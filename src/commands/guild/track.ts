import { createCanvas, type Canvas } from '@napi-rs/canvas';
import { Chart } from 'chart.js/auto';
import { AttachmentBuilder, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { seconds, upperCaseFirstChar, type LeaderboardXPTypes } from '#functions';
import { ApplicationCommand } from '#structures/commands/ApplicationCommand.js';
import type { CommandContext } from '#structures/commands/BaseCommand.js';
import { optionalPlayerOption, xpTypeOption } from '#structures/commands/commonOptions.js';
import { InteractionUtil } from '#utils';

interface DataSets {
	backgroundColor: string;
	borderColor: string;
	data: number[];
	label: string;
}

export default class TrackCommand extends ApplicationCommand {
	public constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder()
				.setDescription('stats graph from the last 30 days')
				.addStringOption(optionalPlayerOption)
				.addStringOption(xpTypeOption),
			cooldown: seconds(1),
		});
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 */
	public override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		const player = InteractionUtil.getPlayer(interaction, { fallbackToCurrentUser: true, throwIfNotFound: true });
		const type =
			(interaction.options.getString('type') as LeaderboardXPTypes) ?? this.config.get('CURRENT_COMPETITION');
		const days = 30;

		let datasets: DataSets[];

		switch (type) {
			case 'lily-weight': {
				const weightHistory = Array.from({ length: days }, (_, index) => player.getLilyWeightHistory(index));

				datasets = [
					{
						label: 'Lily Weight',
						backgroundColor: 'rgba(0, 0, 255, 0.25)',
						borderColor: 'rgb(0, 0, 128)',
						data: weightHistory.map(({ weight }) => weight),
					},
					{
						label: 'Overflow',
						backgroundColor: 'rgba(0, 255, 0, 0.25)',
						borderColor: 'rgb(0, 128, 0)',
						data: weightHistory.map(({ overflow }) => overflow),
					},
					{
						label: 'Total Weight',
						backgroundColor: 'rgba(255, 0, 0, 0.25)',
						borderColor: 'rgb(128, 0, 0)',
						data: weightHistory.map(({ totalWeight }) => totalWeight),
					},
				];
				break;
			}

			case 'senither-weight': {
				const weightHistory = Array.from({ length: days }, (_, index) => player.getSenitherWeightHistory(index));

				datasets = [
					{
						label: 'Senither Weight',
						backgroundColor: 'rgba(0, 0, 255, 0.25)',
						borderColor: 'rgb(0, 0, 128)',
						data: weightHistory.map(({ weight }) => weight),
					},
					{
						label: 'Overflow',
						backgroundColor: 'rgba(0, 255, 0, 0.25)',
						borderColor: 'rgb(0, 128, 0)',
						data: weightHistory.map(({ overflow }) => overflow),
					},
					{
						label: 'Total Weight',
						backgroundColor: 'rgba(255, 0, 0, 0.25)',
						borderColor: 'rgb(128, 0, 0)',
						data: weightHistory.map(({ totalWeight }) => totalWeight),
					},
				];
				break;
			}

			case 'skill-average': {
				const skillAverageHistory = Array.from({ length: days }, (_, index) => player.getSkillAverageHistory(index));

				datasets = [
					{
						label: 'Skill Average',
						backgroundColor: 'rgba(0, 0, 255, 0.25)',
						borderColor: 'rgb(0, 0, 128)',
						data: skillAverageHistory.map(({ skillAverage }) => skillAverage),
					},
					{
						label: 'True Average',
						backgroundColor: 'rgba(0, 255, 0, 0.25)',
						borderColor: 'rgb(0, 128, 0)',
						data: skillAverageHistory.map(({ trueAverage }) => trueAverage),
					},
				];
				break;
			}

			case 'slayer': {
				datasets = [
					{
						label: 'Slayer XP',
						backgroundColor: 'rgba(0, 0, 255, 0.25)',
						borderColor: 'rgb(0, 0, 128)',
						data: Array.from({ length: days }, (_, index) => player.getSlayerTotalHistory(index)),
					},
				];
				break;
			}

			case 'zombie':
			case 'spider':
			case 'wolf':
			case 'enderman':
			case 'blaze':
			case 'guild': {
				datasets = [
					{
						label: `${upperCaseFirstChar(type)} XP`,
						backgroundColor: 'rgba(0, 0, 255, 0.25)',
						borderColor: 'rgb(0, 0, 128)',
						data: Array.from({ length: days }, (_, index) => player[`${type}XpHistory`][index]!),
					},
				];
				break;
			}

			default: {
				datasets = [
					{
						label: `${upperCaseFirstChar(type)} XP`,
						backgroundColor: 'rgba(0, 0, 255, 0.25)',
						borderColor: 'rgb(0, 0, 128)',
						data: Array.from({ length: days }, (_, index) => player.getSkillLevelHistory(type, index).nonFlooredLevel),
					},
				];
			}
		}

		const chart = new Chart(createCanvas(800, 400), {
			type: 'line',
			data: {
				labels: Array.from({ length: days }, (_, index) => (days - 1 - index).toString()),
				datasets,
			},
		});
		const image = await (chart.canvas as Canvas).encode('png');
		const attachment = new AttachmentBuilder() //
			.setFile(image)
			.setName('graph.png');

		return InteractionUtil.reply(interaction, {
			embeds: [
				this.client.defaultEmbed
					.setAuthor({
						name: `${player}${player.mainProfileName ? ` (${player.mainProfileName})` : ''}`,
						iconURL: player.imageURL,
						url: player.url,
					})
					.setTitle(`${upperCaseFirstChar(datasets[0]!.label)} history (${days} days)`)
					.setImage(`attachment://${attachment.name}`),
			],
			files: [attachment],
		});
	}
}
