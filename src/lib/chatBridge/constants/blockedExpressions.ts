/**
 * chat filter
 */
export const BLOCKED_EXPRESSIONS_REGEXP = new RegExp(
	[
		/**
		 * hypixel
		 */
		/\b(?:e|cyber)?s[3e]x+\b/,
		/\bse(?:k|gg)s\b/,
		/\bsemen\b/,
		/nutte(?:[dr]| *sac)/,
		/no *nut *november/,
		/\bc *u+ *m+(?:ming?|s(?:hots?|lut)?)?\b/,
		/\bslu+t+\b/,
		/sluts/,
		/\bth[0o]t\b/,
		/\bj(?:ac|er)k +of/,
		/\bm+a+s+t+(?:u+|e+)r+b+a+t+e+s?\b/,
		/\bmast[eu]rbati(?:ng|on)?\b/,
		/\bfap(?:ping)?\b/,
		/suck +(?:me +off|(?:yo)?ur (?:dad|mom))/,
		/\bb[0o]n[3e]r\b/,
		/c *o *c *k(?:s?\b|sucker)/,
		/\bp *[3e] *n *[1i] *[5s]\b/,
		/d *(?:i+|1+) *c+ *k/,
		/schl[0o]ng/,
		/test[1i]cle/,
		/\bscrotum\b/,
		/chode/,
		/tit(?:tie)?s/,
		/\btitty\b/,
		/\bvagina\b/,
		/pus{2,}y/,
		/\bclit\b/,
		/\bdildo\b/,
		/\borgy\b/,
		/orgasm/,
		/cuck+o+l+d/,
		/\ba+n+a+l+\b/,
		/nude/,
		/\bh[3e]ntai/,
		/p[0o]rn/,
		/\bpimp\b/,
		/pl+a+y+b+o+y/,
		/onlyfans/,
		/\bxhamster(?:.{2,})?\b/,
		/\bp+[3e]+d+o+(?:p+h+i+l+(?:e+s*|i+a+)|s+)?\b/,
		/\bloli\b/,
		/\br+[@a]+p(?:e+d*|i+n+g+)\b/,
		/\bmolesting\b/,

		/\bdrugs\b/,
		/cocain/,
		/\bmeth(?:amphetamines?)?\b/,
		/\bketamin\b/,
		/\bh+e+r+o+i+n+\b/,
		/\bk+W*y+W*s+\b/,
		/sho{2,}t+ +(?:y *o *)?u *r *s *e *l *f+\b/,
		/kill.*self/,
		/hang +(?:yo)?urself/,
		/hope +you +die/,
		/\bsuicide\b/,
		/die +(?:tmr|in +(?:a +hole|hell))/,
		/school *shoot/,
		/\bterrorist\b/,
		/(?:are|get|is) +cancer/,
		/get +aids/,

		/(?:you'?r+e?|ur|(?:yo)?ur +(?:dad|m[ou]m)|\bs?he +is) +gay+\b/,
		/(?:yo)?ur +(?:dad|m[ou]m) +lesbian/,
		/ur +gae/,
		/\bfag\b/,
		/fag.+t/,
		/f[4@]g/,
		/\bfgt/,
		/hurensohn/,
		/autist/,
		/de(?:generate|ranged)/,
		/brain *dead/,
		/retar[dt] *ed/,
		/\bdownie\b/,

		/\bslaves?\b/,
		/n[1i](?:b{2,}|g{2,})(?:a|er)/,
		/\bn[1i]g+a*\b/,
		/ingger/,
		/\bchink\b/,
		/\bch[aio]ng\b/,
		/\bco{2,}n+s*\b/,
		/\bhurri\b/,
		/\bjap\b/,
		/\bkike\b/,
		/\bk{3,}\b/,
		/ku +klux +klan/,
		/kkr/,
		/\bcok\b/,
		/kanker/,
		/\bswastika/,
		/holocaust/,
		/n[4a]z[1i]/,

		/**
		 * custom
		 */
		/[⠁-⣿]/, // braille code (used in some spam messages)
		/\be+z+\b/, // hypixel replaces messages containing "ez" with a set of other "funny" messages
	]
		.map(({ source }) => source)
		.join('|'),
	'i',
);
