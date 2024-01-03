import { URL } from 'node:url';
import { findFilesRecursivelyStringEndsWith } from '@sapphire/node-utilities';

const paths: string[] = [];

for await (const path of findFilesRecursivelyStringEndsWith(new URL('setup.d', import.meta.url), '.js')) {
	paths.push(path);
}

// eslint-disable-next-line @typescript-eslint/require-array-sort-compare
for (const path of paths.sort()) {
	await import(path);
}
