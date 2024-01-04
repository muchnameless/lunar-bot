import { URL } from 'node:url';
import { opendir } from 'node:fs/promises';
import { join } from 'node:path';

const paths: string[] = [];

for await (const { name, path } of await opendir(new URL('setup.d', import.meta.url))) {
	if (name.endsWith('.js')) paths.push(join(path, name));
}

// eslint-disable-next-line @typescript-eslint/require-array-sort-compare
for (const path of paths.sort()) {
	await import(path);
}
