export type AsyncIterableLike<T> =
  | AsyncIterable<T>
  | Iterable<T>
  | AsyncIterator<T>
  | Iterator<T>;
export async function* toAsyncIterable<T>(
  src: AsyncIterableLike<T>
): AsyncIterable<T> {
  if (Symbol.asyncIterator in (src as any)) {
    for await (const v of src as AsyncIterable<T>) yield v;
  } else {
    for (const v of src as Iterable<T>) yield v;
  }
}
