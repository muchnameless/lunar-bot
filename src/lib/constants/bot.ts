/**
 * append a minecraft uuid to get a link of a rendered bust image of the player's skin
 */
export const BUST_IMAGE_URL = 'https://visage.surgeplay.com/bust/';

/**
 * RegExp string that does not match anything (would need *something* before the beginning of the string)
 */
export const NEVER_MATCHING_REGEXP = '.^';

/**
 * normal lowercase letters <> small latin capital letters
 */
/* eslint-disable id-length */
export const SMALL_LATIN_CAPITAL_LETTERS = {
	a: '\u1D00',
	b: '\u0299',
	c: '\u1D04',
	d: '\u1D05',
	e: '\u1D07',
	f: '\uA730',
	g: '\u0262',
	h: '\u029C',
	i: '\u026A',
	j: '\u1D0A',
	k: '\u1D0B',
	l: '\u029F',
	m: '\u1D0D',
	n: '\u0274',
	o: '\u1D0F',
	p: '\u1D18',
	q: '\uA7AF',
	r: '\u0280',
	s: '\uA731',
	t: '\u1D1B',
	u: '\u1D1C',
	v: '\u1D20',
	w: '\u1D21',
	// x: ''
	y: '\u028F',
	z: '\u1D22',
} as const;
/* eslint-enable id-length */
