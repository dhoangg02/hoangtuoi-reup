import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  RuntimeMode,
  type LocalWorkspace,
  type RuntimeInfo,
  type RuntimeModeType,
} from '@shared/runtime';
import { createApiProvider, type ApiProvider } from '@adapter/apiProvider';

export interface ElectronBridge {
  baseUrl: string;
  runtimeMode: RuntimeModeType;
  workspace: {
    get: () => Promise<LocalWorkspace>;
    update: (patch: Partial<LocalWorkspace>) => Promise<LocalWorkspace>;
  };
  paths: {
    data: () => Promise<string>;
    output: () => Promise<string>;
    logs: () => Promise<string>;
  };
  shell: {
    showInFolder: (p: string) => Promise<void>;
    openPath: (p: string) => Promise<string>;
  };
  dialog: {
    openVideoFile: () => Promise<string | null>;
    openFolder: () => Promise<string | null>;
  };
  app: {
    getRuntimeInfo: () => Promise<RuntimeInfo>;
    restartSidecar: () => Promise<{ sidecarUrl: string; sidecarRunning: boolean }>;
    quit: () => Promise<void>;
  };
}

declare global {
  interface Window {
    api?: ElectronBridge;
  }
}

interface LocalWorkspaceContextValue {
  runtimeMode: RuntimeModeType;
  workspace: LocalWorkspace | null;
  runtimeInfo: RuntimeInfo | null;
  apiProvider: ApiProvider;
  isLoading: boolean;
  updateWorkspace: (patch: Partial<LocalWorkspace>) => Promise<void>;
  refreshRuntimeInfo: () => Promise<void>;
}

const LocalWorkspaceContext = createContext<LocalWorkspaceContextValue | null>(null);

const FALLBACK_WORKSPACE: LocalWorkspace = {
  id: 'local-browser-preview',
  displayName: 'Local Workspace Owner',
  settings: {
    theme: 'dark',
    defaultLanguage: 'vi',
    autoConnectSidecar: true,
  },
  storagePath: './data',
  createdAt: new Date().toISOString(),
};

export const LocalWorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const runtimeMode: RuntimeModeType = window.api?.runtimeMode ?? RuntimeMode.LOCAL_STANDALONE;
  const [workspace, setWorkspace] = useState<LocalWorkspace | null>(null);
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const baseUrl = runtimeInfo?.sidecarUrl || window.api?.baseUrl || '';

  const apiProvider = useMemo(
    () => createApiProvider(runtimeMode, baseUrl),
    [runtimeMode, baseUrl]
  );

  const refreshRuntimeInfo = async () => {
    if (window.api?.app?.getRuntimeInfo) {
      const info = await window.api.app.getRuntimeInfo();
      setRuntimeInfo(info);
    }
  };

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      try {
        if (window.api?.workspace?.get) {
          const [ws, info] = await Promise.all([
            window.api.workspace.get(),
            window.api.app.getRuntimeInfo(),
          ]);
          if (active) {
            setWorkspace(ws);
            setRuntimeInfo(info);
          }
        } else if (active) {
          setWorkspace(FALLBACK_WORKSPACE);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }
    bootstrap();
    return () => {
      active = false;
    };
  }, []);

  const updateWorkspace = async (patch: Partial<LocalWorkspace>) => {
    if (window.api?.workspace?.update) {
      const updated = await window.api.workspace.update(patch);
      setWorkspace(updated);
    } else {
      setWorkspace((prev) => (prev ? { ...prev, ...patch } : FALLBACK_WORKSPACE));
    }
  };

  return (
    <LocalWorkspaceContext.Provider
      value={{
        runtimeMode,
        workspace,
        runtimeInfo,
        apiProvider,
        isLoading,
        updateWorkspace,
        refreshRuntimeInfo,
      }}
    >
      {children}
    </LocalWorkspaceContext.Provider>
  );
};

export function useLocalWorkspace(): LocalWorkspaceContextValue {
  const ctx = useContext(LocalWorkspaceContext);
  if (!ctx) {
    throw new Error('useLocalWorkspace must be used within LocalWorkspaceProvider');
  }
  return ctx;
}
