import Parser from 'rss-parser';
import { CronJob } from 'cron';
import { logger } from '../../../functions';
import { ModelManager } from './ModelManager';
import type { SkyBlockPatchNote } from '../models/SkyBlockPatchNote';

interface HypixelForumResponseItem {
	creator: string;
	title: string;
	link: string;
	pubDate: string;
	author: string;
	'content:encoded': string;
	'content:encodedSnippet': string;
	'dc:creator': string;
	guid: `${bigint}`;
	categories: { _: string; $: { domain: string } }[];
	isoDate: string;
}

interface HypixelForumResponse {
	items: HypixelForumResponseItem[];
	feedUrl: string;
	paginationLinks: {
		self: string;
	};
	title: string;
	description: string;
	pubDate: string;
	generator: string;
	link: string;
	lastBuildDate: string;
}

export class SkyBlockPatchNoteManager extends ModelManager<SkyBlockPatchNote> {
	private parser = new Parser<HypixelForumResponse>();

	// eslint-disable-next-line require-await, @typescript-eslint/no-unused-vars
	override async loadCache(condition?: FindOptions<Attributes<SkyBlockPatchNote>>) {
		return this;
	}

	/**
	 * fetch forum posts from hypixel's rss feed
	 */
	private async _fetchRSSFeeds() {
		try {
			// fetch RSS feeds
			const [{ items: skyblockPatchnotes }, { items: newsAndAnnouncements }] = await Promise.all([
				this.parser.parseURL('https://hypixel.net/forums/skyblock-patch-notes.158/index.rss'),
				this.parser.parseURL('https://hypixel.net/forums/news-and-announcements.4/index.rss'),
			]);

			// add skyblock related posts from news and announcements
			for (const item of newsAndAnnouncements) {
				if (
					item.title.toLowerCase().includes('skyblock') ||
					item['content:encoded'].toLowerCase().includes('skyblock')
				) {
					skyblockPatchnotes.push(item);
				}
			}

			const parsedItems = skyblockPatchnotes.map(({ guid, title, creator, link }) => ({
				guid: Number(guid),
				title,
				creator,
				link,
			}));
			const LAST_GUID = this.client.config.get('HYPIXEL_FORUM_LAST_GUID');
			const newPosts = parsedItems.filter(({ guid }) => guid > LAST_GUID);

			if (newPosts.length) {
				this.client.config.set('HYPIXEL_FORUM_LAST_GUID', Math.max(...newPosts.map(({ guid }) => guid)));
			}

			await this.model.bulkCreate(parsedItems, {
				updateOnDuplicate: ['title', 'creator', 'link', 'updatedAt'],
			});
		} catch (error) {
			logger.error(error, '[RSS]');
		}
	}

	/**
	 * register cron jobs
	 */
	override schedule() {
		this.client.cronJobs.schedule(
			`${this.constructor.name}:fetchRSSFeeds`,
			new CronJob({ cronTime: '0 0/10 * * * *', timeZone: 'GMT', onTick: () => this._fetchRSSFeeds() }),
		);

		return this;
	}
}
