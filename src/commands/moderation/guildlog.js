'use strict';

const { MessageEmbed } = require('discord.js');
const Command = require('../../structures/commands/Command');
// const logger = require('../../functions/logger');


module.exports = class GuildListCommand extends Command {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [ 'glog' ],
			description: 'guild log',
			args: false,
			usage: () => `<\`IGN\`> <page \`number\`> <${this.client.hypixelGuilds.guildNamesAsFlags}>`,
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
	async run(message, args, flags, rawArgs) { // eslint-disable-line no-unused-vars
		/**
		 * @type {import('../../structures/database/models/HypixelGuild')}
		 */
		const hypixelGuild = this.client.hypixelGuilds.getFromArray(flags) ?? message.author.player?.guild;

		if (!hypixelGuild) return message.reply('unable to find your guild.');

		const command = `g log ${args.join(' ')}`;
		const data = await hypixelGuild.chatBridge.minecraft.command({
			command,
		});

		return message.reply(
			new MessageEmbed()
				.setColor(this.config.get('EMBED_BLUE'))
				.setTitle(`/${command}`)
				.setDescription(`\`\`\`\n${data}\`\`\``)
				.setTimestamp(),
		);
	}
};
