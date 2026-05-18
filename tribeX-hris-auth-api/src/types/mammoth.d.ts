declare module 'mammoth' {
  interface Result {
    value: string;
    messages: unknown[];
  }
  function extractRawText(input: { buffer: Buffer } | { path: string }): Promise<Result>;
}
