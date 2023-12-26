import { isMainThread, parentPort } from 'node:worker_threads';
import { pino, stdSerializers } from 'pino';
import { JobType } from '#root/jobs/index.js';

type LogArguments = Parameters<pino.LogFn>;

/* eslint-disable id-length */
export const logger = isMainThread
	? pino({
			level: 'trace',
			base: undefined,
	  })
	: {
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
					d: { lvl: 'error', args: args.map((x) => stdSerializers.err(x)) },
				})) as pino.LogFn,
			fatal: ((...args: LogArguments) =>
				parentPort!.postMessage({
					op: JobType.LogMessage,
					d: { lvl: 'fatal', args: args.map((x) => stdSerializers.err(x)) },
				})) as pino.LogFn,
	  };
