// @ts-expect-error
import PostgresQueryGenerator from 'sequelize/lib/dialects/postgres/query-generator';

PostgresQueryGenerator.prototype.pgEnum = function (
	tableName: string,
	attr: string,
	dataType: Record<string, any>,
	options?: Record<string, any>,
) {
	const enumName = this.pgEnumName(tableName, attr, options);
	const values = dataType.values
		? `ENUM(${dataType.values.map((value: string) => this.escape(value)).join(', ')})`
		: /^ENUM\(.+\)/.exec(`${dataType}`)![0];

	let sql = `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_${tableName}_${attr}') THEN CREATE TYPE ${enumName} AS ${values}; END IF; END$$;`;

	if (options?.force) sql = `${this.pgEnumDrop(tableName, attr)}${sql}`;

	return sql;
};
