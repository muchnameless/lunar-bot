export async function up(sql) {
	await sql.unsafe(`
		ALTER TABLE skyblock_items (
			ADD COLUMN category TEXT,
			RENAME COLUMN conversion TO dungeon_conversion
		)
	`);
}
