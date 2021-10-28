import { cache } from '.';
import { MARO_KEY } from '../constants';
import { MaroClient } from '../structures/MaroClient';
import { getMainProfile, seconds } from '../functions';
import { hypixel, SKYBLOCK_PROFILE_TTL } from './hypixel';
import { FetchError } from '../structures/errors/FetchError';
import type { MaroPlayerData } from '../structures/MaroClient';


export const maro = new MaroClient({
	timeout: seconds(20),
	retries: 1,
	cache: {
		get(key) {
			return cache.get(`${MARO_KEY}:${key}`);
		},
		set(key, value) {
			return cache.set(`${MARO_KEY}:${key}`, value, SKYBLOCK_PROFILE_TTL);
		},
	},
	async fetchPlayerData(uuid) {
		const profile = getMainProfile(
			await hypixel.skyblock.profiles.uuid(uuid),
			uuid,
		);

		if (!profile) throw new FetchError('MaroAPIError', { statusText: `${uuid} has no SkyBlock profiles` });

		const playerData: MaroPlayerData = profile.members[uuid];
		playerData.banking = profile.banking;

		return playerData;
	},
});
