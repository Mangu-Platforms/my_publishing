/**
 * DEPRECATED (Task 1.7).
 *
 * This module used to render the stub reader ("Reading interface coming
 * soon"). MANGU ships no on-site EPUB reader, so the stub was removed. The
 * file is kept only as a re-export so no import can dangle; delete it in the
 * follow-up cleanup that also removes the now-unused `saveReadingProgress`
 * server action in ./actions.ts.
 */
export { ReadingUnavailable as default } from './ReadingUnavailable';
