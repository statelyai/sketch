import { useRef, useCallback, useEffect } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorState } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Play } from 'lucide-react';
import type { CodeFormat } from '@/lib/machine';
import type { SimEvent } from '@/lib/store';

interface CodePanelProps {
  code: string;
  onCodeChange: (code: string) => void;
  error: string | null;
  dark?: boolean;
  format?: CodeFormat;
  simEvents: SimEvent[];
  simValue: string | null;
  isSimulating: boolean;
  onStartSim: () => void;
  activeTab: string | number;
  onActiveTabChange: (tab: string | number) => void;
}

const FORMAT_LABELS: Record<CodeFormat, string> = {
  xstate: 'XState',
  sketch: 'Sketch',
  json: 'JSON',
  yaml: 'YAML',
  mermaid: 'Mermaid',
};

export function CodePanel({
  code,
  onCodeChange,
  error,
  dark,
  format,
  simEvents,
  simValue,
  isSimulating,
  onStartSim,
  activeTab,
  onActiveTabChange,
}: CodePanelProps) {
  const viewRef = useRef<EditorView | null>(null);
  const codeRef = useRef(code);
  codeRef.current = code;

  const handleCommit = useCallback(() => {
    if (viewRef.current) {
      const currentCode = viewRef.current.state.doc.toString();
      if (currentCode !== codeRef.current) {
        onCodeChange(currentCode);
      }
    }
  }, [onCodeChange]);

  // Sync editor content when code prop changes externally (e.g. example selection)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const editorContent = view.state.doc.toString();
    if (editorContent !== code) {
      view.dispatch({
        changes: { from: 0, to: editorContent.length, insert: code },
      });
    }
  }, [code]);

  const editorRefCallback = useCallback(
    (node: HTMLDivElement | null) => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }

      if (!node) return;

      const extensions = [
        basicSetup,
        ...(format === 'xstate' || format === 'json'
          ? [javascript({ typescript: format === 'xstate' })]
          : []),
        ...(dark ? [oneDark] : []),
        EditorView.theme({
          '&': {
            height: '100%',
            fontSize: '13px',
            backgroundColor: 'transparent',
          },
          '.cm-scroller': {
            overflow: 'auto',
            fontFamily:
              'source-code-pro, Menlo, Monaco, Consolas, "Courier New", monospace',
          },
          '.cm-content': {
            padding: '8px 0',
          },
          '.cm-gutters': {
            backgroundColor: 'transparent',
            borderRight: 'none',
          },
          '.cm-activeLineGutter': {
            backgroundColor: 'transparent',
          },
        }),
        keymap.of([
          {
            key: 'Mod-s',
            run: () => {
              handleCommit();
              return true;
            },
          },
        ]),
      ];

      const state = EditorState.create({
        doc: codeRef.current,
        extensions,
      });

      viewRef.current = new EditorView({
        state,
        parent: node,
      });
    },
    [handleCommit, dark, format],
  );

  return (
    <Tabs
      value={activeTab}
      onValueChange={onActiveTabChange}
      data-testid="code-panel"
      className="flex h-full flex-col overflow-hidden border-l border-border bg-card"
    >
      <TabsList variant="line" className="w-full shrink-0 border-b border-border px-2">
        <TabsTrigger value="code">Code</TabsTrigger>
        <TabsTrigger value="simulation">Simulation</TabsTrigger>
        {format && (
          <span data-testid="format-badge" className="ml-auto self-center rounded bg-muted px-1.5 py-0.5 text-[0.625rem] font-medium text-muted-foreground">
            {FORMAT_LABELS[format]}
          </span>
        )}
      </TabsList>

      <TabsContent value="code" className="flex min-h-0 flex-1 flex-col">
        {error && (
          <div data-testid="error-banner" className="max-h-24 shrink-0 overflow-auto whitespace-pre-wrap border-b border-border bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
            {error}
          </div>
        )}

        <div
          data-testid="code-editor"
          className="min-h-0 flex-1 overflow-hidden [&_.cm-editor]:h-full"
          ref={editorRefCallback}
        />

        <div className="flex h-11 shrink-0 items-center border-t border-border px-3">
          <button
            type="button"
            data-testid="update-button"
            onClick={handleCommit}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            Update
            <kbd className="rounded bg-primary-foreground/20 px-1 py-0.5 font-mono text-[0.625rem] leading-none">
              ⌘S
            </kbd>
          </button>
        </div>
      </TabsContent>

      <TabsContent value="simulation" className="min-h-0 flex-1 overflow-auto">
        <div className="flex min-h-full flex-col">
          <div className="border-b border-border px-3 py-2">
            <h3 className="text-xs font-medium text-foreground">Event History</h3>
          </div>
          {!isSimulating ? (
            <div className="flex flex-1 items-center justify-center px-6 text-center">
              <div>
                <button
                  type="button"
                  onClick={onStartSim}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  aria-label="Start simulation from panel"
                >
                  <Play size={14} />
                  Start simulation
                </button>
              </div>
            </div>
          ) : simEvents.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-6 text-center">
              <div>
                <p className="text-sm font-medium text-foreground">
                  No simulation events yet
                </p>
                <p className="mt-1 text-[0.75rem] text-muted-foreground">
                  Start simulation and trigger transitions to inspect the event stream.
                </p>
              </div>
            </div>
          ) : (
            <div data-testid="simulation-event-list" className="flex flex-col gap-2 p-3">
              {simEvents.map((simEvent, index) => (
                <div
                  key={`${simEvent.timestamp}-${index}`}
                  className="rounded-md border border-border bg-background px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-foreground">
                      {simEvent.event.type}
                    </span>
                    <span className="text-[0.625rem] text-muted-foreground">
                      {new Date(simEvent.timestamp).toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="mt-1 text-[0.6875rem] text-muted-foreground">
                    value:{' '}
                    <code className="font-mono text-[0.6875rem] text-foreground">
                      {simValue ?? 'null'}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
