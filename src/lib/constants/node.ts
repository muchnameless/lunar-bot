/**
 * https://nodejs.org/api/errors.html#nodejs-error-codes
 */
export const enum ErrorCode {
	ErrInvalidArgType = 'ERR_INVALID_ARG_TYPE',
	ErrParseArgsInvalidOptionValue = 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE',
	ErrParseArgsUnexpectedPositional = 'ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL',
	ErrParseArgsUnknownOption = 'ERR_PARSE_ARGS_UNKNOWN_OPTION',
}
