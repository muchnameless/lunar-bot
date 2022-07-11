interface Array<T> {
	/**
	 * Returns the value of the last element in the array where predicate is true, and undefined
	 * otherwise.
	 * @param predicate find calls predicate once for each element of the array, in ascending
	 * order, until it finds one where predicate returns true. If such an element is found, find
	 * immediately returns that element value. Otherwise, find returns undefined.
	 * @param thisArg If provided, it will be used as the this value for each invocation of
	 * predicate. If it is not provided, undefined is used instead.
	 */
	findLast<S extends T>(
		predicate: (this: void, value: T, index: number, obj: T[]) => value is S,
		thisArg?: any,
	): S | undefined;
	findLast(predicate: (value: T, index: number, obj: T[]) => unknown, thisArg?: any): T | undefined;

	/**
	 * Returns the index of the last element in the array where predicate is true, and -1
	 * otherwise.
	 * @param predicate find calls predicate once for each element of the array, in ascending
	 * order, until it finds one where predicate returns true. If such an element is found,
	 * findIndex immediately returns that element index. Otherwise, findIndex returns -1.
	 * @param thisArg If provided, it will be used as the this value for each invocation of
	 * predicate. If it is not provided, undefined is used instead.
	 */
	findLastIndex(predicate: (value: T, index: number, obj: T[]) => unknown, thisArg?: any): number;
}

interface ReadonlyArray<T> {
	/**
	 * Returns the value of the last element in the array where predicate is true, and undefined
	 * otherwise.
	 * @param predicate find calls predicate once for each element of the array, in ascending
	 * order, until it finds one where predicate returns true. If such an element is found, find
	 * immediately returns that element value. Otherwise, find returns undefined.
	 * @param thisArg If provided, it will be used as the this value for each invocation of
	 * predicate. If it is not provided, undefined is used instead.
	 */
	findLast<S extends T>(
		predicate: (this: void, value: T, index: number, obj: readonly T[]) => value is S,
		thisArg?: any,
	): S | undefined;
	findLast(predicate: (value: T, index: number, obj: readonly T[]) => unknown, thisArg?: any): T | undefined;

	/**
	 * Returns the index of the last element in the array where predicate is true, and -1
	 * otherwise.
	 * @param predicate find calls predicate once for each element of the array, in ascending
	 * order, until it finds one where predicate returns true. If such an element is found,
	 * findIndex immediately returns that element index. Otherwise, findIndex returns -1.
	 * @param thisArg If provided, it will be used as the this value for each invocation of
	 * predicate. If it is not provided, undefined is used instead.
	 */
	findLastIndex(predicate: (value: T, index: number, obj: readonly T[]) => unknown, thisArg?: any): number;
}
