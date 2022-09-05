/**
 * 20 MB in Bytes, content-length header is in Bytes
 */
export const MAX_IMAGE_UPLOAD_SIZE = 20 * 1e6;

/**
 * https://help.imgur.com/hc/en-us/articles/115000083326-What-files-can-I-upload-Is-there-a-size-limit-
 */
export const ALLOWED_EXTENSIONS_REGEX = /\.(?:jpe?g|a?png|gif|tiff)$/;

export const ALLOWED_MIMES_REGEX = /^image\/(?:jpe?g|a?png|gif|tiff)$/;
