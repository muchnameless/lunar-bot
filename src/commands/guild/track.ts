import { AttachmentBuilder, SlashCommandBuilder } from 'discord.js';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { InteractionUtil } from '#utils';
import { optionalPlayerOption, xpTypeOption } from '#structures/commands/commonOptions';
import { ApplicationCommand } from '#structures/commands/ApplicationCommand';
import { seconds, upperCaseFirstChar } from '#functions';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandContext } from '#structures/commands/BaseCommand';
import type { LeaderboardXPTypes } from '#functions';

interface DataSets {
	label: string;
	backgroundColor: string;
	borderColor: string;
	data: number[];
}

export default class TrackCommand extends ApplicationCommand {
	constructor(context: CommandContext) {
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
	 * @param interaction
	 */
	override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		const player = InteractionUtil.getPlayer(interaction, { fallbackToCurrentUser: true, throwIfNotFound: true });
		const type =
			(interaction.options.getString('type') as LeaderboardXPTypes) ?? this.config.get('CURRENT_COMPETITION');
		const days = 30;

		let datasets: DataSets[];

		switch (type) {
			case 'lily-weight': {
				const weightHistory = [...Array.from({ length: days }).keys()].map((x) => player.getLilyWeightHistory(x));

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
				const weightHistory = [...Array.from({ length: days }).keys()].map((x) => player.getSenitherWeightHistory(x));

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
				const skillAverageHistory = [...Array.from({ length: days }).keys()].map((x) =>
					player.getSkillAverageHistory(x),
				);

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
						data: [...Array.from({ length: days }).keys()].map((x) => player.getSlayerTotalHistory(x)),
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
						data: [...Array.from({ length: days }).keys()].map((x) => player[`${type}XpHistory`][x]!),
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
						data: [...Array.from({ length: days }).keys()].map(
							(x) => player.getSkillLevelHistory(type, x).nonFlooredLevel,
						),
					},
				];
			}
		}

		const canvas = new ChartJSNodeCanvas({
			width: 800,
			height: 400,
		});
		const image = await canvas.renderToBuffer({
			type: 'line',
			data: {
				labels: [...Array.from({ length: days }).keys()].map((x) => days - 1 - x),
				datasets,
			},
		});
		const attachment = new AttachmentBuilder() //
			.setFile(image)
			.setName('file.jpg');

		return InteractionUtil.reply(interaction, {
			embeds: [
				this.client.defaultEmbed
					.setAuthor({
						name: `${player}${player.mainProfileName ? ` (${player.mainProfileName})` : ''}`,
						iconURL: player.imageURL,
						url: player.url,
					})
					.setTitle(`${upperCaseFirstChar(datasets[0]!.label)} history (${days} days)`)
					.setImage(`attachment://${attachment.data.name}`),
			],
			files: [attachment],
		});
	}
}
