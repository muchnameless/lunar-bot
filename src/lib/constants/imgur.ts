/**
 * 10 MB in Bytes, content-length header is in Bytes (website allows up to 20 MB, but API is capped at 10)
 * https://apidocs.imgur.com/#c85c9dfc-7487-4de2-9ecd-66f727cf3139
 */
export const MAX_IMAGE_UPLOAD_SIZE = 10 * 1e6;

/**
 * https://help.imgur.com/hc/en-us/articles/115000083326-What-files-can-I-upload-Is-there-a-size-limit-
 */
export const ALLOWED_EXTENSIONS_REGEX = /\.(?:jpe?g|a?png|gif|tiff)$/;

export const ALLOWED_MIMES_REGEX = /^image\/(?:jpe?g|a?png|gif|tiff)$/;
