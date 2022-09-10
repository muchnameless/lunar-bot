/**
 * whether the error is an AbortError
 *
 * @param error
 */
export const isAbortError = (error: unknown): error is Error => error instanceof Error && error.name === 'AbortError';

/**
 * stringifies the error and removes html code from it
 *
 * @param error
 */
export const formatError = (error: unknown) => `${error}`.replace(/(?:\.? Response: )?<html>.+<\/html>/s, '');
