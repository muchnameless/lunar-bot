import { isMainThread, parentPort } from 'node:worker_threads';
import { inspect } from 'node:util';
import { pino } from 'pino';
import { JobType } from './jobs';

type LogArguments = [Record<string, unknown> | Error, string];

export const logger = isMainThread
	? pino({
			level: 'trace',
			base: undefined,
	  })
	: {
			// eslint-disable-next-line @typescript-eslint/no-empty-function
			silent: (() => {}) as pino.LogFn,
			trace: ((...args: LogArguments) =>
				parentPort!.postMessage({ op: JobType.LogMessage, d: { lvl: 'trace', args } })) as pino.LogFn,
			debug: ((...args: LogArguments) =>
				parentPort!.postMessage({ op: JobType.LogMessage, d: { lvl: 'debug', args } })) as pino.LogFn,
			info: ((...args: LogArguments) =>
				parentPort!.postMessage({ op: JobType.LogMessage, d: { lvl: 'info', args } })) as pino.LogFn,
			warn: ((...args: LogArguments) =>
				parentPort!.postMessage({ op: JobType.LogMessage, d: { lvl: 'warn', args } })) as pino.LogFn,
			error: ((...args: LogArguments) =>
				parentPort!.postMessage({
					op: JobType.LogMessage,
					d: { lvl: 'error', args: args.map((x) => (x instanceof Error ? inspect(x) : x)) },
				})) as pino.LogFn,
			fatal: ((...args: LogArguments) =>
				parentPort!.postMessage({
					op: JobType.LogMessage,
					d: { lvl: 'fatal', args: args.map((x) => (x instanceof Error ? inspect(x) : x)) },
				})) as pino.LogFn,
	  };
