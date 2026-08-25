'use client';

import React, { useEffect, useState } from 'react';
import { RefreshCw, Download, CheckCircle, Clock, AlertCircle, Zap } from 'lucide-react';

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
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [refreshTrigger]);

  // Auto-refresh running jobs
  useEffect(() => {
    if (!autoRefresh) return;

    const hasRunningJobs = jobs.some((job) => job.status === 'PENDING' || job.status === 'RUNNING');
    if (!hasRunningJobs) return;

    const interval = setInterval(fetchJobs, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [jobs, autoRefresh]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'RUNNING':
        return <Zap className="w-5 h-5 text-yellow-400 animate-pulse" />;
      case 'PENDING':
        return <Clock className="w-5 h-5 text-slate-400 animate-pulse" />;
      case 'FAILED':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-900/30 border-green-700';
      case 'RUNNING':
        return 'bg-yellow-900/30 border-yellow-700';
      case 'PENDING':
        return 'bg-slate-700/30 border-slate-600';
      case 'FAILED':
        return 'bg-red-900/30 border-red-700';
      default:
        return 'bg-slate-800 border-slate-700';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Recent Jobs</h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh
          </label>
          <button
            onClick={fetchJobs}
            disabled={loading}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 text-slate-300 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
          {error}
        </div>
      )}

      {loading && jobs.length === 0 ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading jobs...</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-400">No jobs yet. Submit one to get started!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div
              key={job._id}
              className={`p-4 rounded-lg border transition-colors ${getStatusColor(job.status)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  {getStatusIcon(job.status)}
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">{job.jobName}</h3>
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-slate-400">Status</span>
                        <p className="text-slate-200 font-medium">{job.status}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">ID</span>
                        <p className="text-slate-200 font-mono text-xs truncate">
                          {job._id.substring(0, 8)}...
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400">Created</span>
                        <p className="text-slate-200">{formatDate(job.createdAt)}</p>
                      </div>
                      {job.bestAffinity !== undefined && (
                        <div>
                          <span className="text-slate-400">Best Affinity</span>
                          <p className="text-green-400 font-medium">{job.bestAffinity.toFixed(2)} kcal/mol</p>
                        </div>
                      )}
                    </div>

                    {job.errorMessage && (
                      <div className="mt-3 p-2 bg-red-900/50 rounded text-red-200 text-sm">
                        <span className="font-medium">Error:</span> {job.errorMessage}
                      </div>
                    )}
                  </div>
                </div>

                {job.dockingResultUrl && (
                  <a
                    href={job.dockingResultUrl}
                    download
                    className="ml-4 p-2 hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
                    title="Download result"
                  >
                    <Download className="w-5 h-5 text-blue-400" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
