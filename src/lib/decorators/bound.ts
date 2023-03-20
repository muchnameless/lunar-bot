export function bound<This, Args extends any[], Return>(
	_target: (this: This, ...args: Args) => Return,
	context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>,
) {
	const methodName = String(context.name);

	if (context.private) {
		throw new TypeError(`'bound' cannot decorate private properties like ${methodName}`);
	}

	context.addInitializer(function init(this: any) {
		this[methodName] = this[methodName].bind(this);
	});
}
