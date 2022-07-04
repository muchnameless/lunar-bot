declare module 'node:util' {
	interface ParseArgsOption {
		type: 'boolean' | 'string';
		multiple?: boolean;
		short?: string;
	}

	type ParseArgsOptions = Record<string, ParseArgsOption>;

	interface ParseArgsResult {
		values: Record<string, string | boolean>;
		positionals: string[];
	}

	function parseArgs(config: {
		args?: string[];
		options?: ParseArgsOptions;
		strict?: boolean;
		allowPositionals?: boolean;
	}): ParseArgsResult;
}
