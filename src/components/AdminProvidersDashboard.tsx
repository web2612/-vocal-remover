import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Power,
  Shield,
  ArrowUp,
  ArrowDown,
  Clock,
  Zap,
  Lock,
  Layers
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

interface QuotaInfo {
  daily_limit: number | null;
  daily_used: number;
  monthly_limit: number | null;
  monthly_used: number;
  remaining_credits: number | null;
  is_confirmed: boolean;
  origin?: 'provider_reported' | 'internally_estimated';
  origin_label?: string;
}

interface ProviderCard {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  has_credentials: boolean;
  production_ready?: boolean;
  verification_status?: 'verified' | 'requires_credentials' | 'pending_live_test';
  circuit_state: 'closed' | 'open' | 'half_open';
  cooldown_remaining: number;
  quota: QuotaInfo;
  stats: {
    total_requests: number;
    total_success: number;
    total_failures: number;
    last_success_at: string | null;
    last_failure_at: string | null;
    last_failure_reason: string | null;
  };
}

interface SystemMetrics {
  total_configured: number;
  total_active: number;
  total_disabled: number;
  total_verified?: number;
  total_unverified?: number;
  daily_requests: number;
  monthly_requests: number;
  total_success: number;
  total_failures: number;
  success_rate_percent: number;
  failure_rate_percent: number;
  estimated_processing_cost: string;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: Record<string, any>;
}

export const AdminProvidersDashboard: React.FC = () => {
  const [adminKey, setAdminKey] = useState<string>(() => localStorage.getItem('vr_admin_key') || '');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [providers, setProviders] = useState<ProviderCard[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string; latency_ms?: number }>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'providers' | 'logs' | 'docs'>('providers');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchOverview = async (key: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/overview`, {
        headers: { 'X-Admin-Key': key }
      });
      if (!res.ok) {
        if (res.status === 401) {
          setIsAuthenticated(false);
          setErrorMessage('Invalid Admin Key. Please check your credentials.');
          return;
        }
        throw new Error(`Failed to load admin overview (HTTP ${res.status})`);
      }
      const data = await res.json();
      setMetrics(data.metrics);
      setProviders(data.providers);
      setLogs(data.recent_logs || []);
      setIsAuthenticated(true);
      localStorage.setItem('vr_admin_key', key);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not connect to Admin API Gateway.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    if (adminKey) {
      fetch(`${API_BASE}/api/v1/admin/overview`, {
        headers: { 'X-Admin-Key': adminKey }
      })
        .then(res => {
          if (res.ok) return res.json();
          return null;
        })
        .then(data => {
          if (!ignore && data) {
            setMetrics(data.metrics);
            setProviders(data.providers);
            setLogs(data.recent_logs || []);
            setIsAuthenticated(true);
          }
        })
        .catch(() => {});
    }
    return () => {
      ignore = true;
    };
  }, [adminKey]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminKey.trim()) {
      fetchOverview(adminKey.trim());
    }
  };

  const handleToggle = async (providerId: string, currentEnabled: boolean) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/provider/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey
        },
        body: JSON.stringify({ provider_id: providerId, enabled: !currentEnabled })
      });
      if (res.ok) {
        fetchOverview(adminKey);
      }
    } catch (err) {
      console.error('Failed to toggle provider:', err);
    }
  };

  const handlePriorityChange = async (providerId: string, newPriority: number) => {
    if (newPriority < 1) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/provider/priority`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey
        },
        body: JSON.stringify({ provider_id: providerId, priority: newPriority })
      });
      if (res.ok) {
        fetchOverview(adminKey);
      }
    } catch (err) {
      console.error('Failed to change priority:', err);
    }
  };

  const handleTestConnection = async (providerId: string) => {
    setTestingId(providerId);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/provider/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey
        },
        body: JSON.stringify({ provider_id: providerId })
      });
      const data = await res.json();
      setTestResults(prev => ({ ...prev, [providerId]: data }));
    } catch (err: any) {
      setTestResults(prev => ({
        ...prev,
        [providerId]: { success: false, message: err.message || 'Connection test failed.' }
      }));
    } finally {
      setTestingId(null);
    }
  };

  const handleResetCooldown = async (providerId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/provider/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey
        },
        body: JSON.stringify({ provider_id: providerId })
      });
      if (res.ok) {
        fetchOverview(adminKey);
      }
    } catch (err) {
      console.error('Failed to reset cooldown:', err);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-4">
            <Shield className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Multi-Provider Manager</h2>
          <p className="text-sm text-slate-400 mt-1">Authenticate to manage vocal separation API providers</p>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Admin Secret Key
            </label>
            <div className="relative">
              <input
                type="password"
                value={adminKey}
                onChange={e => setAdminKey(e.target.value)}
                placeholder="Enter ADMIN_SECRET_KEY"
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                required
              />
              <Lock className="w-4 h-4 text-slate-500 absolute right-3.5 top-3.5 pointer-events-none" />
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-medium text-sm rounded-xl transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            Unlock API Dashboard
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Layers className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Multi-Provider AI Vocal Remover Manager</h1>
              <p className="text-sm text-slate-400">Automated quota monitoring, circuit breaking, priority rotation & failover</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchOverview(adminKey)}
            disabled={isLoading}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Status
          </button>
          <button
            onClick={() => {
              setIsAuthenticated(false);
              localStorage.removeItem('vr_admin_key');
            }}
            className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium rounded-xl border border-rose-500/20 transition-colors"
          >
            Lock Dashboard
          </button>
        </div>
      </div>

      {/* Metrics Banner */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
            <span className="text-xs text-slate-400 font-medium">Configured Providers</span>
            <div className="text-2xl font-bold text-white mt-1">{metrics.total_configured}</div>
            <span className="text-[11px] text-emerald-400 mt-1 block">
              {metrics.total_verified ?? 0} Verified • {metrics.total_unverified ?? metrics.total_configured} Unverified
            </span>
          </div>
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
            <span className="text-xs text-slate-400 font-medium">Daily Requests</span>
            <div className="text-2xl font-bold text-indigo-400 mt-1">{metrics.daily_requests}</div>
            <span className="text-[11px] text-slate-500 mt-1 block">Resets 00:00 UTC</span>
          </div>
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
            <span className="text-xs text-slate-400 font-medium">Monthly Requests</span>
            <div className="text-2xl font-bold text-white mt-1">{metrics.monthly_requests}</div>
            <span className="text-[11px] text-slate-500 mt-1 block">Current billing period</span>
          </div>
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
            <span className="text-xs text-slate-400 font-medium">Success Rate</span>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{metrics.success_rate_percent}%</div>
            <span className="text-[11px] text-slate-500 mt-1 block">{metrics.total_success} successful jobs</span>
          </div>
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
            <span className="text-xs text-slate-400 font-medium">Failover Handled</span>
            <div className="text-2xl font-bold text-amber-400 mt-1">{metrics.total_failures}</div>
            <span className="text-[11px] text-slate-500 mt-1 block">Auto-switched without failure</span>
          </div>
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
            <span className="text-xs text-slate-400 font-medium">Est. Compute Cost</span>
            <div className="text-2xl font-bold text-white mt-1">{metrics.estimated_processing_cost}</div>
            <span className="text-[11px] text-slate-500 mt-1 block">Across all providers</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('providers')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-colors ${
            activeTab === 'providers'
              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Provider Hierarchy & Quotas
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-colors ${
            activeTab === 'logs'
              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Audit & Rotation Logs
        </button>
        <button
          onClick={() => setActiveTab('docs')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-colors ${
            activeTab === 'docs'
              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          API Integration Contracts
        </button>
      </div>

      {/* Tab 1: Provider Cards */}
      {activeTab === 'providers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {providers.map(p => {
            const test = testResults[p.id];
            const isTripped = p.circuit_state === 'open';

            return (
              <div
                key={p.id}
                className={`bg-slate-900/70 border rounded-2xl p-6 transition-all ${
                  !p.enabled
                    ? 'border-slate-800/60 opacity-60'
                    : isTripped
                    ? 'border-amber-500/30 shadow-lg shadow-amber-500/5'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase bg-slate-800 text-slate-300 border border-slate-700">
                        Priority #{p.priority}
                      </span>
                      {p.enabled ? (
                        isTripped ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Cooldown ({p.cooldown_remaining}s)
                          </span>
                        ) : !p.has_credentials || p.verification_status === 'requires_credentials' ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Key Required
                          </span>
                        ) : !p.production_ready ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Unverified
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Production Ready
                          </span>
                        )
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                          Disabled
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-white mt-1.5">{p.name}</h3>
                  </div>

                  <button
                    onClick={() => handleToggle(p.id, p.enabled)}
                    title={p.enabled ? 'Disable Provider' : 'Enable Provider'}
                    className={`p-2.5 rounded-xl border transition-colors ${
                      p.enabled
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    <Power className="w-4 h-4" />
                  </button>
                </div>

                {/* Quota & Usage Ledger */}
                <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 mb-4 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Daily Quota</span>
                    <span className="font-semibold text-slate-200">
                      {p.quota.daily_limit !== null ? `${p.quota.daily_used} / ${p.quota.daily_limit}` : 'Unlimited'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Monthly Quota</span>
                    <span className="font-semibold text-slate-200">
                      {p.quota.monthly_limit !== null ? `${p.quota.monthly_used} / ${p.quota.monthly_limit}` : 'Unlimited'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Quota Origin</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1.5 ${
                      p.quota.is_confirmed
                        ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                        : 'bg-slate-800 text-slate-400 border border-slate-700/80'
                    }`}>
                      {p.quota.is_confirmed ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
                          Provider-Reported (Live Synced)
                        </>
                      ) : (
                        'Internally Estimated (Local Ledger)'
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">API Credentials</span>
                    <span className={`flex items-center gap-1 ${p.has_credentials ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {p.has_credentials ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      {p.has_credentials ? 'Configured (Encrypted)' : 'Missing Key'}
                    </span>
                  </div>
                </div>

                {/* Test Connection Output */}
                {test && (
                  <div className={`p-3 rounded-xl border text-xs mb-4 flex items-start gap-2 ${
                    test.success
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                  }`}>
                    {test.success ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                    <div>
                      <div className="font-semibold">{test.success ? `Connected (${test.latency_ms}ms)` : 'Connection Failed'}</div>
                      <div className="text-[11px] opacity-90 mt-0.5">{test.message}</div>
                    </div>
                  </div>
                )}

                {/* Card Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                  <button
                    onClick={() => handleTestConnection(p.id)}
                    disabled={testingId === p.id}
                    className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Zap className={`w-3.5 h-3.5 text-amber-400 ${testingId === p.id ? 'animate-bounce' : ''}`} />
                    {testingId === p.id ? 'Testing...' : 'Test Connection'}
                  </button>

                  {isTripped && (
                    <button
                      onClick={() => handleResetCooldown(p.id)}
                      title="Clear Circuit Cooldown"
                      className="py-2 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-medium rounded-xl border border-amber-500/20 transition-colors"
                    >
                      Reset
                    </button>
                  )}

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handlePriorityChange(p.id, p.priority - 1)}
                      disabled={p.priority <= 1}
                      title="Increase Selection Priority"
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg disabled:opacity-30"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handlePriorityChange(p.id, p.priority + 1)}
                      title="Decrease Selection Priority"
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 2: Logs */}
      {activeTab === 'logs' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-white">Live Orchestration & Failover Trail</h3>
            <span className="text-xs text-slate-500">Atomic ledger audit trail</span>
          </div>

          <div className="space-y-2 font-mono text-xs">
            {logs.length === 0 ? (
              <div className="p-8 text-center text-slate-500">No orchestration events logged yet.</div>
            ) : (
              logs.map((log, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl flex items-start gap-3"
                >
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    log.level === 'INFO'
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      : log.level === 'WARNING'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {log.level}
                  </span>
                  <div className="flex-1">
                    <div className="text-slate-300">{log.message}</div>
                    {log.context && Object.keys(log.context).length > 0 && (
                      <div className="text-slate-500 text-[11px] mt-1">
                        {JSON.stringify(log.context)}
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-600 shrink-0">{log.timestamp}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 3: API Integration Contracts */}
      {activeTab === 'docs' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-6 text-sm text-slate-300">
          <div>
            <h3 className="text-lg font-bold text-white mb-2">Multi-Provider Integration Overview</h3>
            <p className="text-slate-400 leading-relaxed">
              VocalRemover.group manages multiple 3rd-party audio source separation APIs using an automatic priority-based
              rotation engine. When an audio track is uploaded, the orchestrator evaluates provider quotas, authentication credentials,
              audio duration limits, and circuit breaker health to select the best available provider.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
              <h4 className="font-bold text-white mb-1">Provider 1: SplitBeat (RapidAPI)</h4>
              <p className="text-xs text-slate-400 mb-2">Endpoint: POST /Upload_audio • multipart/form-data</p>
              <div className="text-xs text-slate-500">Fast synchronous separation. Accepts input_audio parameter with binary file.</div>
            </div>
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
              <h4 className="font-bold text-white mb-1">Provider 2: Voice Separation API (RapidAPI)</h4>
              <p className="text-xs text-slate-400 mb-2">Endpoint: POST /api/rapidapi/separate-audio • octet-stream</p>
              <div className="text-xs text-slate-500">Direct binary octet-stream upload. Returns separated vocal and accompaniment URLs.</div>
            </div>
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
              <h4 className="font-bold text-white mb-1">Provider 3: Disband (api.disband.io)</h4>
              <p className="text-xs text-slate-400 mb-2">Endpoints: POST /separations • GET /usage • GET /separations/&#123;id&#125;</p>
              <div className="text-xs text-slate-500">Asynchronous polling workflow with live quota inspection from GET /usage.</div>
            </div>
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
              <h4 className="font-bold text-white mb-1">Provider 4: Karadeo (karadeo.com)</h4>
              <p className="text-xs text-slate-400 mb-2">Endpoint: POST /api/vocal-remover • JSON with fileUrl</p>
              <div className="text-xs text-slate-500">Requires signed temporary file URL. Automatically purged after stem extraction.</div>
            </div>
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
              <h4 className="font-bold text-white mb-1">Provider 5: StemConsole (stemconsole.ai)</h4>
              <p className="text-xs text-slate-400 mb-2">Endpoint: POST /v1/tasks • Free tier: 5 songs/mo</p>
              <div className="text-xs text-slate-500">Extracts vocals, drums, bass, and instrumental stems. Task-based polling.</div>
            </div>
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 opacity-60">
              <h4 className="font-bold text-slate-400 mb-1">Provider 6: AudioShake (Standby)</h4>
              <p className="text-xs text-slate-500 mb-2">Status: Disabled pending contract & verified credentials</p>
              <div className="text-xs text-slate-600">Reserved for enterprise stem separation once official credentials are provided.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
