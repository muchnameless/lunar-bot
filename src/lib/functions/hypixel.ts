/**
 * parses MongoDB ObjectIds to the creation timestamp in seconds
 *
 * @param id
 */
export const parseSecondsFromObjectId = ({ _id }: { _id: string }) => Number.parseInt(_id.slice(0, 8), 16);
