'use strict';

const { stripIndents, oneLineCommaListsOr } = require('common-tags');
const { checkIfDiscordTag, getHypixelClient } = require('../../functions/util');
const { findMemberByTag } = require('../../functions/database');
const { Player } = require('../../../database/models/index');
const logger = require('../../functions/logger');
const mojang = require('../../api/mojang');


module.exports = {
	// aliases: [ '' ],
	description: 'link a discord user to a minecraft ign',
	args: true,
	usage: '[`IGN`] [`discord id`|`discord tag`|`@mention`]',
	cooldown: 1,
	execute: async (message, args, flags, rawArgs) => {
		const { client } = message;
		const { players, hypixelGuilds, config } = client;

		let player;

		// try to find the player to link
		for (const arg of args) {
			let minecraftUUID;

			// try to find player in players-collection
			player = players.getByIGN(arg);

			// player with the ign found
			if (player) {
				if (/\W/.test(arg)) break; // non alpha-numerical-char -> no minecraft ign

				// try to fetch the minecraft-uuid of that ign, in case players.getByIGN() found a (wrong) close ign that is already in guild via autocorrection
				minecraftUUID = await mojang.getUUID(arg).catch(error => logger.error(`[LINK]: mojang with '${arg}': ${error.name}: ${error.message}`));

				if (!minecraftUUID || minecraftUUID === player.minecraftUUID) break; // continue with player from players.getByIGN()

			// unknown player
			} else {
				if (/\W/.test(arg)) continue; // non alpha-numerical-char -> no minecraft ign

				// try to fetch additional info about the ign
				minecraftUUID = await mojang.getUUID(arg).catch(error => logger.error(`[LINK]: mojang with '${arg}': ${error.name}: ${error.message}`));

				if (!minecraftUUID) continue;
			}

			const hypixelGuild = await getHypixelClient(true).guild.player(minecraftUUID).catch(error => logger.error(`[LINK]: guild fetch: ${error.name}${error.code ? ` ${error.code}` : ''}: ${error.message}`));

			if (!hypixelGuild || !hypixelGuilds.keyArray().includes(hypixelGuild._id)) continue;

			// try to find player in the db
			player = await Player.findByPk(minecraftUUID);

			if (player) {
				player.guildID = hypixelGuild._id;
				player.save();
				break;
			}

			// create new db entry
			const IGN = await mojang.getName(minecraftUUID).catch(error => logger.error(`[LINK]: mojang with '${arg}': ${error.name}: ${error.message}`)) ?? 'unknown ign';

			player = await Player
				.create({
					minecraftUUID,
					ign: IGN,
					guildID: hypixelGuild._id,
				})
				.catch(error => logger.error(`[LINK]: ${error.name}: ${error.message}`));

			if (!player) return message.reply(stripIndents`
				error while creating new db entry for ${IGN} (${minecraftUUID}).
				Wait for the next automatic database update (check ${client.loggingChannel ?? '#lunar-logs'})
			`);

			break;
		}

		// no player to link found
		if (!player) return message.reply(stripIndents`
			${oneLineCommaListsOr`${args.map(arg => `\`${arg}\``)}`} does not contain a known IGN.
			Make sure to provide the full ign if the player database is not already updated (check ${client.loggingChannel ?? '#lunar-logs'})
		`);

		// try to find the discord account to link the player to
		const DISCORD_ID = message.mentions.users.size
			? message.mentions.users.first().id
			: await (async () => {
				for (const tag of rawArgs.filter(arg => checkIfDiscordTag(arg))) {
					const res = await findMemberByTag(client, tag);
					if (res) return res.id;
				}

				// try to fetch a discord user from all integer only args as IDs to determine if one arg is a discord user ID
				for (const number of args.filter(arg => /^\d+$/.test(arg))) {
					const res = await client.users.fetch(number).catch(() => null);
					if (res) return res.id;
				}
			})();

		// no discord account to link found
		if (!DISCORD_ID) return message.reply('either provide the user\'s discord id, tag or @mention them.');

		// player already linked
		if (/^\d+$/.test(player.discordID)) {
			const linkedUser = await client.users.fetch(player.discordID).catch(error => logger.error(`[LINK]: error fetching already linked user: ${error.name}: ${error.message}`));

			if (player.discordID === DISCORD_ID) return message.reply(
				`\`${player.ign}\` is already linked to ${linkedUser ?? `\`${player.discordID}\``}.`,
				{ allowedMentions: { parse: [] } },
			);

			if (!flags.some(flag => [ 'f', 'force' ].includes(flag))) {
				const ANSWER = await message.awaitReply(
					stripIndents`
						\`${player.ign}\` is already linked to ${linkedUser ?? `\`${player.discordID}\``}. Overwrite this?
						Make sure to provide the full ign if the player database is not already updated (check ${client.loggingChannel ?? '#lunar-logs'})
					`,
					30,
					{ allowedMentions: { parse: [] } },
				);

				if (!config.getArray('REPLY_CONFIRMATION').includes(ANSWER?.toLowerCase())) return message.reply('the command has been cancelled.');
			}

			if (!(await player.unlink(`unlinked by ${message.author.tag}`)) && linkedUser) {
				await message
					.reply(
						`unable to update roles and nickname for the currently linked member ${linkedUser}.`,
						{ allowedMentions: { parse: [] } },
					)
					.then(replyMessage => replyMessage.replyMessageID = null);
			}
		}

		// link the player
		player.discordID = DISCORD_ID;

		// try to find the linked users member data
		const discordMember = message.mentions.members?.size
			? message.mentions.members.first()
			: await client.lgGuild?.members.fetch(DISCORD_ID).catch(error => logger.error(`[LINK]: error fetching member to link: ${error.name}: ${error.message}`));

		// no discord member for the user to link found
		if (!discordMember) {
			player.save();
			return message.reply(`\`${player.ign}\` linked to \`${DISCORD_ID}\` but could not be found on the Lunar Guard discord server.`);
		}

		// user to link is in discord -> update roles
		player.link(discordMember, `linked by ${message.author.tag}`);

		let reply = `\`${player.ign}\` linked to ${discordMember}`;

		if (!discordMember.roles.cache.has(config.get('VERIFIED_ROLE_ID')))
			reply += ` (missing ${client.lgGuild?.roles.cache.get(config.get('VERIFIED_ROLE_ID'))?.name ?? config.get('VERIFIED_ROLE_ID')} role)`;

		return message.reply(
			`${reply}.`,
			{ allowedMentions: { parse: [] } },
		);
	},
};
