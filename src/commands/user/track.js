'use strict';

const { MessageEmbed, MessageAttachment } = require('discord.js');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const { oneLine, stripIndents } = require('common-tags');
const { upperCaseFirstChar, autocorrectToType, autocorrect } = require('../../functions/util');
const { SKILLS, COSMETIC_SKILLS, SLAYERS, DUNGEON_TYPES, DUNGEON_CLASSES } = require('../../constants/skyblock');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');
const { autocorrectToType: getType } = require('../../functions/leaderboardMessages');


module.exports = class TracklistCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'stats graph from the last 30 days',
			args: false,
			usage: () => stripIndents`
				<\`IGN\`|\`@mention\`> <\`type\`>

				currently supported types:
				skill, ${SKILLS.join(', ')}
				${COSMETIC_SKILLS.join(', ')}
				slayer, revenant, tarantula, sven, ${SLAYERS.join(', ')}
				dungeon, ${[ ...DUNGEON_TYPES, ...DUNGEON_CLASSES ].join(', ')}
				weight
			`,
			cooldown: 1,
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
		// type input
		const typeInput = args.map((arg, index) => ({ index, ...autocorrectToType(arg) })).sort((a, b) => a.similarity - b.similarity).pop();
		const type = typeInput?.similarity >= this.client.config.get('AUTOCORRECT_THRESHOLD')
			? (() => {
				args.splice(typeInput.index, 1);
				return typeInput.value;
			})()
			: 'weight';

		// player input
		/**
		 * @type {import('../../structures/database/models/Player')}
		 */
		const player = message.mentions.users.size
			? message.mentions.users.first().player
			: (() => {
				const playerInput = args.map(arg => autocorrect(arg, this.client.players.cache, 'ign')).sort((a, b) => a.similarity - b.similarity).pop();

				return playerInput?.similarity >= this.client.config.get('AUTOCORRECT_THRESHOLD')
					? playerInput.value
					: message.author.player;
			})();

		if (!player) {
			return message.reply(oneLine`${message.mentions.users.size
				? `\`${message.guild
					? message.mentions.members.first().displayName
					: message.mentions.users.first().username}\`
					 is`
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
				}];
				break;
			}

			case 'skill': {
				const skillAverageHistory = [ ...Array(days).keys() ].map(x => player.getSkillAverageHistory(x));

				datasets = [{
					label: 'Skill Average',
					backgroundColor: 'rgba(0, 0, 255, 0.25)',
					borderColor: 'rgb(0, 0, 128)',
					data: skillAverageHistory.map(x => x.skillAverage),
				}, {
					label: 'True Average',
					backgroundColor: 'rgba(0, 255, 0, 0.25)',
					borderColor: 'rgb(0, 128, 0)',
					data: skillAverageHistory.map(x => x.trueAverage),
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

		message.reply(new MessageEmbed()
			.setColor(this.client.config.get('EMBED_BLUE'))
			.setAuthor(`${player.ign}${player.mainProfileName ? ` (${player.mainProfileName})` : ''}`, player.image, player.url)
			.setTitle(`${upperCaseFirstChar(datasets[0].label)} history (${days} days)`)
			.attachFiles(new MessageAttachment(image))
			.setImage('attachment://file.jpg')
			.setTimestamp(),
		);
	}
};
