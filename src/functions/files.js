'use strict';

const { promises: fs } = require('fs');
const { join, basename, extname } = require('path');


const self = module.exports = {

	/**
	 * searches the dirPath and subfolders for all .js-files that don't start with '~'
	 * @param {string} dirPath path to search in
	 * @param {string[]} arrayOfFiles accumulator
	 */
	async getAllJsFiles(dirPath, arrayOfFiles = []) {
		const files = await fs.readdir(dirPath);

		await Promise.all(files.map(async (file) => {
			if ((await fs.stat(join(dirPath, file))).isDirectory()) return self.getAllJsFiles(join(dirPath, file), arrayOfFiles);
			arrayOfFiles.push(join(dirPath, file));
		}));

		return arrayOfFiles.filter(file => !basename(file).startsWith('~') && extname(file) === '.js');
	},

	/**
	 * requires all files in the given directory
	 * @param {string} dirPath path of the files to require
	 * @param {any[]} args arguments to call the required files with
	 */
	async requireAll(dirPath, ...args) {
		const files = await self.getAllJsFiles(dirPath);

		if (args.length) {
			files.forEach(file => require(file)(...args));
		} else {
			files.forEach(file => require(file));
		}
	},

};
