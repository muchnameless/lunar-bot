'use strict';

const { Util } = require('discord.js');
const { escapeIgn } = require('../../functions/util');
const SlashCommand = require('../../structures/commands/SlashCommand');
// const logger = require('../../functions/logger');


module.exports = class LinkIssuesCommand extends SlashCommand {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'list player db and discord role discrepancies',
			options: [],
			defaultPermission: true,
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) {
		const { players, hypixelGuilds, lgGuild } = this.client;

		if (!lgGuild) return interaction.reply({
			content: 'discord guild is currently unavailable',
			ephemeral: true,
		});

		await lgGuild.members.fetch();

		// discord members with wrong roles
		const embed = this.client.defaultEmbed;
		const GUILD_ROLE_ID = this.config.get('GUILD_ROLE_ID');
		const VERIFIED_ROLE_ID = this.config.get('VERIFIED_ROLE_ID');
		const guildRoleWithoutDbEntry = [];
		const missingVerifiedRole = [];

		for (const [ DISCORD_ID, member ] of lgGuild.members.cache) {
			if (players.cache.some(({ discordID }) => discordID === DISCORD_ID)) {
				if (!member.roles.cache.has(VERIFIED_ROLE_ID)) missingVerifiedRole.push(member);
				continue;
			}

			if (member.roles.cache.has(GUILD_ROLE_ID)) guildRoleWithoutDbEntry.push(member);
		}

		let issuesAmount = missingVerifiedRole.length + guildRoleWithoutDbEntry.length;

		if (missingVerifiedRole.length) {
			for (const value of Util.splitMessage(
				missingVerifiedRole
					.map(member => `${member} | ${Util.escapeMarkdown(`${member.displayName} | ${member.user.tag}`)}`)
					.join('\n'),
				{ char: '\n', maxLength: 1024 },
			)) {
				embed.addField(
					`**Missing Verified Role:** [display name | tag] (${missingVerifiedRole.length})`,
					value,
				);
			}
		} else {
			embed.addField(
				'**Missing Verified Role:**',
				'none',
			);
		}

		if (guildRoleWithoutDbEntry.length) {
			for (const value of Util.splitMessage(
				guildRoleWithoutDbEntry
					.map(member => `${member} | ${Util.escapeMarkdown(`${member.displayName} | ${member.user.tag}`)}`)
					.join('\n'),
				{ char: '\n', maxLength: 1024 },
			)) {
				embed.addField(
					`**Guild Role and no DB entry:** [display name | tag] (${guildRoleWithoutDbEntry.length})`,
					value,
				);
			}
		} else {
			embed.addField(
				'**Guild Role and no DB entry:**',
				'none',
			);
		}

		// guild players that are either unlinked or not in the discord server
		const unlinkedPlayers = [];
		const linkedAndNotInDiscord = [];

		for (const { name, players: guildPlayers } of hypixelGuilds.cache.values()) {
			// db entries with issues
			const [ unlinkedGuildPlayers, linkedPlayers ] = guildPlayers.partition(({ discordID }) => /\D/.test(discordID));
			const linkedAndNotInDiscordCurrentGuild = linkedPlayers.filter(({ inDiscord }) => !inDiscord);
			const UNLINKED_AMOUNT = unlinkedGuildPlayers.size;
			const LINKED_NOT_DISCORD_AMOUNT = linkedAndNotInDiscordCurrentGuild.size;

			issuesAmount += UNLINKED_AMOUNT + LINKED_NOT_DISCORD_AMOUNT;

			unlinkedPlayers.push({
				guildName: name,
				amount: UNLINKED_AMOUNT,
				values: UNLINKED_AMOUNT
					? Util.splitMessage(
						unlinkedGuildPlayers
							.map(({ ign, discordID }) => `${escapeIgn(ign)} | ${discordID ? Util.escapeMarkdown(discordID) : 'unknown tag'}`)
							.join('\n'),
						{ char: '\n', maxLength: 1024 },
					)
					: [ 'none' ],
			});

			linkedAndNotInDiscord.push({
				guildName: name,
				amount: LINKED_NOT_DISCORD_AMOUNT,
				values: LINKED_NOT_DISCORD_AMOUNT
					? Util.splitMessage(
						linkedAndNotInDiscordCurrentGuild
							.map(({ discordID, ign }) => `<@${discordID}> | ${escapeIgn(ign)}`)
							.join('\n'),
						{ char: '\n', maxLength: 1024 },
					)
					: [ 'none' ],
			});
		}

		for (const { guildName, amount, values } of unlinkedPlayers) for (const value of values) {
			embed.addField(
				`**Unlinked Players (${guildName}):**${amount ? ` [ign | tag] (${amount})` : ''}`,
				value,
			);
		}

		for (const { guildName, amount, values } of linkedAndNotInDiscord) for (const value of values) {
			embed.addField(
				`**Linked and not in Discord (${guildName}):**${amount ? ` (${amount})` : ''}`,
				value,
			);
		}

		embed.setTitle(`Link Issues${issuesAmount ? ` (${issuesAmount})` : ''}`);

		return interaction.reply({
			embeds: [
				embed,
			],
		});
	}
};
