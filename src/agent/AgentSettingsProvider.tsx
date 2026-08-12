import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  clearAgentSettings,
  loadAgentSettings,
  saveAgentSettings,
} from '@/agent/openRouterStorage';

export const DEFAULT_OPENROUTER_MODEL = 'openrouter/free';

type AgentSettingsContextValue = {
  apiKey: string;
  clearApiKey: () => Promise<void>;
  isConfigured: boolean;
  isLoading: boolean;
  model: string;
  save: (apiKey: string, model: string) => Promise<void>;
};

const AgentSettingsContext = createContext<AgentSettingsContextValue | null>(null);

export function AgentSettingsProvider({ children }: PropsWithChildren) {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(DEFAULT_OPENROUTER_MODEL);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let current = true;
    loadAgentSettings()
      .then((settings) => {
        if (!current || !settings) return;
        setApiKey(settings.apiKey);
        setModel(settings.model || DEFAULT_OPENROUTER_MODEL);
      })
      .finally(() => {
        if (current) setIsLoading(false);
      });
    return () => {
      current = false;
    };
  }, []);

  const save = useCallback(async (nextApiKey: string, nextModel: string) => {
    const settings = {
      apiKey: nextApiKey.trim(),
      model: nextModel.trim() || DEFAULT_OPENROUTER_MODEL,
    };
    await saveAgentSettings(settings);
    setApiKey(settings.apiKey);
    setModel(settings.model);
  }, []);

  const clearApiKey = useCallback(async () => {
    await clearAgentSettings();
    setApiKey('');
    setModel(DEFAULT_OPENROUTER_MODEL);
  }, []);

  const value = useMemo<AgentSettingsContextValue>(
    () => ({
      apiKey,
      clearApiKey,
      isConfigured: Boolean(apiKey),
      isLoading,
      model,
      save,
    }),
    [apiKey, clearApiKey, isLoading, model, save],
  );

  return <AgentSettingsContext.Provider value={value}>{children}</AgentSettingsContext.Provider>;
}

export function useAgentSettings() {
  const value = useContext(AgentSettingsContext);
  if (!value) throw new Error('useAgentSettings must be used inside AgentSettingsProvider');
  return value;
}
