'use client';

import React, { useEffect, useState } from 'react';
import { RefreshCw, Download, CheckCircle, Clock, AlertCircle, Activity, Database } from 'lucide-react';

interface Job {
  _id: string;
  jobName: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  bestAffinity?: number;
  dockingResultUrl?: string;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
}

interface JobListProps {
  refreshTrigger?: string;
}

export default function JobList({ refreshTrigger }: JobListProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchJobs = async () => {
    try {
      const response = await fetch('/api/jobs?userId=demo-user');
      if (!response.ok) throw new Error('Failed to fetch jobs');
      const data = await response.json();
      setJobs(data.jobs || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [refreshTrigger]);

  useEffect(() => {
    if (!autoRefresh) return;
    const hasRunningJobs = jobs.some((job) => job.status === 'PENDING' || job.status === 'RUNNING');
    if (!hasRunningJobs) return;
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, [jobs, autoRefresh]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case 'RUNNING':
        return <Activity className="w-5 h-5 text-cyan-400 animate-pulse" />;
      case 'PENDING':
        return <Clock className="w-5 h-5 text-amber-400 animate-pulse" />;
      case 'FAILED':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-gradient-to-br from-emerald-900/40 to-green-950/40 border-emerald-500/40';
      case 'RUNNING':
        return 'bg-gradient-to-br from-cyan-900/40 to-blue-950/40 border-cyan-500/40';
      case 'PENDING':
        return 'bg-gradient-to-br from-amber-900/30 to-yellow-950/30 border-amber-500/30';
      case 'FAILED':
        return 'bg-gradient-to-br from-red-900/40 to-rose-950/40 border-red-500/40';
      default:
        return 'bg-slate-800/50 border-gray-700';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-gradient-to-br from-slate-800/90 to-blue-950/90 backdrop-blur-sm rounded-lg border border-cyan-500/30 p-6 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/20 rounded-lg border border-cyan-500/40">
            <Database className="w-5 h-5 text-cyan-300" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-cyan-300">Processing Queue</h2>
            <p className="text-xs text-gray-400 font-mono">Real-time job monitoring</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-cyan-300 font-medium">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-cyan-500 bg-slate-900 text-cyan-500 focus:ring-cyan-500/50"
            />
            <span className="font-mono text-xs">Auto-refresh</span>
          </label>
          <button
            onClick={fetchJobs}
            disabled={loading}
            className="p-2 hover:bg-cyan-500/20 rounded-lg transition-all disabled:opacity-50 border border-cyan-500/30 hover:border-cyan-500/50 hover:scale-105 active:scale-95"
          >
            <RefreshCw className={`w-5 h-5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-300 text-sm font-mono">
          {error}
        </div>
      )}

      {loading && jobs.length === 0 ? (
        <div className="text-center py-20">
          <div className="relative inline-block">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-cyan-900/30 border-t-cyan-500"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Activity className="w-8 h-8 text-cyan-400" />
            </div>
          </div>
          <p className="text-gray-400 mt-6 font-mono text-sm">Loading job queue...</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-20">
          <div className="inline-block p-6 bg-gradient-to-br from-slate-900/80 to-blue-950/50 rounded-full mb-6 border border-cyan-500/20">
            <Database className="w-12 h-12 text-gray-600" />
          </div>
          <p className="text-gray-400 font-semibold text-lg">No jobs in queue</p>
          <p className="text-gray-500 text-sm mt-2 font-mono">Submit a docking job to begin processing</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div
              key={job._id}
              className={`p-5 rounded-lg border transition-all hover:shadow-lg hover:shadow-cyan-500/10 ${getStatusColor(job.status)}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {getStatusIcon(job.status)}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-cyan-100 text-lg mb-1">{job.jobName}</h3>
                    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500 font-mono text-xs uppercase">Status</p>
                        <p className="text-gray-200 font-bold text-xs mt-1">{job.status}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 font-mono text-xs uppercase">Job ID</p>
                        <p className="text-gray-400 font-mono text-xs mt-1 truncate">
                          {job._id.substring(0, 8)}...
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 font-mono text-xs uppercase">Created</p>
                        <p className="text-gray-400 font-mono text-xs mt-1">{formatDate(job.createdAt)}</p>
                      </div>
                      {job.bestAffinity !== undefined && (
                        <div>
                          <p className="text-gray-500 font-mono text-xs uppercase">Affinity</p>
                          <p className="text-emerald-400 font-bold text-sm mt-1">{job.bestAffinity.toFixed(2)} kcal/mol</p>
                        </div>
                      )}
                    </div>

                    {job.errorMessage && (
                      <div className="mt-3 p-3 bg-red-950/50 rounded-lg border border-red-500/30 text-red-300 text-xs font-mono">
                        ERROR: {job.errorMessage}
                      </div>
                    )}
                  </div>
                </div>

                {job.dockingResultUrl && (
                  <a
                    href={job.dockingResultUrl}
                    download
                    className="p-2.5 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 rounded-lg transition-all hover:shadow-lg hover:shadow-cyan-500/20 flex-shrink-0 hover:scale-105 active:scale-95"
                    title="Download results"
                  >
                    <Download className="w-5 h-5 text-cyan-300" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-cyan-500/20 text-center">
        <p className="text-gray-500 text-xs font-mono">
          {jobs.length} job{jobs.length !== 1 ? 's' : ''} in queue • Polling interval: 5s
        </p>
      </div>
    </div>
  );
}
