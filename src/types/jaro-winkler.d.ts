declare module 'jaro-winkler' {
	export default function(s1: string, s2: string, options?: { caseSensitive?: boolean }): number;
}
