import postgres from 'postgres';

export const sql = postgres({
	types: {
		date: {
			to: 1_184,
			from: [1_082, 1_083, 1_114, 1_184],
			serialize: (date: Date) => date.toISOString(),
			parse: (isoString) => isoString,
		},
		numeric: {
			// This conversion is identical to the `number` conversion in types.js line 11
			to: 0,
			from: [1_700],
			serialize: (x: number) => x.toString(),
			parse: (x: string) => Number.parseFloat(x),
		},
	},
});
