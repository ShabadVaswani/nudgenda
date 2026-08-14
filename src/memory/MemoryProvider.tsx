import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import { useAgentSettings } from '@/agent/AgentSettingsProvider';
import type { ContextNotebookReport } from '@/context/contextNotebookPipeline';
import {
  compactConversation,
  compactionBatch,
  consolidateNightlyMemory,
  isNightlyConsolidationDue,
  validateContextNotebook,
} from '@/memory/maintenance';
import { clearMemoryState, loadMemoryState, saveMemoryState } from '@/memory/storage';
import {
  EMPTY_MEMORY_STATE,
  type MemoryState,
  type StoredConversationMessage,
} from '@/memory/types';

type MaintenanceStatus = 'compacting' | 'consolidating' | 'idle';

type MemoryContextValue = {
  addImportedNotebook: (options: {
    originalText: string;
    report: ContextNotebookReport;
    sourceId: string;
    sourceName: string;
  }) => Promise<void>;
  appendMessages: (messages: StoredConversationMessage[]) => Promise<void>;
  clear: () => Promise<void>;
  error?: string;
  isLoading: boolean;
  runMaintenance: (forceNightly?: boolean) => Promise<void>;
  state: MemoryState;
  status: MaintenanceStatus;
};

const Context = createContext<MemoryContextValue | null>(null);

function normalizeStoredState(stored?: MemoryState): MemoryState {
  if (!stored || stored.version !== 1) return EMPTY_MEMORY_STATE;
  return {
    ...EMPTY_MEMORY_STATE,
    ...stored,
    history: stored.history ?? [],
    messages: stored.messages ?? [],
    sources: stored.sources ?? [],
  };
}

export function MemoryProvider({ children }: PropsWithChildren) {
  const { apiKey, isConfigured } = useAgentSettings();
  const [state, setState] = useState<MemoryState>(EMPTY_MEMORY_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<MaintenanceStatus>('idle');
  const [error, setError] = useState<string>();
  const stateRef = useRef(state);
  const maintenanceRunning = useRef(false);
  const lastMaintenanceAttempt = useRef(0);

  const replaceState = useCallback(async (next: MemoryState) => {
    stateRef.current = next;
    setState(next);
    await saveMemoryState(next);
  }, []);

  useEffect(() => {
    let current = true;
    loadMemoryState()
      .then((stored) => {
        if (!current) return;
        const next = normalizeStoredState(stored);
        stateRef.current = next;
        setState(next);
      })
      .finally(() => {
        if (current) setIsLoading(false);
      });
    return () => {
      current = false;
    };
  }, []);

  const appendMessages = useCallback(
    async (messages: StoredConversationMessage[]) => {
      if (!messages.length) return;
      await replaceState({
        ...stateRef.current,
        messages: [...stateRef.current.messages, ...messages],
      });
    },
    [replaceState],
  );

  const addImportedNotebook = useCallback(
    async (options: {
      originalText: string;
      report: ContextNotebookReport;
      sourceId: string;
      sourceName: string;
    }) => {
      const knownSourceIds = new Set([
        ...stateRef.current.messages.map((message) => message.id),
        ...stateRef.current.sources.flatMap((source) =>
          source.evidence.map((item) => item.id),
        ),
        ...options.report.selectedEvidence.map((item) => item.id),
      ]);
      const validationErrors = validateContextNotebook(options.report.notebook, knownSourceIds);
      if (validationErrors.length) {
        throw new Error(`Imported memory failed validation: ${validationErrors.join(' ')}`);
      }
      await replaceState({
        ...stateRef.current,
        notebook: options.report.notebook,
        sources: [
          ...stateRef.current.sources.filter((source) => source.id !== options.sourceId),
          {
            evidence: options.report.selectedEvidence.map((item) => ({
              id: item.id,
              observedAt: item.observedAt,
              text: item.text,
            })),
            id: options.sourceId,
            importedAt: new Date().toISOString(),
            name: options.sourceName,
            originalText: options.originalText,
          },
        ],
      });
    },
    [replaceState],
  );

  const runMaintenance = useCallback(
    async (forceNightly = false) => {
      if (!isConfigured || isLoading || maintenanceRunning.current) return;
      const now = Date.now();
      if (!forceNightly && now - lastMaintenanceAttempt.current < 60_000) return;
      lastMaintenanceAttempt.current = now;
      maintenanceRunning.current = true;
      setError(undefined);
      try {
        let next = stateRef.current;
        if (compactionBatch(next).length) {
          setStatus('compacting');
          next = await compactConversation({ apiKey, state: next });
          await replaceState(next);
        }
        if (forceNightly || isNightlyConsolidationDue(next)) {
          setStatus('consolidating');
          next = await consolidateNightlyMemory({ apiKey, state: next });
          await replaceState(next);
        }
      } catch (maintenanceError) {
        setError(
          maintenanceError instanceof Error
            ? maintenanceError.message
            : 'Memory maintenance could not finish.',
        );
      } finally {
        maintenanceRunning.current = false;
        setStatus('idle');
      }
    },
    [apiKey, isConfigured, isLoading, replaceState],
  );

  useEffect(() => {
    if (isLoading || !isConfigured) return;
    const timeout = setTimeout(() => void runMaintenance(), 0);
    return () => clearTimeout(timeout);
  }, [isConfigured, isLoading, runMaintenance, state.messages.length]);

  useEffect(() => {
    const interval = setInterval(() => void runMaintenance(), 5 * 60_000);
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void runMaintenance();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [runMaintenance]);

  const clear = useCallback(async () => {
    await clearMemoryState();
    stateRef.current = EMPTY_MEMORY_STATE;
    setState(EMPTY_MEMORY_STATE);
    setError(undefined);
  }, []);

  const value = useMemo(
    () => ({
      addImportedNotebook,
      appendMessages,
      clear,
      error,
      isLoading,
      runMaintenance,
      state,
      status,
    }),
    [addImportedNotebook, appendMessages, clear, error, isLoading, runMaintenance, state, status],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useMemory() {
  const value = useContext(Context);
  if (!value) throw new Error('useMemory must be used inside MemoryProvider');
  return value;
}
