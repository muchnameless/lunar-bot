import { Collection } from 'discord.js';
import type { Job } from './Job';

export class JobManager {
	jobs = new Collection<string, Job>();

	add(job: Job) {
		this.jobs.set(job.name, job);
		job.start();
	}

	stop(shouldRestart?: boolean) {
		return Promise.all(this.jobs.map((job) => job.stop(shouldRestart)));
	}
}
