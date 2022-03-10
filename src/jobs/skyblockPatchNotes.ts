import { exit } from 'node:process';
import { parentPort } from 'node:worker_threads';
import Parser from 'rss-parser';
import { db } from '../structures/database';
import { JobType } from '.';

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

const parser = new Parser<HypixelForumResponse>();

// fetch RSS feeds
const [{ items: skyblockPatchnotes }, { items: newsAndAnnouncements }] = await Promise.all([
	parser.parseURL('https://hypixel.net/forums/skyblock-patch-notes.158/index.rss'),
	parser.parseURL('https://hypixel.net/forums/news-and-announcements.4/index.rss'),
]);

// add skyblock related posts from news and announcements
for (const item of newsAndAnnouncements) {
	if (item.title.toLowerCase().includes('skyblock') || item['content:encoded'].toLowerCase().includes('skyblock')) {
		skyblockPatchnotes.push(item);
	}
}

const parsedItems = skyblockPatchnotes.map(({ guid, title, creator, link }) => ({
	guid: Number(guid),
	title,
	creator,
	link,
}));
const LAST_GUID = JSON.parse(
	(await db.Config.findOne({ where: { key: 'HYPIXEL_FORUM_LAST_GUID' } }))!.value!,
) as number;
const newPosts = parsedItems.filter(({ guid }) => guid > LAST_GUID);

if (newPosts.length && parentPort) {
	parentPort.postMessage({
		op: JobType.HypixelForumLastGUIDUpdate,
		d: { HYPIXEL_FORUM_LAST_GUID: Math.max(...newPosts.map(({ guid }) => guid)) },
	});
}

await db.SkyBlockPatchNote.bulkCreate(parsedItems, {
	updateOnDuplicate: ['title', 'creator', 'link', 'updatedAt'],
});

if (parentPort) {
	parentPort.postMessage('done');
} else {
	exit(0);
}
