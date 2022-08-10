import type { ErrorCode } from '#constants';

export declare class ErrorWithCode extends Error {
	code: ErrorCode;
}
