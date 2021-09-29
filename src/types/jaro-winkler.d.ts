declare function distance(s1: string, s2: string, options?: { caseSensitive: boolean }): number;

declare module 'jaro-winkler' {
	export = distance;
};
