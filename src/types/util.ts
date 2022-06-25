/* eslint-disable @typescript-eslint/no-explicit-any */

type Entries<T> = {
	[K in keyof T]: [K, T[K]];
}[keyof T][];

export const keys = <T extends object>(o: T) => Object.keys(o) as (keyof T)[];
export const values = <T extends object>(o: T) => Object.values(o) as T[keyof T][];
export const entries = <T extends object>(obj: T) => Object.entries(obj) as Entries<T>;
export const toUpperCase = <T extends string>(s: T) => s.toUpperCase() as Uppercase<T>;
export const toLowerCase = <T extends string>(s: T) => s.toLowerCase() as Lowercase<T>;

/**
 * Promise<T> -> T
 */
export type Awaited<T> = T extends PromiseLike<infer U> ? Awaited<U> : T;

/**
 * Type helper for making certain fields of an object optional. This is helpful
 * for creating the `CreationAttributes` from your `Attributes` for a Model.
 */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * true -> A, false -> B, boolean -> A | B
 */
export type If<T extends boolean, A, B = null> = T extends true ? A : T extends false ? B : A | B;

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

export type Merge<M, N> = Omit<M, Extract<keyof M, keyof N>> & N;

export type OverrideProps<M, N> = { [P in keyof M]: P extends keyof N ? N[P] : M[P] };

export type ModifyDeep<A extends AnyObject, B extends DeepPartialAny<A>> = {
	[K in keyof A]: B[K] extends never ? A[K] : B[K] extends AnyObject ? ModifyDeep<A[K], B[K]> : B[K];
} & (A extends AnyObject ? Omit<B, keyof A> : A);

/**
 * Makes each property optional and turns each leaf property into any, allowing for type overrides by narrowing any.
 */
export type DeepPartialAny<T> = {
	[P in keyof T]?: T[P] extends AnyObject ? DeepPartialAny<T[P]> : any;
};

type AnyObject = Record<string, any>;
