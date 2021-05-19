'use strict';

const { removeMcFormatting } = require('../../structures/chat_bridge/functions/util');
const Command = require('../../structures/commands/Command');
// const logger = require('../../functions/logger');


module.exports = class GuildListCommand extends Command {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [ 'guildlist', 'members', 'guildmembers' ],
			description: 'guild list',
			args: false,
			usage: '',
			cooldown: 1,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} rawArgs arguments and flags
	 * @param {import('../../structures/chat_bridge/managers/MinecraftChatManager').CommandOptions} commandOptions
	 */
	async _run(message, rawArgs, commandOptions) {
		/**
		 * @type {import('../../structures/database/models/HypixelGuild')}
		 */
		const hypixelGuild = this.client.hypixelGuilds.getFromArray(rawArgs) ?? message.author.player?.guild;

		if (!hypixelGuild) return message.reply('unable to find your guild.');

		const data = await hypixelGuild.chatBridge.minecraft.command({
			raw: true,
			...commandOptions,
		});

		return message.reply(this.client.defaultEmbed
			.setTitle(`/${commandOptions.command}`)
			.setDescription(
				`\`\`\`${
					data
						.map(msg => (msg.content.includes('●')
							? removeMcFormatting(
								msg.formattedContent
									.replace(/§r§c ●/g, ' 🔴')
									.replace(/§r§a ●/g, ' 🟢')
									.replace(/\[.+?\] /g, ''),
							)
							: msg.content),
						)
						.join('\n')
				}\`\`\``,
			),
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
		return this._run(message, rawArgs, { command: 'g list' });
	}
};
