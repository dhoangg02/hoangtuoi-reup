import { CloudOnlyFeatureError, RuntimeMode, type RuntimeModeType } from '../shared/runtime';

export interface HealthResponse {
  status?: string;
  version?: string;
  runtime_mode?: string;
  backend?: string;
  degraded_reasons?: string[];
  ffmpeg?: { available?: boolean; path?: string | null };
  ffprobe?: { available?: boolean; path?: string | null };
  [key: string]: unknown;
}

export interface SubtitleSegment {
  index: number;
  start: number;
  end: number;
  origin_text: string;
  vi_text: string;
}

export interface JobStudioData {
  job_id?: string;
  detected_language?: string;
  target_language?: string;
  voice_id?: string;
  voice_rate?: string;
  bg_volume?: number;
  burn_subtitles?: boolean;
  duration?: number;
  output_path?: string;
  srt_path?: string;
  source_video_path?: string;
  segments?: SubtitleSegment[];
}

export interface JobSummary {
  id: string;
  title?: string;
  status?: string;
  stage?: string;
  progress?: number;
  message?: string;
  error_message?: string;
  output_path?: string;
  created_at?: string;
  updated_at?: string;
  url?: string;
  options?: Record<string, unknown>;
  studio?: JobStudioData;
  [key: string]: unknown;
}

export interface ChannelSummary {
  id: string;
  name?: string;
  url?: string;
  platform?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface SeriesSummary {
  id: string;
  name?: string;
  description?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface WatermarkProfile {
  id: string;
  name?: string;
  config?: Record<string, unknown>;
  created_at?: string;
  [key: string]: unknown;
}

export interface ApiProvider {
  readonly mode: RuntimeModeType;
  readonly baseUrl: string;

  getHealth(): Promise<HealthResponse>;
  getStartupStatus(): Promise<Record<string, unknown>>;
  getSettings(): Promise<Record<string, unknown>>;
  updateSettings(body: Record<string, unknown>): Promise<Record<string, unknown>>;

  listJobs(): Promise<JobSummary[]>;
  createJob(payload: { title: string; url?: string; options?: Record<string, unknown> }): Promise<JobSummary>;
  createDemoJob(options?: Record<string, unknown>): Promise<JobSummary>;
  getJob(id: string): Promise<JobSummary>;
  startJob(id: string): Promise<JobSummary>;
  redubJob(
    id: string,
    payload: {
      segments?: SubtitleSegment[];
      voice_id?: string;
      voice_rate?: string;
      bg_volume?: number;
      burn_subtitles?: boolean;
    }
  ): Promise<JobSummary>;
  cancelJob(id: string): Promise<JobSummary>;
  deleteJob(id: string): Promise<unknown>;

  listChannels(): Promise<ChannelSummary[]>;
  createChannel(payload: { name: string; url?: string; platform?: string }): Promise<ChannelSummary>;
  deleteChannel(id: string): Promise<unknown>;

  listSeries(): Promise<SeriesSummary[]>;
  createSeries(payload: { name: string; description?: string }): Promise<SeriesSummary>;
  deleteSeries(id: string): Promise<unknown>;

  listWatermarks(): Promise<WatermarkProfile[]>;
  createWatermark(payload: { name: string; config?: Record<string, unknown> }): Promise<WatermarkProfile>;
  deleteWatermark(id: string): Promise<unknown>;

  getCloudAccount(): Promise<never>;
  getBillingBalance(): Promise<never>;
  listFacebookPages(): Promise<never>;
}

async function localFetch<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  if (!baseUrl) {
    throw new Error('Local sidecar baseUrl is not configured.');
  }
  const res = await fetch(`${baseUrl}/api/v1${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Local API ${res.status} ${res.statusText}: ${text || path}`);
  }
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await res.json()) as T;
  }
  return {} as T;
}

export class LocalApiProvider implements ApiProvider {
  public readonly mode = RuntimeMode.LOCAL_STANDALONE;
  public readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  getHealth(): Promise<HealthResponse> {
    return localFetch<HealthResponse>(this.baseUrl, '/health');
  }

  getStartupStatus(): Promise<Record<string, unknown>> {
    return localFetch<Record<string, unknown>>(this.baseUrl, '/startup/status');
  }

  getSettings(): Promise<Record<string, unknown>> {
    return localFetch<Record<string, unknown>>(this.baseUrl, '/settings');
  }

  updateSettings(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    return localFetch<Record<string, unknown>>(this.baseUrl, '/settings', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async listJobs(): Promise<JobSummary[]> {
    const data = await localFetch<JobSummary[] | { jobs?: JobSummary[]; items?: JobSummary[] }>(
      this.baseUrl,
      '/jobs'
    );
    if (Array.isArray(data)) return data;
    return data.jobs ?? data.items ?? [];
  }

  createJob(payload: { title: string; url?: string; options?: Record<string, unknown> }): Promise<JobSummary> {
    return localFetch<JobSummary>(this.baseUrl, '/jobs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  createDemoJob(options?: Record<string, unknown>): Promise<JobSummary> {
    return localFetch<JobSummary>(this.baseUrl, '/jobs/demo', {
      method: 'POST',
      body: JSON.stringify(options ?? {}),
    });
  }

  getJob(id: string): Promise<JobSummary> {
    return localFetch<JobSummary>(this.baseUrl, `/jobs/${encodeURIComponent(id)}`);
  }

  startJob(id: string): Promise<JobSummary> {
    return localFetch<JobSummary>(this.baseUrl, `/jobs/${encodeURIComponent(id)}/start`, {
      method: 'POST',
    });
  }

  redubJob(
    id: string,
    payload: {
      segments?: SubtitleSegment[];
      voice_id?: string;
      voice_rate?: string;
      bg_volume?: number;
      burn_subtitles?: boolean;
    }
  ): Promise<JobSummary> {
    return localFetch<JobSummary>(this.baseUrl, `/jobs/${encodeURIComponent(id)}/redub`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  cancelJob(id: string): Promise<JobSummary> {
    return localFetch<JobSummary>(this.baseUrl, `/jobs/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
    });
  }

  deleteJob(id: string): Promise<unknown> {
    return localFetch(this.baseUrl, `/jobs/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async listChannels(): Promise<ChannelSummary[]> {
    const data = await localFetch<
      ChannelSummary[] | { channels?: ChannelSummary[]; items?: ChannelSummary[] }
    >(this.baseUrl, '/channels');
    if (Array.isArray(data)) return data;
    return data.channels ?? data.items ?? [];
  }

  createChannel(payload: { name: string; url?: string; platform?: string }): Promise<ChannelSummary> {
    return localFetch<ChannelSummary>(this.baseUrl, '/channels', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  deleteChannel(id: string): Promise<unknown> {
    return localFetch(this.baseUrl, `/channels/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async listSeries(): Promise<SeriesSummary[]> {
    const data = await localFetch<
      SeriesSummary[] | { series?: SeriesSummary[]; items?: SeriesSummary[] }
    >(this.baseUrl, '/series');
    if (Array.isArray(data)) return data;
    return data.series ?? data.items ?? [];
  }

  createSeries(payload: { name: string; description?: string }): Promise<SeriesSummary> {
    return localFetch<SeriesSummary>(this.baseUrl, '/series', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  deleteSeries(id: string): Promise<unknown> {
    return localFetch(this.baseUrl, `/series/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async listWatermarks(): Promise<WatermarkProfile[]> {
    const data = await localFetch<
      WatermarkProfile[] | { watermarks?: WatermarkProfile[]; items?: WatermarkProfile[] }
    >(this.baseUrl, '/watermarks');
    if (Array.isArray(data)) return data;
    return data.watermarks ?? data.items ?? [];
  }

  createWatermark(payload: {
    name: string;
    config?: Record<string, unknown>;
  }): Promise<WatermarkProfile> {
    return localFetch<WatermarkProfile>(this.baseUrl, '/watermarks', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  deleteWatermark(id: string): Promise<unknown> {
    return localFetch(this.baseUrl, `/watermarks/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  getCloudAccount(): Promise<never> {
    return Promise.reject(new CloudOnlyFeatureError('Cloud Account (/api/account/me)'));
  }

  getBillingBalance(): Promise<never> {
    return Promise.reject(new CloudOnlyFeatureError('Billing & Credits (/api/tokens/balance)'));
  }

  listFacebookPages(): Promise<never> {
    return Promise.reject(new CloudOnlyFeatureError('Facebook Publishing (/api/v1/facebook/pages)'));
  }
}

export class CloudApiProvider implements ApiProvider {
  public readonly mode = RuntimeMode.CLOUD;
  public readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  getHealth(): Promise<HealthResponse> {
    return localFetch<HealthResponse>(this.baseUrl, '/health');
  }
  getStartupStatus(): Promise<Record<string, unknown>> {
    return localFetch<Record<string, unknown>>(this.baseUrl, '/startup/status');
  }
  getSettings(): Promise<Record<string, unknown>> {
    return localFetch<Record<string, unknown>>(this.baseUrl, '/settings');
  }
  updateSettings(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    return localFetch<Record<string, unknown>>(this.baseUrl, '/settings', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }
  async listJobs(): Promise<JobSummary[]> {
    return [];
  }
  async createJob(payload: { title: string; url?: string }): Promise<JobSummary> {
    return { id: 'cloud-stub', title: payload.title, url: payload.url };
  }
  async createDemoJob(): Promise<JobSummary> {
    return { id: 'cloud-stub' };
  }
  async getJob(id: string): Promise<JobSummary> {
    return { id };
  }
  async startJob(id: string): Promise<JobSummary> {
    return { id };
  }
  async redubJob(id: string): Promise<JobSummary> {
    return { id };
  }
  async cancelJob(id: string): Promise<JobSummary> {
    return { id };
  }
  async deleteJob(): Promise<unknown> {
    return null;
  }
  async listChannels(): Promise<ChannelSummary[]> {
    return [];
  }
  async createChannel(payload: { name: string; url?: string; platform?: string }): Promise<ChannelSummary> {
    return { id: 'cloud-stub', ...payload };
  }
  async deleteChannel(): Promise<unknown> {
    return null;
  }
  async listSeries(): Promise<SeriesSummary[]> {
    return [];
  }
  async createSeries(payload: { name: string; description?: string }): Promise<SeriesSummary> {
    return { id: 'cloud-stub', ...payload };
  }
  async deleteSeries(): Promise<unknown> {
    return null;
  }
  async listWatermarks(): Promise<WatermarkProfile[]> {
    return [];
  }
  async createWatermark(payload: { name: string; config?: Record<string, unknown> }): Promise<WatermarkProfile> {
    return { id: 'cloud-stub', ...payload };
  }
  async deleteWatermark(): Promise<unknown> {
    return null;
  }
  getCloudAccount(): Promise<never> {
    return Promise.reject(new Error('CloudApiProvider requires production cloud auth configuration.'));
  }
  getBillingBalance(): Promise<never> {
    return Promise.reject(new Error('CloudApiProvider requires production cloud auth configuration.'));
  }
  listFacebookPages(): Promise<never> {
    return Promise.reject(new Error('CloudApiProvider requires production cloud auth configuration.'));
  }
}

export function createApiProvider(mode: RuntimeModeType, baseUrl: string): ApiProvider {
  return mode === RuntimeMode.LOCAL_STANDALONE
    ? new LocalApiProvider(baseUrl)
    : new CloudApiProvider(baseUrl);
}
