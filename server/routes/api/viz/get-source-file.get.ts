import { defineEventHandler, getQuery } from 'nitro/h3';
import { getFile } from './_store';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const sourceFileId = query.sourceFileId as string;

  if (!sourceFileId) {
    throw new Response('sourceFileId required', { status: 400 });
  }

  const file = getFile(sourceFileId);
  if (!file) {
    throw new Response('Source file not found', { status: 404 });
  }

  return { data: file };
});
