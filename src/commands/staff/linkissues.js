'use strict';

const { MessageEmbed, Util } = require('discord.js');
const { escapeIgn } = require('../../functions/util');
const Command = require('../../structures/commands/Command');
// const logger = require('../../functions/logger');


module.exports = class LinkIssuesCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'issues' ],
			description: 'list player db and discord role discrepancies',
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
	async run(message, args, flags, rawArgs) { // eslint-disable-line no-unused-vars
		const { players, hypixelGuilds, lgGuild } = this.client;

		if (!lgGuild) return message.reply('discord guild is currently unavailable.');
		if (lgGuild.members.cache.size !== lgGuild.memberCount) await lgGuild.members.fetch();

		// discord members with wrong roles
		const embed = new MessageEmbed()
			.setColor(this.config.get('EMBED_BLUE'))
			.setTimestamp();
		const GUILD_ROLE_ID = this.config.get('GUILD_ROLE_ID');
		const VERIFIED_ROLE_ID = this.config.get('VERIFIED_ROLE_ID');
		const guildRoleWithoutDbEntry = [];
		const missingVerifiedRole = [];

		lgGuild.members.cache.forEach((member, id) => {
			if (players.cache.some(({ discordID }) => discordID === id)) return !member.roles.cache.has(VERIFIED_ROLE_ID) && missingVerifiedRole.push(member);
			if (member.roles.cache.has(GUILD_ROLE_ID)) return guildRoleWithoutDbEntry.push(member);
		});

		let issuesAmount = missingVerifiedRole.length + guildRoleWithoutDbEntry.length;

		Util
			.splitMessage(
				missingVerifiedRole.map(member => `${member} | ${Util.escapeMarkdown(`${member.displayName} | ${member.user.tag}`)}`).join('\n') || 'none',
				{ char: '\n', maxLength: 1024 },
			)
			.forEach((string) => {
				embed.addField(
					`**Missing Verified Role:**${missingVerifiedRole.length ? ` [display name | tag] (${missingVerifiedRole.length})` : ''}`,
					string,
				);
			});

		Util
			.splitMessage(
				guildRoleWithoutDbEntry.map(member => `${member} | ${Util.escapeMarkdown(`${member.displayName} | ${member.user.tag}`)}`).join('\n') || 'none',
				{ char: '\n', maxLength: 1024 },
			)
			.forEach((string) => {
				embed.addField(
					`**Guild Role and no DB entry:**${guildRoleWithoutDbEntry.length ? ` [display name | tag] (${guildRoleWithoutDbEntry.length})` : ''}`,
					string,
				);
			});

		// guild players that are either unlinked or not in the discord server
		const unlinkedPlayers = [];
		const linkedAndNotInDiscord = [];

		hypixelGuilds.cache.forEach((hypixelGuild) => {
			// db entries with issues
			const [ unlinkedGuildPlayers, linkedPlayers ] = hypixelGuild.players.partition(({ discordID }) => /\D/.test(discordID));
			const linkedAndNotInDiscordCurrentGuild = linkedPlayers.filter(({ inDiscord }) => !inDiscord);

			issuesAmount += unlinkedGuildPlayers.size + linkedAndNotInDiscordCurrentGuild.size;

			unlinkedPlayers.push({
				guildName: hypixelGuild.name,
				amount: unlinkedGuildPlayers.size,
				values: Util.splitMessage(
					unlinkedGuildPlayers
						.map(({ ign, discordID }) => `${escapeIgn(ign)} | ${discordID ? Util.escapeMarkdown(discordID) : 'unknown tag'}`)
						.join('\n') || 'none',
					{ char: '\n', maxLength: 1024 },
				),
			});

			linkedAndNotInDiscord.push({
				guildName: hypixelGuild.name,
				amount: linkedAndNotInDiscordCurrentGuild.size,
				values: Util.splitMessage(
					linkedAndNotInDiscordCurrentGuild
						.map(({ discordID, ign }) => `<@${discordID}> | ${escapeIgn(ign)}`)
						.join('\n') || 'none',
					{ char: '\n', maxLength: 1024 },
				),
			});
		});

		unlinkedPlayers.forEach(({ guildName, amount, values }) => {
			values.forEach((value) => {
				embed.addField(
					`**Unlinked Players (${guildName}):**${amount ? ` [ign | tag] (${amount})` : ''}`,
					value,
				);
			});
		});

		linkedAndNotInDiscord.forEach(({ guildName, amount, values }) => {
			values.forEach((value) => {
				embed.addField(
					`**Linked and not in Discord (${guildName}):**${amount ? ` (${amount})` : ''}`,
					value,
				);
			});
		});

		message.reply(embed
			.setTitle(`Link Issues${issuesAmount ? ` (${issuesAmount})` : ''}`),
		);
	}
};
