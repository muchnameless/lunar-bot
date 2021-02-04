'use strict';

const { oneLine, commaListsOr } = require('common-tags');
const { Player } = require('../../../database/models/index');
const { getHypixelClient } = require('../../functions/util');
const mojang = require('../../api/mojang');
const Command = require('../../structures/Command');
const logger = require('../../functions/logger');


module.exports = class MyCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'link your discord id to your current hypixel discord tag (guild members only)',
			args: true,
			usage: '[`IGN`]',
			cooldown: 5,
		});
	}

	async run(client, config, message, args, flags, rawArgs) {
		const { hypixelGuilds, players } = client;

		let ign = args[0].replace(/\W/g, ''); // filter out all non alphanumerical characters

		if (!ign.length) return message.reply(`\`${args[0]}\` is not a valid minecraft ign.`);

		let player = players.getByIGN(ign);

		if (player?.discordID === message.author.id) return message.reply('you are already linked with this discord account.');

		const ERROR_STRING = 'Try again in a few minutes if you believe this is an error.';
		const MINECRAFT_UUID = await mojang.getUUID(ign).catch(error => logger.error(`[VERIFY]: ign fetch: ${error.name}: ${error.message}`));

		if (!MINECRAFT_UUID) return message.reply(`unable to find the minecraft UUID of \`${ign}\`. ${ERROR_STRING}`);

		const hypixelGuild = await getHypixelClient(true).guild.player(MINECRAFT_UUID).catch(error => logger.error(`[VERIFY]: guild fetch: ${error.name}${error.code ? ` ${error.code}` : ''}: ${error.message}`));

		if (!hypixelGuild) return message.reply(`unable to find the hypixel guild of \`${ign}\`. ${ERROR_STRING}`);

		const { _id: GUILD_ID } = hypixelGuild;

		if (!hypixelGuilds.keyArray().includes(GUILD_ID)) return message.reply(commaListsOr`
			according to the hypixel API, \`${ign}\` is not in ${hypixelGuilds.map(hGuild => hGuild.name)}. ${ERROR_STRING}
		`);

		const hypixelPlayer = await getHypixelClient(true).player.uuid(MINECRAFT_UUID).catch(error => logger.error(`[VERIFY]: player fetch: ${error.name}${error.code ? ` ${error.code}` : ''}: ${error.message}`));

		if (!hypixelPlayer) return message.reply(`unable to find \`${ign}\` on hypixel. ${ERROR_STRING}`);

		const LINKED_DISCORD_TAG = hypixelPlayer.socialMedia?.links?.DISCORD;

		ign = hypixelPlayer.displayname;

		if (!LINKED_DISCORD_TAG) return message.reply(`no linked discord tag for \`${ign}\` on hypixel. ${ERROR_STRING}`);

		if (LINKED_DISCORD_TAG !== message.author.tag) return message.reply(oneLine`
			the linked discord tag \`${LINKED_DISCORD_TAG}\` for \`${ign}\` does not match yours: \`${message.author.tag}\`.
			Keep in mind that discord tags are case sensitive.
		`);

		try {
			player ??= await Player.findByPk(MINECRAFT_UUID) ?? await Player.create({
				minecraftUUID: MINECRAFT_UUID,
				ign,
			});
		} catch (error) {
			logger.error(`[VERIFY]: database: ${error.name}: ${error.message}`);
			return message.reply(`an error occurred while updating the guild player database. Contact <@${client.ownerID}>`);
		}

		player.guildID = GUILD_ID;

		const discordMember = message.member ?? await client.lgGuild?.members.fetch(message.author.id).catch(error => logger.error(`[VERIFY]: guild member fetch: ${error.name}: ${error.message}`)) ?? null;

		if (discordMember) {
			player.link(discordMember, 'verified with the bot');
		} else {
			player.discordID = message.author.id;
			player.inDiscord = false;
			player.save();
		}

		message.reply(`successfully linked your discord account to \`${ign}\`.`);
	}
};
