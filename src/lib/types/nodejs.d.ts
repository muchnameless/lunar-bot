declare namespace NodeJS {
	interface ProcessEnv {
		DISCORD_CLIENT_ID: string;
		DISCORD_TOKEN: string;
		HYPIXEL_KEY: string;
		IMGUR_CLIENT_ID: string;
		MINECRAFT_ACCOUNT_TYPE: string;
		MINECRAFT_PASSWORD: string;
		MINECRAFT_USERNAME: string;
		NODE_ENV: string;
		NODE_OPTIONS: string;
		OWNER: string;
		PGDATABASE: string;
		PGHOST: string;
		PGPASSWORD: string;
		PGUSERNAME: string;
		REDIS_URI: string;
	}
}

interface Array<T> {
	/**
	 * Determines whether an array includes a certain element, returning true or false as appropriate.
	 *
	 * @param searchElement The element to search for.
	 * @param fromIndex The position in this array at which to begin searching for searchElement.
	 */
	includes(searchElement: unknown, fromIndex?: 0): searchElement is T;
	includes(searchElement: unknown, fromIndex: number): boolean;
}

interface ReadonlyArray<T> {
	/**
	 * Determines whether an array includes a certain element, returning true or false as appropriate.
	 *
	 * @param searchElement The element to search for.
	 * @param fromIndex The position in this array at which to begin searching for searchElement.
	 */
	includes(searchElement: unknown, fromIndex?: 0): searchElement is T;
	includes(searchElement: unknown, fromIndex: number): boolean;
}

interface Set<T> {
	/**
	 * @returns a boolean indicating whether an element with the specified value exists in the Set or not.
	 */
	has(value: unknown): value is T;
}

interface ReadonlySet<T> {
	/**
	 * @returns a boolean indicating whether an element with the specified value exists in the Set or not.
	 */
	has(value: unknown): value is T;
}

interface JSON {
	/**
	 * Converts a JavaScript Object Notation (JSON) string into an object.
	 *
	 * @param text A valid JSON string.
	 * @param reviver A function that transforms the results. This function is called for each member of the object.
	 * If a member contains nested objects, the nested objects are transformed before the parent object is.
	 */
	parse(text: string, reviver?: (this: any, key: string, value: any) => any): unknown;
}

interface ArrayConstructor {
	isArray(arg: any): arg is unknown[];
}

// TODO: remove if added to @types/node
interface AbortSignal {
	/**
	 * If {@link aborted} is true, throws {@link reason}.
	 *
	 * @since v17.3.0
	 */
	throwIfAborted(): void;
}
