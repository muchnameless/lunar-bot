export const toUpperCase = <T extends string>(string: T) => string.toUpperCase() as Uppercase<T>;
export const toLowerCase = <T extends string>(string: T) => string.toLowerCase() as Lowercase<T>;

/**
 * Promise<T> -> T
 */
export type Awaited<T> = T extends PromiseLike<infer U> ? Awaited<U> : T;

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

export type Merge<M, N> = N & Omit<M, Extract<keyof M, keyof N>>;

export type ModifyDeep<A extends AnyObject, B extends DeepPartialAny<A>> = A extends AnyObject
	? Omit<B, keyof A>
	: A & {
			[K in keyof A]: B[K] extends never ? A[K] : B[K] extends AnyObject ? ModifyDeep<A[K], B[K]> : B[K];
	  };

/**
 * Makes each property optional and turns each leaf property into any, allowing for type overrides by narrowing any.
 */
export type DeepPartialAny<T> = {
	[P in keyof T]?: T[P] extends AnyObject ? DeepPartialAny<T[P]> : any;
};

type AnyObject = Record<string, any>;
