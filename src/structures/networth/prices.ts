import { db } from '../database';

export const prices = new Map<string, number>();
export const getPrice = (item: string) => prices.get(item) ?? 0;

// INIT
for (const { id, lowestBIN } of await db.SkyBlockAuction.findAll({ attributes: ['id', 'lowestBIN'], raw: true })) {
	prices.set(id, lowestBIN);
}

for (const { id, buyPrice } of await db.SkyBlockBazaar.findAll({ attributes: ['id', 'buyPrice'], raw: true })) {
	prices.set(id, buyPrice);
}
