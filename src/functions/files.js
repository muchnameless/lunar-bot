import { readdir } from 'fs/promises';
import { join, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from './index.js';


/**
 * searches the file url and subfolders for all .js-files that don't start with '~'
 * @param {string | URL} url file url to search in
 * @param {string[]} arrayOfFiles accumulator
 */
export async function getAllJsFiles(url, arrayOfFiles = []) {
	try {
		const files = await readdir(url, { withFileTypes: true });

		// for (const file of files) {
		// 	const newPath = join(fileURLToPath(path), file.name);

		// 	if (file.isDirectory()) return getAllJsFiles(newPath, arrayOfFiles);

		// 	arrayOfFiles.push(newPath);
		// }

		await Promise.all(files.map(async (file) => {
			const newPath = join(typeof url === 'string' ? url : fileURLToPath(url), file.name);

			if (file.isDirectory()) return getAllJsFiles(newPath, arrayOfFiles);

			arrayOfFiles.push(newPath);
		}));

		// logger.debug({ arrayOfFiles })

		return arrayOfFiles.filter(file => !basename(file).startsWith('~') && extname(file) === '.js');
	} catch (error) {
		logger.error(error);
	}
}
