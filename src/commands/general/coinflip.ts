import { SlashCommandBuilder } from '@discordjs/builders';
import { promisify } from 'node:util';
import { randomBytes as cryptoRandomBytes } from 'node:crypto';
import { InteractionUtil } from '../../util';
import { DualCommand } from '../../structures/commands/DualCommand';
import type { CommandInteraction } from 'discord.js';
import type { HypixelUserMessage } from '../../structures/chat_bridge/HypixelMessage';
import type { CommandContext } from '../../structures/commands/BaseCommand';


export default class CoinFlipCommand extends DualCommand {
	/**
	 * async random bytes generator to not block the event loop
	 */
	asyncRandomBytes = promisify(cryptoRandomBytes);

	constructor(context: CommandContext) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('heads, tails or ???'),
			cooldown: 0,
		}, {
			aliases: [ 'cf', 'flip' ],
			args: false,
			usage: '',
		});
	}

	/**
	 * async secure random number generator
	 * modern js port of https://www.npmjs.com/package/random-number-csprng
	 * @param minimum
	 * @param maximum
	 */
	randomNumber(minimum: number, maximum: number) {
		const range = maximum - minimum;

		let bitsNeeded = 0;
		let bytesNeeded = 0;
		let mask = 1;
		let range_ = range;

		while (range_ > 0) {
			if (bitsNeeded % 8 === 0) {
				bytesNeeded += 1;
			}

			bitsNeeded += 1;
			mask = (mask << 1) | 1; /* 0x00001111 -> 0x00011111 */
			range_ = range_ >>> 1; /* 0x01000000 -> 0x00100000 */
		}

		return this.#secureRandomNumber(range, minimum, bytesNeeded, mask);
	}
	/**
	 * random number loop
	 * @param range
	 * @param minimum
	 * @param bytesNeeded
	 * @param mask
	 */
	async #secureRandomNumber(range: number, minimum: number, bytesNeeded: number, mask: number): Promise<number> {
		const randomBytes = await this.asyncRandomBytes(bytesNeeded);

		let randomValue = 0;

		for (let i = 0; i < bytesNeeded; i++) {
			randomValue |= randomBytes[i] << 8 * i;
		}

		randomValue = randomValue & mask;

		if (randomValue <= range) {
			return minimum + randomValue;
		}

		return this.#secureRandomNumber(range, minimum, bytesNeeded, mask);
	}

	/**
	 * coinflip result
	 */
	async #generateReply() {
		const randomNumber = await this.randomNumber(0, 1_000);

		if (randomNumber === 0) return 'edge'; // 0.1 %
		if (randomNumber <= 500) return 'heads'; // 49.95 %
		return 'tails'; // 49.95 %
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async runSlash(interaction: CommandInteraction) {
		return InteractionUtil.reply(interaction, await this.#generateReply());
	}

	/**
	 * execute the command
	 * @param hypixelMessage
	 */
	override async runMinecraft(hypixelMessage: HypixelUserMessage) {
		return hypixelMessage.reply(await this.#generateReply());
	}
}
