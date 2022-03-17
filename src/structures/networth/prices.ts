import { sql } from '../database/sql';

export const prices = new Map<string, number>();
export const getPrice = (item: string) => prices.get(item) ?? 0;

// INIT
for (const { id, median } of await sql<[{ id: string; median: number }]>`
  SELECT id, median(history) from prices
`) {
	prices.set(id, median);
}
