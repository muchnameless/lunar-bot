'use strict';

const { MessageAttachment, Constants } = require('discord.js');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const { oneLine } = require('common-tags');
const { upperCaseFirstChar } = require('../../functions/util');
const SlashCommand = require('../../structures/commands/SlashCommand');
// const logger = require('../../functions/logger');


module.exports = class TrackCommand extends SlashCommand {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'stats graph from the last 30 days',
			options: [{
				name: 'player',
				type: Constants.ApplicationCommandOptionTypes.STRING,
				description: 'IGN | minecraftUUID | discordID | @mention',
				required: false,
			},
			SlashCommand.XP_TYPE_OPTION,
			],
			defaultPermission: true,
			cooldown: 1,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) { // eslint-disable-line no-unused-vars
		const type = interaction.options.get('type')?.value ?? 'weight';
		const player = this.getPlayer(interaction.options, interaction);

		if (!player) {
			return interaction.reply(oneLine`${interaction.options.has('player')
				? `\`${interaction.options.get('player').value}\` is`
				: 'you are'
			} not in the player db.`);
		}

		const days = 30;

		let datasets;

		switch (type) {
			case 'weight': {
				const weightHistory = [ ...Array(days).keys() ].map(x => player.getWeightHistory(x));

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

			case 'skill': {
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
			case 'wolf': {
				datasets = [{
					label: upperCaseFirstChar(type),
					backgroundColor: 'rgba(0, 0, 255, 0.25)',
					borderColor: 'rgb(0, 0, 128)',
					data: [ ...Array(days).keys() ].map(x => player[`${type}XpHistory`][x]),
				}];
				break;
			}

			default: {
				datasets = [{
					label: upperCaseFirstChar(type),
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

		return interaction.reply({
			embeds: [
				this.client.defaultEmbed
					.setAuthor(`${player.ign}${player.mainProfileName ? ` (${player.mainProfileName})` : ''}`, player.image, player.url)
					.setTitle(`${upperCaseFirstChar(datasets[0].label)} history (${days} days)`)
					.setImage('attachment://file.jpg'),
			],
			files: [
				new MessageAttachment(image),
			],
		});
	}
};
