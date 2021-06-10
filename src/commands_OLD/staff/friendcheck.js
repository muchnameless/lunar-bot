'use strict';

const { stripIndents } = require('common-tags');
const { EMBED_DESCRIPTION_MAX_CHARS } = require('../../constants/discord');
const { trim } = require('../../functions/util');
const hypixel = require('../../api/hypixel');
const mojang = require('../../api/mojang');
const Command = require('../../structures/commands/Command');
// const logger = require('../../functions/logger');


module.exports = class StopCommand extends Command {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [ 'friendscheck' ],
			description: 'checks which friends of the player are in the guild',
			args: 1,
			usage: '[`IGN`|`UUID`]',
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 */
	async run(message, args) { // eslint-disable-line no-unused-vars
		const { uuid, ign: IGN } = await mojang.ignOrUuid(args[0]);
		const friends = (await hypixel.friends.uuid(uuid)).map(x => (x.uuidSender === uuid ? x.uuidReceiver : x.uuidSender));

		return message.reply({
			embed: this.client.defaultEmbed
				.setTitle(`${IGN}'s friends in the guild`)
				.setDescription(stripIndents`\`\`\`
					${trim(
						this.client.players.cache
						.filter((_, minecraftUUID) => friends.includes(minecraftUUID))
						.map(({ ign }) => ign)
						.join('\n'),
						EMBED_DESCRIPTION_MAX_CHARS - 8, // 2 * (3 [```] + 1 [\n])
					)}
					\`\`\`
				`),
		});
	}
};
