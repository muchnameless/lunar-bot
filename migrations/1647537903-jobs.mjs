export async function up(sql) {
	await sql.unsafe(`
		ALTER TABLE prices
		ADD COLUMN index SMALLINT DEFAULT 2 NOT NULL;
	`);
}
