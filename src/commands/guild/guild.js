'use strict';

const { autocorrect } = require('../../functions/util');
const commandHandler = require('../../functions/commandHandler');
const Command = require('../../structures/commands/Command');
// const logger = require('../../functions/logger');


module.exports = class GuildCommand extends Command {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [ 'g' ],
			description: 'hypixel /guild commands',
			args: true,
			usage: () => `[${GuildCommand.SUB_COMMANDS.map(command => `\`${command}\``).join('|')}] <${this.client.hypixelGuilds.guildNamesAsFlags}>`,
			cooldown: 1,
		});
	}

	static SUB_COMMANDS = [ 'demote', 'history', 'info', 'invite', 'list', 'log', 'member', 'members', 'motd', 'mute', 'online', 'promote', 'quest', 'setrank', 'top', 'unmute' ];

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} flags command flags
	 * @param {string} command
	 */
	async _run(message, flags, command) {
		/**
		 * @type {import('../../structures/database/models/HypixelGuild')}
		 */
		const hypixelGuild = this.client.hypixelGuilds.getFromArray(flags) ?? message.author.player?.guild;

		if (!hypixelGuild) return message.reply('unable to find your guild.');

		const data = await hypixelGuild.chatBridge.minecraft.command({
			command,
		});

		return message.reply(this.client.defaultEmbed
			.setTitle(`/${command}`)
			.setDescription(`\`\`\`\n${data}\`\`\``),
		);
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(message, args, flags, rawArgs) { // eslint-disable-line no-unused-vars
		const INPUT = args.shift();
		const { value, similarity } = autocorrect(INPUT, GuildCommand.SUB_COMMANDS);

		if (similarity < this.config.get('AUTOCORRECT_THRESHOLD') && !this.force(flags)) {
			const ANSWER = await message.awaitReply(`there is currently no guild command for \`${INPUT.toLowerCase()}\`. Did you mean \`${value}\`?`, 30);

			if (!message.client.config.getArray('REPLY_CONFIRMATION').includes(ANSWER?.toLowerCase())) return;
		}

		// temporarily modifiy the cached message, not a good practise but js has no CPY-CTOR
		const { content } = message;

		try {
			rawArgs.splice(0, 1, `guild${value}`);
			message.content = `${this.config.get('PREFIX')}${rawArgs.join(' ')}`;

			return await commandHandler(message);
		} finally {
			message.content = content;
		}
	}
};
