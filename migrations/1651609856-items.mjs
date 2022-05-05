export async function up(sql) {
	await sql.unsafe(`
		CREATE TABLE skyblock_items (
			id TEXT PRIMARY KEY,
			conversion JSONB,
			stars JSONB[]
		)
	`);
}
