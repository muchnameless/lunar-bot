import { Agent, setGlobalDispatcher } from 'undici';

setGlobalDispatcher(new Agent({ connect: { timeout: 30_000 } }));
