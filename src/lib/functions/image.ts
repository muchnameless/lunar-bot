import { BUST_IMAGE_URL } from '#constants';

export const uuidToBustURL = (uuid: string) => `${BUST_IMAGE_URL}${uuid}` as const;
