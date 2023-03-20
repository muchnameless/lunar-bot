/**
 * multiple calls to this method will result in only one call and will resolve with the result of it
 */
export function noConcurrency<This, Args extends any[], Return>(
	target: (this: This, ...args: Args) => Promise<Return>,
	context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Promise<Return>>,
) {
	const methodName = String(context.name);
	const promiseName = Symbol(`singleCall:${methodName}Promise`);

	context.addInitializer(function init(this: any) {
		this[promiseName] = null;
	});

	async function replacementMethod(
		this: This & { [promiseName]: Promise<Return> | null },
		...args: Args
	): Promise<Return> {
		if (this[promiseName]) return this[promiseName];

		try {
			return await (this[promiseName] = target.call(this, ...args));
		} finally {
			this[promiseName] = null;
		}
	}

	return replacementMethod;
}
