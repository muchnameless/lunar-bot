export async function up(sql) {
	await sql.unsafe(`
		ALTER TABLE skyblock_items
		ADD COLUMN soulbound BOOLEAN NOT NULL DEFAULT FALSE;
		
		ALTER TABLE skyblock_items
		ADD COLUMN npc_sell_price NUMERIC CHECK (npc_sell_price >= 0);
	`);
}
