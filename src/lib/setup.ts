import { opendir } from 'node:fs/promises';
import { join } from 'node:path';
import { URL } from 'node:url';

const paths: string[] = [];

for await (const { name, parentPath } of await opendir(new URL('setup.d', import.meta.url))) {
	if (name.endsWith('.js')) paths.push(join(parentPath, name));
}

// eslint-disable-next-line @typescript-eslint/require-array-sort-compare
for (const path of paths.sort()) {
	await import(path);
}
