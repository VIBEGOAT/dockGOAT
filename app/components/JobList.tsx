'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Download, CheckCircle, Clock, AlertCircle, Activity, Database } from 'lucide-react';

interface Job {
  _id: string;
  jobName: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  bestAffinity?: number;
  errorMessage?: string;
  dockingResultUrl?: string;
}

interface JobListProps {
  refreshTrigger: string;
}

export default function JobList({ refreshTrigger }: JobListProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/jobs?userId=demo-user');
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs || []);
      }
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [refreshTrigger]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchJobs, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const getStatusIcon = (status: Job['status']) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />;
      case 'RUNNING':
        return <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      case 'QUEUED':
        return <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />;
      case 'FAILED':
        return <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: Job['status']) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20';
      case 'RUNNING':
        return 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20';
      case 'QUEUED':
        return 'bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/20';
      case 'FAILED':
        return 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20';
      default:
        return 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="rounded-3xl bg-white dark:bg-[#1c1c1e] border border-black/5 dark:border-white/10 p-8 shadow-sm"
    >
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <motion.div 
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center"
          >
            <Database className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </motion.div>
          <div>
            <h2 className="text-xl font-bold text-black dark:text-white">Processing Queue</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Real-time job monitoring</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-black/40 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400 cursor-pointer"
            />
            <span className="text-xs">Auto-refresh</span>
          </label>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={fetchJobs}
            disabled={loading}
            className="p-2.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-all disabled:opacity-50"
          >
            <motion.div
              animate={loading ? { rotate: 360 } : {}}
              transition={{ duration: 1, repeat: loading ? Infinity : 0, ease: "linear" }}
            >
              <RefreshCw className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </motion.div>
          </motion.button>
        </div>
      </div>

      {loading && jobs.length === 0 ? (
        <div className="text-center py-16">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="inline-block"
          >
            <RefreshCw className="w-8 h-8 text-gray-400 dark:text-gray-600" />
          </motion.div>
          <p className="text-gray-600 dark:text-gray-400 mt-4 font-medium">Loading jobs...</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 dark:bg-black/20 rounded-2xl">
          <Database className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400 font-medium">No jobs in queue</p>
          <p className="text-sm text-gray-500 dark:text-gray-600 mt-1">Submit a job to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {jobs.map((job, index) => (
              <motion.div
                key={job._id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.05, type: "spring", stiffness: 100 }}
                whileHover={{ scale: 1.01, y: -2 }}
                className={`p-6 rounded-2xl border transition-all ${getStatusColor(job.status)}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <motion.div
                      animate={job.status === 'RUNNING' ? { rotate: 360 } : {}}
                      transition={{ duration: 2, repeat: job.status === 'RUNNING' ? Infinity : 0, ease: "linear" }}
                    >
                      {getStatusIcon(job.status)}
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-black dark:text-white text-lg mb-1">{job.jobName}</h3>
                      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500 dark:text-gray-600 text-xs uppercase tracking-wider mb-1">Status</p>
                          <p className="text-black dark:text-white font-semibold text-xs">{job.status}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-600 text-xs uppercase tracking-wider mb-1">Job ID</p>
                          <p className="text-gray-700 dark:text-gray-400 font-mono text-xs truncate">
                            {job._id.substring(0, 8)}...
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-600 text-xs uppercase tracking-wider mb-1">Created</p>
                          <p className="text-gray-700 dark:text-gray-400 text-xs">{formatDate(job.createdAt)}</p>
                        </div>
                        {job.bestAffinity !== undefined && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 200 }}
                          >
                            <p className="text-gray-500 dark:text-gray-600 text-xs uppercase tracking-wider mb-1">Affinity</p>
                            <p className="text-green-600 dark:text-green-400 font-bold text-sm">{job.bestAffinity.toFixed(2)} kcal/mol</p>
                          </motion.div>
                        )}
                      </div>

                      {job.errorMessage && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="mt-3 p-3 bg-red-100 dark:bg-red-500/20 rounded-xl border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300 text-xs font-mono"
                        >
                          ERROR: {job.errorMessage}
                        </motion.div>
                      )}
                    </div>
                  </div>

                  {job.dockingResultUrl && (
                    <motion.a
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      whileTap={{ scale: 0.9 }}
                      href={job.dockingResultUrl}
                      download
                      className="p-3 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 border border-blue-200 dark:border-blue-500/30 rounded-xl transition-all flex-shrink-0"
                      title="Download results"
                    >
                      <Download className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </motion.a>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-6 pt-6 border-t border-black/5 dark:border-white/10 text-center"
      >
        <p className="text-gray-500 dark:text-gray-600 text-xs">
          {jobs.length} job{jobs.length !== 1 ? 's' : ''} in queue • Polling interval: 5s
        </p>
      </motion.div>
    </motion.div>
  );
}
