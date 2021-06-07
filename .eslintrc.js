module.exports = {
	extends: 'eslint:recommended',
	env: {
		node: true,
		es6: true,
	},
	parser: '@babel/eslint-parser',
	parserOptions: {
		ecmaVersion: 2021,
		babelOptions: {
			configFile: './.babelrc',
		},
	},
	rules: {
		'array-bracket-spacing': [ 'error', 'always', { objectsInArrays: false }],
		'array-callback-return': 'error',
		'arrow-body-style': [ 'error', 'as-needed' ],
		'arrow-parens': [ 'error', 'as-needed', { requireForBlockBody: true }],
		'arrow-spacing': 'error',
		'brace-style': [ 'error', '1tbs', { allowSingleLine: true }],
		'camelcase': 'error',
		'class-methods-use-this': [ 'error', { exceptMethods: [ 'run', 'runInGame', '_run' ] }],
		'comma-dangle': [ 'error', 'always-multiline' ],
		'comma-spacing': [ 'error', { before: false, after: true }],
		'comma-style': 'error',
		'default-param-last': 'error',
		'dot-location': [ 'error', 'property' ],
		'dot-notation': 'error',
		'eol-last': [ 'error', 'always' ],
		'func-call-spacing': 'error',
		'guard-for-in': 'error',
		'handle-callback-err': 'off',
		'implicit-arrow-linebreak': [ 'error', 'beside' ],
		'indent': [ 'error', 'tab', { SwitchCase: 1, ignoredNodes: [ 'TemplateLiteral *' ] }],
		'key-spacing': 'error',
		'max-nested-callbacks': [ 'error', { max: 6 }],
		'max-statements-per-line': [ 'error', { max: 2 }],
		'new-cap': [ 'error', { capIsNewExceptionPattern: '^([a-zA-Z]+\\.)*[A-Z]+$' }],
		'newline-per-chained-call': [ 'error', { ignoreChainWithDepth: 2 }],
		'no-confusing-arrow': 'error',
		'no-console': 'off',
		'no-dupe-class-members': 'error',
		'no-duplicate-imports': 'error',
		'no-else-return': 'error',
		'no-empty-function': 'error',
		'no-floating-decimal': 'error',
		'no-iterator': 'error',
		'no-lonely-if': 'error',
		'no-mixed-operators': 'error',
		'no-multi-assign': 'off',
		'no-multiple-empty-lines': [ 'error', { max: 2, maxEOF: 1, maxBOF: 0 }],
		'no-multi-spaces': 'error',
		'no-new-wrappers': 'error',
		'no-param-reassign': [ 'error' ],
		'no-restricted-globals': [ 'error', 'isNaN', 'isFinite' ],
		'no-shadow': [ 'error', { allow: [ 'err', 'resolve', 'reject' ] }],
		'no-trailing-spaces': [ 'error' ],
		'no-unused-vars': [ 'error', { varsIgnorePattern: 'arguments', argsIgnorePattern: 'arguments' }],
		'no-useless-call': 'error',
		'no-useless-constructor': 'error',
		'no-useless-rename': 'error',
		'no-unneeded-ternary': [ 'error', { defaultAssignment: false }],
		'no-var': 'error',
		'no-whitespace-before-property': 'error',
		'nonblock-statement-body-position': [ 'error' ],
		'object-curly-spacing': [ 'error', 'always' ],
		'object-shorthand': [ 'error', 'always', { avoidExplicitReturnArrows: true }],
		'one-var': [ 'error', 'never' ],
		'operator-linebreak': [ 'error', 'before' ],
		'padded-blocks': [ 'error', 'never' ],
		'prefer-arrow-callback': [ 'error', { allowUnboundThis: false }],
		'prefer-const': 'error',
		'prefer-destructuring': 'error',
		'prefer-exponentiation-operator': 'error',
		'prefer-numeric-literals': 'error',
		'prefer-object-spread': 'error',
		'prefer-regex-literals': [ 'error', { disallowRedundantWrapping: true }],
		'prefer-spread': 'error',
		'prefer-template': 'error',
		'quotes': [ 'error', 'single' ],
		'radix': 'error',
		'semi': [ 'error', 'always' ],
		'space-before-blocks': 'error',
		'space-before-function-paren': [ 'error', { anonymous: 'never', named: 'never', asyncArrow: 'always' }],
		'space-in-parens': 'error',
		'space-infix-ops': 'error',
		'space-unary-ops': 'error',
		'spaced-comment': 'error',
		'template-curly-spacing': 'error',
		'yoda': 'error',
	},
};
