import { env, exit } from 'node:process';
import { parentPort } from 'node:worker_threads';
import Parser from 'rss-parser';
import postgres from 'postgres';
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
const sql = postgres(env.DATABASE_URL!, {
	types: {
		date: {
			to: 1_184,
			from: [1_082, 1_083, 1_114, 1_184],
			serialize: (date: Date) => date.toISOString(),
			parse: (isoString) => isoString,
		},
	},
});

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

const now = new Date();
const parsedItems = skyblockPatchnotes.map(({ guid, title, creator, link }) => ({
	guid: Number(guid),
	title,
	creator,
	link,
	createdAt: now,
	updatedAt: now,
}));

const LAST_GUID = JSON.parse(
	(
		await sql<[{ value: string }]>`
			SELECT value FROM "Config" WHERE key = 'HYPIXEL_FORUM_LAST_GUID'
		`
	)[0].value,
) as number;
const newPosts = parsedItems.filter(({ guid }) => guid > LAST_GUID);

await sql`
  INSERT INTO "SkyBlockPatchNotes" ${sql(
		parsedItems,
		'guid',
		'title',
		'creator',
		'link',
		'createdAt',
		'updatedAt',
	)} ON CONFLICT ("guid") DO UPDATE SET "title"=EXCLUDED."title","creator"=EXCLUDED."creator","link"=EXCLUDED."link","updatedAt"=EXCLUDED."updatedAt"
`;

if (parentPort) {
	if (newPosts.length) {
		parentPort.postMessage({
			op: JobType.HypixelForumLastGUIDUpdate,
			d: { HYPIXEL_FORUM_LAST_GUID: Math.max(...newPosts.map(({ guid }) => guid)) },
		});
	}

	await sql.end();
	parentPort.postMessage('done');
} else {
	await sql`
		UPDATE "Config" SET "value" = ${JSON.stringify(
			Math.max(...newPosts.map(({ guid }) => guid)),
		)} WHERE key = 'HYPIXEL_FORUM_LAST_GUID'
	`;

	await sql.end();
	exit(0);
}
