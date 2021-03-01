'use strict';

const { MessageEmbed, MessageAttachment } = require('discord.js');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class TracklistCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'gained weight from members below reqs',
			args: false,
			usage: '',
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(message, args, flags, rawArgs) {
		const type = 'Weight';
		const player = message.author.player;
		const days = 30;

		const canvas = new ChartJSNodeCanvas({
			width: 800,
			height: 400,
		});

		const weightHistory = [ ...Array(days).keys() ].map(x => player.getWeightHistory(x));

		const image = await canvas.renderToBuffer({
			type: 'line',
			data: {
				labels: [ ...Array(days).keys() ].map(x => days - 1 - x),
				datasets: [{
					label: 'Weight',
					backgroundColor: 'rgba(0, 0, 255, 0.25)',
					borderColor: 'rgb(0, 0, 128)',
					data: weightHistory.map(x => x.weight),
				}, {
					label: 'Overflow',
					backgroundColor: 'rgba(0, 255, 0, 0.25)',
					borderColor: 'rgb(0, 128, 0)',
					data: weightHistory.map(x => x.overflow),
				}, {
					label: 'Total Weight',
					backgroundColor: 'rgba(255, 0, 0, 0.25)',
					borderColor: 'rgb(128, 0, 0)',
					data: weightHistory.map(x => x.totalWeight),
				}],
			},
			options: {
				scales: {
					yAxes: [{
						ticks: {
							beginAtZero: true,
						},
					}],
				},
			},
		});

		message.reply(new MessageEmbed()
			.setColor(this.client.config.get('EMBED_BLUE'))
			.setTitle(`${type}`)
			.attachFiles(new MessageAttachment(image))
			.setImage('attachment://file.jpg')
			.setTimestamp(),
		);
	}
};
