/**
 * changes a property to non enumerable
 */
export function nonEnumerable<This, Value>(value: unknown, context: ClassFieldDecoratorContext<This, Value>) {
	context.addInitializer(function init() {
		Object.defineProperty(this, context.name, { value, enumerable: false });
	});
}
