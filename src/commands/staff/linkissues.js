'use strict';

const { Util } = require('discord.js');
const { escapeIgn } = require('../../functions/util');
const Command = require('../../structures/commands/Command');
// const logger = require('../../functions/logger');


module.exports = class LinkIssuesCommand extends Command {
	constructor(data, options) {
		super(data, options ?? {
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
		await lgGuild.members.fetch();

		// discord members with wrong roles
		const embed = this.client.defaultEmbed;
		const GUILD_ROLE_ID = this.config.get('GUILD_ROLE_ID');
		const VERIFIED_ROLE_ID = this.config.get('VERIFIED_ROLE_ID');
		const guildRoleWithoutDbEntry = [];
		const missingVerifiedRole = [];

		for (const [ id, member ] of lgGuild.members.cache) {
			if (players.cache.some(({ discordID }) => discordID === id)) {
				!member.roles.cache.has(VERIFIED_ROLE_ID) && missingVerifiedRole.push(member);
				continue;
			}

			if (member.roles.cache.has(GUILD_ROLE_ID)) {
				guildRoleWithoutDbEntry.push(member);
				continue;
			}
		}

		let issuesAmount = missingVerifiedRole.length + guildRoleWithoutDbEntry.length;

		for (const value of Util.splitMessage(
			missingVerifiedRole.map(member => `${member} | ${Util.escapeMarkdown(`${member.displayName} | ${member.user.tag}`)}`).join('\n') || 'none',
			{ char: '\n', maxLength: 1024 },
		)) {
			embed.addField(
				`**Missing Verified Role:**${missingVerifiedRole.length ? ` [display name | tag] (${missingVerifiedRole.length})` : ''}`,
				value,
			);
		}

		for (const value of Util.splitMessage(
			guildRoleWithoutDbEntry.map(member => `${member} | ${Util.escapeMarkdown(`${member.displayName} | ${member.user.tag}`)}`).join('\n') || 'none',
			{ char: '\n', maxLength: 1024 },
		)) {
			embed.addField(
				`**Guild Role and no DB entry:**${guildRoleWithoutDbEntry.length ? ` [display name | tag] (${guildRoleWithoutDbEntry.length})` : ''}`,
				value,
			);
		}

		// guild players that are either unlinked or not in the discord server
		const unlinkedPlayers = [];
		const linkedAndNotInDiscord = [];

		for (const hypixelGuild of hypixelGuilds.cache.values()) {
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
		}

		for (const { guildName, amount, values } of unlinkedPlayers) {
			for (const value of values) {
				embed.addField(
					`**Unlinked Players (${guildName}):**${amount ? ` [ign | tag] (${amount})` : ''}`,
					value,
				);
			}
		}

		for (const { guildName, amount, values } of linkedAndNotInDiscord) {
			for (const value of values) {
				embed.addField(
					`**Linked and not in Discord (${guildName}):**${amount ? ` (${amount})` : ''}`,
					value,
				);
			}
		}

		message.reply(embed
			.setTitle(`Link Issues${issuesAmount ? ` (${issuesAmount})` : ''}`),
		);
	}
};
