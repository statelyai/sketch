import { defineEventHandler, readBody } from 'nitro/h3';
import { createFile } from './_store';

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as {
    text?: string;
    name?: string;
    forkFromId?: string;
    format?: string;
    originalText?: string;
  };
  const { text, name, forkFromId, format, originalText } = body ?? {};

  if (!text || !name) {
    throw new Response('text and name required', { status: 400 });
  }

  const file = createFile(text, name, forkFromId, format, originalText);
  return { data: file };
});
