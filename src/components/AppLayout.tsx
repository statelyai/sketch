import {
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
} from 'react';
import { useSelector } from '@xstate/store-react';
import type {
  GroupImperativeHandle,
  PanelImperativeHandle,
} from 'react-resizable-panels';
import { MachineViz } from '@/components/MachineViz';
import { CodePanel } from '@/components/CodePanel';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { appStore } from '@/lib/store';
import {
  Code,
  Eye,
  Link,
  Moon,
  Play,
  RotateCcw,
  Square,
  Sun,
  X,
  Check,
  HelpCircle,
  ExternalLink,
  Sparkles,
  LogOut,
  User,
} from 'lucide-react';
import {
  createSourceFile,
  getUser,
  logout,
  backupCodeBeforeLogin,
  restoreCodeAfterLogin,
  loginRedirect,
  ApiError,
} from '@/lib/api';
import { examples } from '@/lib/examples';


const BAR_CLASSES = 'flex shrink-0 items-center h-11 px-4';
const MOBILE_BREAKPOINT = 768;

function useIsMobile() {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
      mql.addEventListener('change', cb);
      return () => mql.removeEventListener('change', cb);
    },
    () => window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches,
    () => false,
  );
}

export function AppLayout() {
  const code = useSelector(appStore, (s) => s.context.code);
  const graph = useSelector(appStore, (s) => s.context.graph);
  const error = useSelector(appStore, (s) => s.context.error);
  const panelOpen = useSelector(appStore, (s) => s.context.drawerOpen);
  const dark = useSelector(appStore, (s) => s.context.dark);
  const mode = useSelector(appStore, (s) => s.context.mode);
  const format = useSelector(appStore, (s) => s.context.format);
  const vizPanelRef = useRef<PanelImperativeHandle>(null);
  const codePanelRef = useRef<PanelImperativeHandle>(null);
  const groupRef = useRef<GroupImperativeHandle>(null);
  const vizScrollRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const mobileTab = useSelector(appStore, (s) => s.context.mobileTab);
  const editorTab = useSelector(appStore, (s) => s.context.editorTab);

  const sharing = useSelector(appStore, (s) => s.context.sharing);
  const user = useSelector(appStore, (s) => s.context.user);
  const nameModalOpen = useSelector(appStore, (s) => s.context.nameModalOpen);
  const nameInput = useSelector(appStore, (s) => s.context.nameInput);
  const examplesOpen = useSelector(appStore, (s) => s.context.examplesOpen);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    localStorage.setItem('sketch:dark', JSON.stringify(dark));
  }, [dark]);

  useEffect(() => {
    localStorage.setItem('sketch:panelOpen', JSON.stringify(panelOpen));
  }, [panelOpen]);

  useEffect(() => {
    if (isMobile || !codePanelRef.current) return;
    if (panelOpen) {
      const saved = localStorage.getItem('sketch:panelSize');
      codePanelRef.current.resize(saved ? `${saved}%` : "50%");
    } else {
      codePanelRef.current.collapse();
    }
  }, [panelOpen, isMobile]);

  // Check Supabase session cookie on mount & restore code backup from pre-login redirect
  useEffect(() => {
    const u = getUser();
    if (u) appStore.trigger.setUser({ user: u });
    const backup = restoreCodeAfterLogin();
    if (backup) {
      appStore.trigger.updateFromCode({ code: backup });
    }
  }, []);

  // Scroll to first active leaf node when a sim event comes in
  useEffect(() => {
    const scrollToActive = () => {
      const container = vizScrollRef.current;
      if (!container) return;
      const el = container.querySelector('[data-sim-active]');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    };
    const subs = [
      appStore.on('simSend', scrollToActive),
      appStore.on('startSim', scrollToActive),
      appStore.on('restartSim', scrollToActive),
    ];
    return () => subs.forEach((sub) => sub.unsubscribe());
  }, []);

  const handleCodeChange = useCallback((newCode: string) => {
    appStore.trigger.updateFromCode({ code: newCode });
  }, []);

  const handleStartSim = useCallback(() => {
    appStore.trigger.startSim();
    if (!isMobile && panelOpen && editorTab === 'code') {
      appStore.trigger.setEditorTab({ tab: 'simulation' });
    }
  }, [editorTab, isMobile, panelOpen]);

  const handleStopSim = useCallback(() => {
    appStore.trigger.stopSim();
    if (!isMobile) {
      appStore.trigger.setEditorTab({ tab: 'code' });
    }
  }, [isMobile]);

  const togglePanel = useCallback(() => {
    appStore.trigger.setDrawerOpen({ open: !panelOpen });
  }, [panelOpen]);

  const handleShareClick = useCallback(() => {
    const { graph, sketchName } = appStore.getSnapshot().context;
    if (!graph) return;
    appStore.trigger.setNameInput({ input: sketchName || '' });
    appStore.trigger.setNameModalOpen({ open: true });
  }, []);

  const handleShareConfirm = useCallback(async () => {
    const { code, graph, sourceFileId, format: currentFormat } = appStore.getSnapshot().context;
    if (!graph) return;

    const name = nameInput.trim() || 'Sketch';
    appStore.trigger.setSketchName({ name });
    appStore.trigger.setNameModalOpen({ open: false });

    appStore.trigger.setSharing({ status: 'saving' });
    try {
      const data = await createSourceFile(code, name, {
        forkFromId: sourceFileId ?? undefined,
        format: currentFormat ?? undefined,
      });
      appStore.trigger.setSourceFileId({ id: data.id });

      const url = `/viz/${data.id}`;
      window.history.pushState(null, '', url);
      await navigator.clipboard.writeText(`${window.location.origin}${url}`);
      appStore.trigger.setSharing({ status: 'copied' });
      setTimeout(() => appStore.trigger.setSharing({ status: 'idle' }), 2000);
    } catch (err) {
      if (err instanceof ApiError) {
        appStore.trigger.setSharing({ status: 'error' });
        setTimeout(() => appStore.trigger.setSharing({ status: 'idle' }), 3000);
        return;
      }
      appStore.trigger.setSharing({ status: 'error' });
      setTimeout(() => appStore.trigger.setSharing({ status: 'idle' }), 3000);
    }
  }, [nameInput]);

  const isEmpty = !graph;
  const isSim = mode === 'sim';

  const vizContent = isEmpty ? (
    <div className="flex flex-1 items-center justify-center" data-testid="empty-state">
      <div className="max-w-sm text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Sparkles size={24} className="text-muted-foreground" />
          </div>
        </div>
        <h2 className="mb-1 text-lg font-semibold text-foreground">
          Welcome to Sketch
        </h2>
        <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
          A responsive visualizer and simulator for XState v5 state machines. Open the editor to write code, or try an example to get started.
        </p>
        <div className="flex flex-col items-center gap-3">
          {!isMobile && (
            <button
              className="inline-flex cursor-pointer items-center gap-2 rounded-md border-none bg-foreground px-4 py-2 text-[0.8125rem] font-medium text-background transition-opacity hover:opacity-85"
              onClick={togglePanel}
            >
              <Code size={16} />
              Open Editor
            </button>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            {examples.slice(0, 3).map((example) => (
              <button
                key={example.title}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                onClick={() => {
                  appStore.trigger.updateFromCode({ code: example.code });
                  if (!panelOpen && !isMobile) {
                    appStore.trigger.setDrawerOpen({ open: true });
                  }
                }}
              >
                {example.title}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  ) : (
    <div ref={vizScrollRef} data-testid="viz-scroll" className="min-h-0 flex-1 overflow-auto p-8">
      <MachineViz graph={graph} />
    </div>
  );

  const footerBar = (
    <div data-testid="footer-bar" className={`${BAR_CLASSES} justify-between border-t border-border`}>
      <div className="flex items-center gap-2">
        {!isEmpty &&
          (isSim ? (
            <>
              <Tooltip>
                <TooltipTrigger
                  className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-foreground transition-opacity hover:opacity-85"
                  onClick={() => appStore.trigger.restartSim()}
                  aria-label="Restart simulation"
                >
                  <RotateCcw size={14} />
                </TooltipTrigger>
                <TooltipContent side="top">Restart</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  className="flex size-8 cursor-pointer items-center justify-center rounded-full border-none bg-foreground text-background transition-opacity hover:opacity-85"
                  onClick={handleStopSim}
                  aria-label="Stop simulation"
                >
                  <Square size={14} />
                </TooltipTrigger>
                <TooltipContent side="top">Stop</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <Tooltip>
              <TooltipTrigger
                className="flex size-8 cursor-pointer items-center justify-center rounded-full border-none bg-foreground text-background transition-opacity hover:opacity-85"
                onClick={handleStartSim}
                aria-label="Start simulation"
              >
                <Play size={14} />
              </TooltipTrigger>
              <TooltipContent side="top">Simulate</TooltipContent>
            </Tooltip>
          ))}
      </div>

      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger
            className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-foreground transition-opacity hover:opacity-85"
            onClick={() => appStore.trigger.toggleDark()}
            aria-label="Toggle dark mode"
          >
            {dark ? <Sun size={14} /> : <Moon size={14} />}
          </TooltipTrigger>
          <TooltipContent side="top">{dark ? 'Light mode' : 'Dark mode'}</TooltipContent>
        </Tooltip>
        {!isMobile && (
          <Tooltip>
            <TooltipTrigger
              className="flex size-8 cursor-pointer items-center justify-center rounded-full border-none bg-foreground text-background transition-opacity hover:opacity-85"
              onClick={togglePanel}
              aria-label="Toggle code editor"
            >
              {panelOpen ? <X size={14} /> : <Code size={14} />}
            </TooltipTrigger>
            <TooltipContent side="top">{panelOpen ? 'Close editor' : 'Open editor'}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );

  return (
    <TooltipProvider>
    <div
      className="grid h-dvh"
      style={{
        gridTemplateRows: '2.75rem 1fr',
        maxHeight: '100dvh',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div data-testid="header" className={`${BAR_CLASSES} justify-between border-b border-border`}>
        <div className="flex items-center gap-2">
          <a href="https://stately.ai">
            <img
              src={dark ? '/statelyai-light.svg' : '/statelyai-dark.svg'}
              alt="Stately"
              data-testid="logo"
              className="h-8 w-auto"
            />
          </a>
          <span className="text-sm font-semibold tracking-wider text-foreground">SKETCH</span>
          <a
            href="https://github.com/statelyai/sketch"
            target="_blank"
            rel="noopener noreferrer"
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
            aria-label="GitHub repository"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </a>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="inline-flex cursor-pointer items-center gap-1.5 px-0 py-1.5 text-xs font-medium text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
            onClick={() => appStore.trigger.setExamplesOpen({ open: true })}
            aria-label="Examples"
          >
            Examples
          </button>
          {!isEmpty && (
            <button
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
              onClick={handleShareClick}
              disabled={sharing === 'saving' || sharing === 'error'}
              aria-label="Share"
            >
              {sharing === 'error' ? (
                <>Failed</>
              ) : sharing === 'copied' ? (
                <>
                  <Check size={14} />
                  Copied!
                </>
              ) : sharing === 'saving' ? (
                <>Saving...</>
              ) : (
                <>
                  <Link size={14} />
                  Share
                </>
              )}
            </button>
          )}

          {/* Help menu */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger
                render={
                  <DropdownMenuTrigger
                    className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-foreground transition-opacity hover:opacity-85"
                    aria-label="Help"
                  />
                }
              >
                <HelpCircle size={14} />
              </TooltipTrigger>
              <TooltipContent>Help</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" side="bottom" sideOffset={4}>
              <DropdownMenuItem render={<a href="https://github.com/statelyai/sketch/issues/new" target="_blank" rel="noopener noreferrer" />}>
                <ExternalLink size={14} />
                Report an issue
              </DropdownMenuItem>
              <DropdownMenuItem render={<a href="https://stately.ai/privacy" target="_blank" rel="noopener noreferrer" />}>
                <ExternalLink size={14} />
                Privacy Policy
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<a href="https://stately.ai/docs/xstate" target="_blank" rel="noopener noreferrer" />}>
                <ExternalLink size={14} />
                XState Docs
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User menu */}
          {user ? (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <DropdownMenuTrigger
                      className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-foreground transition-opacity hover:opacity-85"
                      aria-label="Account"
                    />
                  }
                >
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="size-8 rounded-full" />
                  ) : (
                    <User size={14} />
                  )}
                </TooltipTrigger>
                <TooltipContent>Account</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" side="bottom" sideOffset={4}>
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  {user.displayName}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={async () => {
                    await logout();
                    appStore.trigger.setUser({ user: null });
                  }}
                >
                  <LogOut size={14} />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Tooltip>
              <TooltipTrigger
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                onClick={() => {
                  backupCodeBeforeLogin(appStore.getSnapshot().context.code);
                  loginRedirect();
                }}
                aria-label="Sign in"
              >
                <User size={14} />
                Sign in
              </TooltipTrigger>
              <TooltipContent>Sign in with Stately</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Name modal for sharing */}
      {nameModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/10 backdrop-blur-xs"
            onClick={() => appStore.trigger.setNameModalOpen({ open: false })}
          />
          <div className="relative z-10 w-full max-w-sm border border-border bg-background p-4 shadow-md">
            <h3 className="mb-1 text-sm font-medium text-foreground">Name your sketch</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Give your sketch a name before sharing.
            </p>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => appStore.trigger.setNameInput({ input: e.target.value })}
              placeholder="Unnamed Sketch"
              autoFocus
              className="mb-3 h-8 w-full border border-border bg-card px-2.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleShareConfirm();
                if (e.key === 'Escape') appStore.trigger.setNameModalOpen({ open: false });
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => appStore.trigger.setNameModalOpen({ open: false })}
                className="cursor-pointer rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleShareConfirm}
                className="cursor-pointer rounded-md border-none bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-85"
              >
                Share
              </button>
            </div>
          </div>
        </div>
      )}

      {examplesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/10 backdrop-blur-xs"
            onClick={() => appStore.trigger.setExamplesOpen({ open: false })}
          />
          <div
            role="dialog"
            aria-label="Examples"
            className="relative z-10 flex max-h-[min(42rem,80vh)] w-full max-w-2xl flex-col border border-border bg-background shadow-md"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h3 className="text-sm font-medium text-foreground">Examples</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Load a realistic machine or a format demo into the editor.
                </p>
              </div>
              <button
                type="button"
                onClick={() => appStore.trigger.setExamplesOpen({ open: false })}
                className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                Close
              </button>
            </div>
            <div data-testid="example-list" className="grid gap-1 overflow-auto p-2">
              {examples.map((example) => (
                <button
                  key={example.title}
                  type="button"
                  data-testid={`example-${example.title.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => {
                    appStore.trigger.updateFromCode({ code: example.code });
                    appStore.trigger.setExamplesOpen({ open: false });
                    if (!isMobile) {
                      appStore.trigger.setEditorTab({ tab: 'code' });
                    }
                  }}
                  className="group flex cursor-pointer flex-col items-start gap-0.5 rounded-md border border-transparent px-3 py-2 text-left transition-colors hover:border-border hover:bg-accent"
                >
                  <div className="flex w-full items-center gap-2">
                    <span className="text-xs font-medium text-foreground">
                      {example.title}
                    </span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[0.5625rem] font-medium text-muted-foreground">
                      {example.format === 'xstate'
                        ? 'XState'
                        : example.format === 'json'
                          ? 'JSON'
                          : example.format === 'yaml'
                            ? 'YAML'
                            : example.format === 'mermaid'
                              ? 'Mermaid'
                              : 'Sketch'}
                    </span>
                  </div>
                  <span className="text-[0.6875rem] text-muted-foreground">
                    {example.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {isMobile ? (
        <Tabs
          value={mobileTab}
          onValueChange={(tab) => appStore.trigger.setMobileTab({ tab })}
          className="flex min-h-0 flex-col"
        >
          <TabsContent value="viz" className="flex min-h-0 flex-1 flex-col">
            {vizContent}
            {footerBar}
          </TabsContent>
          <TabsContent value="code" className="flex min-h-0 flex-1 flex-col">
            <div className="min-w-0 max-w-[100vw] flex-1 flex flex-col overflow-hidden">
              <CodePanel
                code={code}
                dark={dark}
                format={format}
                activeTab={editorTab}
                onActiveTabChange={(tab) => appStore.trigger.setEditorTab({ tab })}
                onCodeChange={(newCode) => {
                  handleCodeChange(newCode);
                  appStore.trigger.setMobileTab({ tab: 'viz' });
                }}
                error={error}
              />
            </div>
          </TabsContent>
          <TabsList
            variant="line"
            className="w-full justify-center border-t border-border"
          >
            <TabsTrigger value="viz">
              <Eye size={14} />
              Visualizer
            </TabsTrigger>
            <TabsTrigger value="code">
              <Code size={14} />
              Code
            </TabsTrigger>
          </TabsList>
        </Tabs>
      ) : (
        <ResizablePanelGroup
          groupRef={groupRef}
          orientation="horizontal"
          style={{ overflow: 'hidden' }}
        >
          <ResizablePanel
            panelRef={vizPanelRef}
            minSize={20}
            style={{ overflow: 'hidden' }}
          >
            <div className="flex h-full flex-col">
              {vizContent}
              {footerBar}
            </div>
          </ResizablePanel>

          <ResizableHandle
            onDoubleClick={() => {
              vizPanelRef.current?.resize("50%");
              codePanelRef.current?.resize("50%");
              if (!panelOpen) {
                appStore.trigger.setDrawerOpen({ open: true });
              }
            }}
          />

          <ResizablePanel
            panelRef={codePanelRef}
            minSize={20}
            collapsible
            collapsedSize={0}
            style={{ overflow: 'hidden' }}
            onResize={(size) => {
              const collapsed = size.asPercentage === 0;
              if (collapsed && panelOpen) {
                appStore.trigger.setDrawerOpen({ open: false });
              } else if (!collapsed && !panelOpen) {
                appStore.trigger.setDrawerOpen({ open: true });
              }
              if (!collapsed) {
                localStorage.setItem('sketch:panelSize', String(size.asPercentage));
              }
            }}
          >
            <CodePanel
              code={code}
              dark={dark}
              format={format}
              activeTab={editorTab}
              onActiveTabChange={(tab) => appStore.trigger.setEditorTab({ tab })}
              onCodeChange={handleCodeChange}
              error={error}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </div>
    </TooltipProvider>
  );
}
