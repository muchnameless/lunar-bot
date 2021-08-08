'use strict';

const { Formatters, Util } = require('discord.js');
const { userMention } = require('@discordjs/builders');
const { escapeIgn } = require('../../functions/util');
const SlashCommand = require('../../structures/commands/SlashCommand');
// const logger = require('../../functions/logger');


module.exports = class LinkIssuesCommand extends SlashCommand {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'list player db and discord role discrepancies',
			options: [],
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) {
		// discord members with wrong roles
		const VERIFIED_ROLE_ID = this.config.get('VERIFIED_ROLE_ID');
		const GUILD_ROLE_ID = this.config.get('GUILD_ROLE_ID');
		const missingVerifiedRole = [];
		const guildRoleWithoutDbEntry = [];

		for (const [ DISCORD_ID, member ] of await this.client.fetchAllGuildMembers()) {
			if (this.client.players.cache.some(({ discordId }) => discordId === DISCORD_ID)) {
				if (!member.roles.cache.has(VERIFIED_ROLE_ID)) missingVerifiedRole.push(member);
				continue;
			}

			if (member.roles.cache.has(GUILD_ROLE_ID)) guildRoleWithoutDbEntry.push(member);
		}

		let issuesAmount = missingVerifiedRole.length + guildRoleWithoutDbEntry.length;

		const embed = this.client.defaultEmbed;

		if (missingVerifiedRole.length) {
			for (const value of Util.splitMessage(
				missingVerifiedRole
					.map(member => `${member} | ${Util.escapeMarkdown(`${member.displayName} | ${member.user.tag}`)}`)
					.join('\n'),
				{ char: '\n', maxLength: 1024 },
			)) {
				embed.addFields({
					name: `${Formatters.bold('Missing Verified Role:')} [display name | tag] (${missingVerifiedRole.length})`,
					value,
				});
			}
		} else {
			embed.addFields({
				name: Formatters.bold('Missing Verified Role:'),
				value: 'none',
			});
		}

		if (guildRoleWithoutDbEntry.length) {
			for (const value of Util.splitMessage(
				guildRoleWithoutDbEntry
					.map(member => `${member} | ${Util.escapeMarkdown(`${member.displayName} | ${member.user.tag}`)}`)
					.join('\n'),
				{ char: '\n', maxLength: 1024 },
			)) {
				embed.addFields({
					name: `${Formatters.bold('Guild Role and no DB entry:')} [display name | tag] (${guildRoleWithoutDbEntry.length})`,
					value,
				});
			}
		} else {
			embed.addFields({
				name: Formatters.bold('Guild Role and no DB entry:'),
				value: 'none',
			});
		}

		// guild players that are either unlinked or not in the discord server
		const unlinkedPlayers = [];
		const linkedAndNotInDiscord = [];

		for (const { name, players: guildPlayers } of this.client.hypixelGuilds.cache.values()) {
			// db entries with issues
			const [ unlinkedGuildPlayers, linkedPlayers ] = guildPlayers.partition(({ discordId }) => /\D/.test(discordId));
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
							.map(({ ign, discordId }) => `${escapeIgn(ign)} | ${discordId ? Util.escapeMarkdown(discordId) : 'unknown tag'}`)
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
							.map(({ discordId, ign }) => `${userMention(discordId)} | ${escapeIgn(ign)}`)
							.join('\n'),
						{ char: '\n', maxLength: 1024 },
					)
					: [ 'none' ],
			});
		}

		for (const { guildName, amount, values } of unlinkedPlayers) for (const value of values) {
			embed.addFields({
				name: `${Formatters.bold(`Unlinked Players (${guildName}):`)}${amount ? ` [ign | tag] (${amount})` : ''}`,
				value,
			});
		}

		for (const { guildName, amount, values } of linkedAndNotInDiscord) for (const value of values) {
			embed.addFields({
				name: `${Formatters.bold(`Linked and not in Discord (${guildName}):`)}${amount ? ` (${amount})` : ''}`,
				value,
			});
		}

		embed.setTitle(`Link Issues${issuesAmount ? ` (${issuesAmount})` : ''}`);

		return interaction.reply({
			embeds: [
				embed,
			],
		});
	}
};
