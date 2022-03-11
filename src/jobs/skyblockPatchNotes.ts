import { env, exit } from 'node:process';
import { parentPort } from 'node:worker_threads';
import { Sequelize } from 'sequelize';
import Parser from 'rss-parser';
import { Config } from '../structures/database/models/Config';
import { SkyBlockPatchNote } from '../structures/database/models/SkyBlockPatchNote';
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

const sequelize = new Sequelize(env.DATABASE_URL!, {
	logging: false,
});
const config = Config.initialise(sequelize);
const LAST_GUID = JSON.parse((await config.findOne({ where: { key: 'HYPIXEL_FORUM_LAST_GUID' } }))!.value!) as number;
const newPosts = parsedItems.filter(({ guid }) => guid > LAST_GUID);

const skyBlockPatchNote = SkyBlockPatchNote.initialise(sequelize);

await skyBlockPatchNote.bulkCreate(parsedItems, {
	updateOnDuplicate: ['title', 'creator', 'link', 'updatedAt'],
});

if (parentPort) {
	if (newPosts.length) {
		parentPort.postMessage({
			op: JobType.HypixelForumLastGUIDUpdate,
			d: { HYPIXEL_FORUM_LAST_GUID: Math.max(...newPosts.map(({ guid }) => guid)) },
		});
	}
	parentPort.postMessage('done');
} else {
	await config.update(
		{ value: JSON.stringify(Math.max(...newPosts.map(({ guid }) => guid))) },
		{ where: { key: 'HYPIXEL_FORUM_LAST_GUID' } },
	);
	exit(0);
}
