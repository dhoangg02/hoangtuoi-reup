export const RuntimeMode = {
  CLOUD: 'CLOUD',
  LOCAL_STANDALONE: 'LOCAL_STANDALONE',
} as const;

export type RuntimeModeType = (typeof RuntimeMode)[keyof typeof RuntimeMode];

export interface LocalWorkspaceSettings {
  theme: 'dark' | 'light';
  defaultLanguage: string;
  autoConnectSidecar: boolean;
  outputDir?: string;
}

export interface LocalWorkspace {
  id: string;
  displayName: string;
  settings: LocalWorkspaceSettings;
  storagePath: string;
  createdAt: string;
}

export interface RuntimeInfo {
  runtimeMode: RuntimeModeType;
  appVersion: string;
  platform: string;
  sidecarUrl: string;
  sidecarRunning: boolean;
  sidecarBinaryPath: string;
  dataDir: string;
}

export class CloudOnlyFeatureError extends Error {
  public readonly code = 'CLOUD_ONLY';
  constructor(featureName: string) {
    super(`Feature "${featureName}" is marked CLOUD_ONLY and is disabled in LOCAL_STANDALONE mode.`);
    this.name = 'CloudOnlyFeatureError';
  }
}
