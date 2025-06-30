// src/utils.ts
/**
 * Any value the runtime can be _for-await-ed_.
 * (Plain Array, ReadableStream, AsyncGenerator, etc.)
 */
export type AsyncIterableLike<T> =
  | AsyncIterable<T>
  | Iterable<T>
  | AsyncIterator<T>
  | Iterator<T>;

/**
 * Normalise whatever comes in into a real `AsyncIterable`.
 * Handy when you accept both plain iterables _and_ async ones.
 */
export async function* toAsyncIterable<T>(
  src: AsyncIterableLike<T>
): AsyncIterable<T> {
  if (Symbol.asyncIterator in (src as any)) {
    for await (const v of src as AsyncIterable<T>) yield v;
  } else {
    for (const v of src as Iterable<T>) yield v;
  }
}
