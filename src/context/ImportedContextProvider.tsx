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
  clearImportedContext,
  loadImportedContext,
  saveImportedContext,
} from '@/context/importedContextStorage';
import type { ImportedContext } from '@/context/types';

type ImportedContextValue = {
  context?: ImportedContext;
  isLoading: boolean;
  remove: () => Promise<void>;
  replace: (context: ImportedContext) => Promise<void>;
};

const Context = createContext<ImportedContextValue | null>(null);

export function ImportedContextProvider({ children }: PropsWithChildren) {
  const [context, setContext] = useState<ImportedContext>();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let current = true;
    loadImportedContext()
      .then((stored) => {
        if (current) setContext(stored);
      })
      .finally(() => {
        if (current) setIsLoading(false);
      });
    return () => {
      current = false;
    };
  }, []);

  const replace = useCallback(async (next: ImportedContext) => {
    await saveImportedContext(next);
    setContext(next);
  }, []);

  const remove = useCallback(async () => {
    await clearImportedContext();
    setContext(undefined);
  }, []);

  const value = useMemo(
    () => ({ context, isLoading, remove, replace }),
    [context, isLoading, remove, replace],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useImportedContext() {
  const value = useContext(Context);
  if (!value) throw new Error('useImportedContext must be used inside ImportedContextProvider');
  return value;
}
