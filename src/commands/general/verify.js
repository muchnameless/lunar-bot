'use strict';

const { oneLine, commaListsOr } = require('common-tags');
const hypixel = require('../../api/hypixel');
const mojang = require('../../api/mojang');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class VerifyCommand extends Command {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [],
			description: 'link your discord id to your current hypixel discord tag (guild members only)',
			args: true,
			usage: '[`IGN`]',
			cooldown: 5,
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
		try {
			message.channel.startTyping(10);

			const { hypixelGuilds, players } = this.client;
			const IGN_INPUT = args[0].replace(/\W/g, ''); // filter out all non alphanumerical characters

			if (!IGN_INPUT.length) return message.reply(`\`${args[0]}\` is not a valid minecraft ign.`);

			let player = players.getByIGN(IGN_INPUT);

			/**
			 * @type {import('../../structures/database/models/Player')}
			 */
			const playerLinkedToID = message.author.player;

			// already linked to this discord user
			if (player?.minecraftUUID === playerLinkedToID?.minecraftUUID) return message.reply('you are already linked with this discord account.');

			const ERROR_STRING = 'Try again in a few minutes if you believe this is an error.';
			const { uuid, ign = IGN_INPUT } = await mojang.ign(IGN_INPUT).catch(error => logger.error('[VERIFY]: ign fetch', error) ?? {});

			// non existing ign
			if (!uuid) return message.reply(`unable to find the minecraft UUID of \`${ign}\`. ${ERROR_STRING}`);

			const hypixelGuild = await hypixel.guild.player(uuid).catch(error => logger.error('[VERIFY]: guild fetch', error));

			// not in a guild
			if (!hypixelGuild) return message.reply(`unable to find the hypixel guild of \`${ign}\`. ${ERROR_STRING}`);

			const { _id: GUILD_ID } = hypixelGuild;

			// not in one of the guilds that the bot manages
			if (!hypixelGuilds.cache.keyArray().includes(GUILD_ID)) return message.reply(commaListsOr`
				according to the hypixel API, \`${ign}\` is not in ${hypixelGuilds.cache.map(({ name }) => name)}. ${ERROR_STRING}
			`);

			const hypixelPlayer = await hypixel.player.uuid(uuid).catch(error => logger.error('[VERIFY]: player fetch', error));

			// hypixel player api error
			if (!hypixelPlayer) return message.reply(`unable to find \`${ign}\` on hypixel. ${ERROR_STRING}`);

			const LINKED_DISCORD_TAG = hypixelPlayer.socialMedia?.links?.DISCORD;

			// no linked discord tag
			if (!LINKED_DISCORD_TAG) return message.reply(`no linked discord tag for \`${ign}\` on hypixel. ${ERROR_STRING}`);

			// linked discord tag doesn't match author's tag
			if (LINKED_DISCORD_TAG !== message.author.tag) return message.reply(oneLine`
				the linked discord tag \`${LINKED_DISCORD_TAG}\` for \`${ign}\` does not match yours: \`${message.author.tag}\`.
				Keep in mind that discord tags are case sensitive.
			`);

			// already linked to another discord user
			if (playerLinkedToID) {
				if (!this.force(flags)) {
					const ANSWER = await message.awaitReply(
						`your discord account is already linked to \`${playerLinkedToID.ign}\`. Overwrite this?`,
						30,
					);

					if (!this.config.getArray('REPLY_CONFIRMATION').includes(ANSWER?.toLowerCase())) return message.reply('the command has been cancelled.');
				}

				await playerLinkedToID.unlink(`linked account switched to ${message.author.tag}`);
			}

			// create new db entry if non exitent
			try {
				if (!player) [ player ] = await players.model.findOrCreate({
					where: { minecraftUUID: uuid },
					defaults: { ign },
				});
			} catch (error) {
				logger.error('[VERIFY]: database', error);
				return message.reply(`an error occurred while updating the guild player database. Contact ${await this.client.ownerInfo}`);
			}

			player.guildID = GUILD_ID;

			const discordMember = message.member ?? await this.client.lgGuild?.members.fetch(message.author.id).catch(error => logger.error('[VERIFY]: guild member fetch', error)) ?? null;

			await player.link(discordMember ?? message.author.id, 'verified with the bot');

			message.reply(`successfully linked your discord account to \`${ign}\`.`);
		} finally {
			message.channel.stopTyping(true);
		}
	}
};
