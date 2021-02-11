'use strict';

const { reverseDateInput, autocorrect } = require('../../functions/util');
const ConfigCollection = require('../../structures/collections/ConfigCollection');
const LunarMessage = require('../../structures/extensions/Message');
const LunarClient = require('../../structures/LunarClient');
const Command = require('../../structures/Command');
const logger = require('../../functions/logger');


module.exports = class ScheduleCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 's' ],
			description: 'schedule a command to be executed at a later time',
			args: false,
			usage: '[`command`] [`@time`]\n<`-l`, `--list`> to list all active cron jobs\n<`-r`, `--remove`, `-d`, `--delete`> <`name`> to delete a cron job',
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {LunarClient} client
	 * @param {ConfigCollection} config
	 * @param {LunarMessage} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(client, config, message, args, flags, rawArgs) {
		const { cronJobs, db } = client;

		// list all running cron jobs
		if (flags.some(flag => [ 'l', 'list' ].includes(flag))) return message.reply(cronJobs.keyArray().join('\n'), { code: 'prolog', split: { char: '\n' } });

		// remove a cron job
		if (flags.some(flag => [ 'r', 'remove', 'd', 'delete' ].includes(flag))) {
			const name = args.join(' ');
			const result = autocorrect(name, cronJobs.keyArray());
			const cronJobToRemove = cronJobs.get(result.similarity >= config.get('AUTOCORRECT_THRESHOLD') ? result.value : null);

			if (!cronJobToRemove) return message.reply(`no cron job with the name \`${name}\` found.`);
			if (!name.includes('@')) return message.reply(`unable to remove \`${result.value}\`.`);

			cronJobToRemove.stop();
			cronJobs.delete(result.value);
			await db.CronJob.destroy({
				where: {
					name: result.value,
				},
			});

			return message.reply(`\`${name}\` was removed successfully, total amount of cron jobs: ${cronJobs.size}`);
		}

		// create a new cron job
		if (!args.length) return message.reply(`\`${config.get('PREFIX')}${this.aliases?.[0] ?? this.name}\` ${this.usage}`);

		const command = client.commands.getByName(args[0]);

		if (!command) return message.reply(`unknown command \`${args[0]}\`.`);

		args.shift();

		const commandArgs = [];
		const dateArgs = [];

		args.forEach(arg => arg.startsWith('@') ? dateArgs.push(arg.replace('@', '')) : commandArgs.push(arg));

		let hasDate = false;

		for (let index = 0; index < dateArgs.length; ++index) {
			let arg = dateArgs[index];

			if (arg.includes(':')) continue;

			const matched = arg.match(/(?<day>\d+)(?<month>\.\d+)?(?<year>\.\d+)?/);
			if (!matched.groups.month) arg += `${arg.endsWith('.') ? '' : '.'}${new Date().getMonth() + 1}`;
			if (!matched.groups.year) arg += `${arg.endsWith('.') ? '' : '.'}${new Date().getFullYear()}`;
			dateArgs[index] = reverseDateInput(arg);
			hasDate = true;
		}

		if (!hasDate) dateArgs.unshift(reverseDateInput(new Date().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }))); // add date if only time is present

		const date = new Date(dateArgs.join(','));
		const localDate = date.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

		if (Date.now() > date.getTime() - 1000) return message.reply(`${localDate} is in the past.`);

		const argsString = commandArgs.join(' ');
		const input = `${command.name}${flags.length ? ` -${flags.join(' -')}` : ''}${argsString.length ? ` ${argsString}` : ''}`;
		const name = `${input} @ ${localDate}`;

		await cronJobs.create({
			name,
			date,
			command,
			authorID: message.author.id,
			messageID: message.id,
			channelID: message.channel.id,
			args: argsString || null,
			flags: flags.join(' ') || null,
		});

		await message.reply(`\`${input}\` scheduled for \`${localDate}\`, total amount of cron jobs: ${cronJobs.size}`);
		message.replyMessageID = null; // to not overwrite prev reply
	}
};
