import { Collection } from 'discord.js';
import type { Job } from './Job.js';

export class JobManager {
	public readonly jobs = new Collection<string, Job>();

	public add(job: Job) {
		this.jobs.set(job.name, job);
		job.start();
	}

	public async stop(shouldRestart?: boolean) {
		return Promise.all(this.jobs.map(async (job) => job.stop(shouldRestart)));
	}
}
