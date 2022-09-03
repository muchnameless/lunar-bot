/**
 * whether the error is an AbortError
 *
 * @param error
 */
export const isAbortError = (error: unknown): error is Error => error instanceof Error && error.name === 'AbortError';
