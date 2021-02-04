'use strict';

const fs = require('fs');
const path = require('path');
const { MessageEmbed, SnowflakeUtil } = require('discord.js');
const logger = require('../functions/logger');


const self = module.exports = {

	// recursive directory file loading
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

	// write data in './log'
	logToFile: data => {
		fs.writeFile(
			path.join(__dirname, '..', '..', 'log_buffer', `${new Date().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}_${SnowflakeUtil.generate()}`),
			data,
			err => err && logger.info(err),
		);
	},

	// read all files from './log' and webhook log their parsed content
	postFileLogs: client => {
		const LOG_BUFFER_PATH = path.join(__dirname, '..', '..', 'log_buffer');
		const logBufferFiles = fs.readdirSync(LOG_BUFFER_PATH);

		if (!logBufferFiles) return;

		for (const file of logBufferFiles) {
			const FILE_PATH = path.join(LOG_BUFFER_PATH, file);

			client
				.log(...fs.readFileSync(FILE_PATH, 'utf8').split('\n').map(x => new MessageEmbed(JSON.parse(x))))
				.then(() => fs.unlinkSync(FILE_PATH));
		}
	},

};
