import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { getSourceFile } from '@/lib/api';
import { appStore } from '@/lib/store';

export const Route = createFileRoute('/viz/$sourceFileId')({
  component: VizRoute,
});

function VizRoute() {
  const { sourceFileId } = Route.useParams();
  const { data, error } = useQuery({
    queryKey: ['sourceFile', sourceFileId],
    queryFn: () => getSourceFile(sourceFileId),
  });

  useEffect(() => {
    if (data) {
      appStore.trigger.sourceFileChanged({ code: data.text, id: data.id, name: data.name });
    }
  }, [data]);

  if (error) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <div className="text-center">
          <h2 className="mb-2 text-xl font-semibold text-muted-foreground">
            Not found
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            This shared sketch could not be loaded.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Create a new sketch
          </a>
        </div>
      </div>
    );
  }

  return <AppLayout />;
}
