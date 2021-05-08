'use strict';

const FormData = require('form-data');
const fetch = require('node-fetch');
// const logger = require('./logger');

/**
 * @typedef {object} ImgurResponse
 * @property {string} id
 * @property {string} deletehash
 * @property {} account_id null
 * @property {} account_url null
 * @property {} ad_type null
 * @property {} ad_url null
 * @property {} title null
 * @property {} description null
 * @property {string} name
 * @property {string} type
 * @property {number} width
 * @property {number} height
 * @property {number} size
 * @property {number} views
 * @property {} section null
 * @property {} vote null
 * @property {number} bandwidth
 * @property {boolean} animated
 * @property {boolean} favorite
 * @property {boolean} in_gallery
 * @property {boolean} in_most_viral
 * @property {boolean} has_sound
 * @property {boolean} is_ad
 * @property {?boolean} nsfw
 * @property {string} link
 * @property {} tags []
 * @property {number} datetime
 * @property {string} mp4
 * @property {string} hls
 */

const URL = 'https://api.imgur.com/3/upload';
const headers = { 'Authorization': `Client-ID ${process.env.IMGUR_CLIENT_ID}` };


/**
 * @param {string} url
 * @returns {Promise<string>}
 */
module.exports.urlToImgurLink = async (url) => {
	const form = new FormData();

	form.append('image', url);
	form.append('type', 'url');

	const res = await fetch(URL, {
		method: 'POST',
		body: form,
		headers,
	});

	if (res.status !== 200) {
		throw new Error(res);
	}

	return (await res.json()).data.link;
};
