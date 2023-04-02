import { env } from 'node:process';
import { RESTEvents, type RestEvents } from 'discord.js';
import { logger } from '#logger';
import { RESTEvent } from '#structures/events/RESTEvent.js';

export default class extends RESTEvent {
	public override readonly name = RESTEvents.HandlerSweep;

	public override readonly enabled = env.NODE_ENV === 'development';

	/**
	 * event listener callback
	 *
	 * @param sweptHandlers
	 */
	public override run(sweptHandlers: RestEvents[RESTEvents.HandlerSweep][0]) {
		logger.debug(
			{
				sweptHandlers: sweptHandlers.map(
					// @ts-expect-error manager does not exist on IHandler
					({ manager, ...data }) => data,
				),
			},
			'[REST HANDLER SWEEP]',
		);
	}
}
