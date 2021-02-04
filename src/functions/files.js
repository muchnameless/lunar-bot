'use strict';

const fs = require('fs');
const path = require('path');


const self = module.exports = {

	/**
	 * searches the dirPath and subfolders for all .js-files that don't start with '~'
	 * @param {string} dirPath path to search in
	 * @param {string[]} arrayOfFiles accumulator
	 */
	getAllJsFiles: (dirPath, arrayOfFiles = []) => {
		const files = fs.readdirSync(dirPath);

		files.forEach(file => {
			if (fs.statSync(path.join(dirPath, file)).isDirectory()) return arrayOfFiles = self.getAllJsFiles(path.join(dirPath, file), arrayOfFiles);
			arrayOfFiles.push(path.join(dirPath, file));
		});

		return arrayOfFiles.filter(file => !path.basename(file).startsWith('~') && path.extname(file) === '.js');
	},

	/**
	 * requires all files in the given directory
	 * @param {string} dirPath path of the files to require
	 * @param {any[]} args arguments to call the required files with
	 */
	requireAll: (dirPath, ...args) => {
		const files = self.getAllJsFiles(dirPath);

		if (args.length) {
			files.forEach(file => require(file)(...args));
		} else {
			files.forEach(file => require(file));
		}
	},

};
