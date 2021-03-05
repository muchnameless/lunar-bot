'use strict';

const { stripIndents } = require('common-tags');
const { reverseDateInput, autocorrect } = require('../../functions/util');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class ScheduleCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 's' ],
			description: 'schedule a command to be executed at a later time',
			args: false,
			usage: stripIndents`
				[\`command\`] [\`@time\`]
				<\`-l\`|\`--list\`> to list all active cron jobs
				<\`-r\`|\`--remove\`|\`-d\`|\`--delete\`> <\`name\`> to delete a user created cron job
			`,
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
		const { cronJobs } = this.client;

		// list all running cron jobs
		if (flags.some(flag => [ 'l', 'list' ].includes(flag))) return message.reply(cronJobs.cache.keyArray().join('\n'), { code: 'prolog', split: { char: '\n' } });

		// remove a cron job
		if (flags.some(flag => [ 'r', 'remove', 'd', 'delete' ].includes(flag))) {
			const name = args.join(' ');
			const result = autocorrect(name, cronJobs.cache, 'name');

			if (result.similarity < this.client.config.get('AUTOCORRECT_THRESHOLD')) return message.reply(`no cron job with the name \`${name}\` found.`);

			const { value: cronJob } = result;

			if (!cronJob.name.includes('@')) return message.reply(`unable to remove \`${cronJob.name}\`.`);

			await cronJobs.remove(cronJob);

			return message.reply(`\`${name}\` was removed successfully, total amount of cron jobs: ${cronJobs.size}`);
		}

		// create a new cron job
		if (!args.length) return message.reply(this.usageInfo);

		const command = this.client.commands.getByName(args[0]);

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
		const LOCALE_DATE_STRING = date.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

		if (Date.now() > date.getTime() - 1_000) return message.reply(`${LOCALE_DATE_STRING} is in the past.`);

		const ARGS_STRING = commandArgs.join(' ');
		const INPUT_STRING = `${command.name}${flags.length ? ` -${flags.join(' -')}` : ''}${ARGS_STRING.length ? ` ${ARGS_STRING}` : ''}`;
		const name = `${INPUT_STRING} @ ${LOCALE_DATE_STRING}`;

		await cronJobs.add({
			name,
			date,
			command,
			authorID: message.author.id,
			messageID: message.id,
			channelID: message.channel.id,
			args: ARGS_STRING || null,
			flags: flags.join(' ') || null,
		});

		await message.reply(
			`\`${INPUT_STRING}\` scheduled for \`${LOCALE_DATE_STRING}\`, total amount of cron jobs: ${cronJobs.size}`,
			{ saveReplyMessageID: false },
		);
	}
};
