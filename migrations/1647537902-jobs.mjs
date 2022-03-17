export async function up(sql) {
	await sql.unsafe(`
		CREATE OR REPLACE FUNCTION median(numeric[])
			RETURNS numeric AS
		$$
			SELECT AVG(val)
			FROM (
				SELECT val
				FROM unnest($1) val
				ORDER BY 1
				LIMIT  2 - MOD(array_upper($1, 1), 2)
				OFFSET CEIL(array_upper($1, 1) / 2.0) - 1
			) sub;
		$$
		LANGUAGE 'sql' IMMUTABLE;
	`);

	await sql.unsafe(`
		ALTER TABLE "SkyBlockAuctions"
		RENAME TO prices;
	`);
	await sql.unsafe(`
		ALTER TABLE prices
		RENAME COLUMN "lowestBINHistory" to "history";
	`);
	await sql.unsafe(`
		ALTER TABLE prices
		DROP COLUMN "lowestBIN";
	`);

	await sql.unsafe(`DROP TABLE "SkyBlockBazaars";`);
}
