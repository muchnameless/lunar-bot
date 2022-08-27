/**
 * 20 MB in Bytes, content-length header is in Bytes
 */
export const MAX_IMAGE_UPLOAD_SIZE = 20 * 1e6;

/**
 * https://help.imgur.com/hc/en-us/articles/115000083326-What-files-can-I-upload-Is-there-a-size-limit-
 */
const DOTLESS_ALLOWED_EXTENSIONS = ['jpeg', 'png', 'gif', 'apng', 'tiff'] as const;

export const ALLOWED_EXTENSIONS = DOTLESS_ALLOWED_EXTENSIONS.map((ext) => `.${ext}` as const);

export const ALLOWED_MIMES = new Set(DOTLESS_ALLOWED_EXTENSIONS.map((ext) => `image/${ext}` as const));
