export async function up(sql) {
	await sql.unsafe(`
		ALTER TABLE skyblock_items
		ADD COLUMN gemstone_slots JSONB[];
	`);
}
