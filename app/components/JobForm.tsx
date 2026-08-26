'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle, Upload, Grid3x3 } from 'lucide-react';

interface JobFormProps {
  onJobSubmitted: (jobId: string) => void;
}

export default function JobForm({ onJobSubmitted }: JobFormProps) {
  const [jobName, setJobName] = useState('');
  const [ligandFile, setLigandFile] = useState<File | null>(null);
  const [targetFile, setTargetFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [centerX, setCenterX] = useState(0);
  const [centerY, setCenterY] = useState(0);
  const [centerZ, setCenterZ] = useState(0);
  const [sizeX, setSizeX] = useState(20);
  const [sizeY, setSizeY] = useState(20);
  const [sizeZ, setSizeZ] = useState(20);
  const [exhaustiveness, setExhaustiveness] = useState(8);
  const [numModes, setNumModes] = useState(9);
  const [energyRange, setEnergyRange] = useState(3.0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!jobName || !ligandFile || !targetFile) {
      setError('All fields required: target disease, ligand file, and receptor file');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('userId', 'demo-user');
      formData.append('jobName', jobName);
      formData.append('ligandFile', ligandFile);
      formData.append('targetFile', targetFile);
      formData.append('vinaParams', JSON.stringify({
        centerX: parseFloat(centerX.toString()),
        centerY: parseFloat(centerY.toString()),
        centerZ: parseFloat(centerZ.toString()),
        sizeX: parseFloat(sizeX.toString()),
        sizeY: parseFloat(sizeY.toString()),
        sizeZ: parseFloat(sizeZ.toString()),
        exhaustiveness: parseInt(exhaustiveness.toString()),
        numModes: parseInt(numModes.toString()),
        energyRange: parseFloat(energyRange.toString()),
      }));
      const response = await fetch('/api/jobs', { method: 'POST', body: formData });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Job submission failed');
      }
      const data = await response.json();
      setSuccess(true);
      setJobName('');
      setLigandFile(null);
      setTargetFile(null);
      onJobSubmitted(data.jobId);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="rounded-3xl bg-white dark:bg-[#1c1c1e] border border-black/[0.06] dark:border-white/10 p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none"
    >
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
          <Upload className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#1D1D1F] dark:text-white">Submit Docking Job</h2>
          <p className="text-sm text-[#86868B] dark:text-[#a1a1a6]">PDBQT format required</p>
        </div>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
        </motion.div>
      )}

      {success && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6 p-4 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-2xl flex items-start gap-3"
        >
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          <p className="text-green-700 dark:text-green-300 text-sm font-medium">Job queued for processing</p>
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-[#1D1D1F] dark:text-white mb-2">
            Target Disease <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={jobName}
            onChange={(e) => setJobName(e.target.value)}
            placeholder="e.g., Breast Cancer, COVID-19, Alzheimer's"
            className="w-full px-4 py-3 rounded-xl bg-[#F5F5F7] dark:bg-black/40 border border-black/[0.08] dark:border-white/10 text-[#1D1D1F] dark:text-white placeholder-[#86868B] dark:placeholder-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-blue-400/50 focus:border-transparent transition-all"
          />
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[#1D1D1F] dark:text-white mb-2">
              Ligand Structure <span className="text-red-500">*</span>
              <span className="text-[#86868B] dark:text-[#6e6e73] text-xs ml-2">.pdbqt | .sdf</span>
            </label>
            <input
              type="file"
              accept=".pdbqt,.sdf"
              onChange={(e) => setLigandFile(e.target.files?.[0] || null)}
              className="w-full px-4 py-3 rounded-xl bg-[#F5F5F7] dark:bg-black/40 border border-black/[0.08] dark:border-white/10 text-[#3a3a3c] dark:text-[#a1a1a6] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-blue-400/50 file:mr-3 file:px-4 file:py-1.5 file:border-0 file:rounded-lg file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-500/10 file:text-blue-600 dark:file:text-blue-400 hover:file:bg-blue-100 dark:hover:file:bg-blue-500/20 cursor-pointer"
            />
            {ligandFile && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> {ligandFile.name}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#1D1D1F] dark:text-white mb-2">
              Receptor Structure <span className="text-red-500">*</span>
              <span className="text-[#86868B] dark:text-[#6e6e73] text-xs ml-2">.pdbqt</span>
            </label>
            <input
              type="file"
              accept=".pdbqt"
              onChange={(e) => setTargetFile(e.target.files?.[0] || null)}
              className="w-full px-4 py-3 rounded-xl bg-[#F5F5F7] dark:bg-black/40 border border-black/[0.08] dark:border-white/10 text-[#3a3a3c] dark:text-[#a1a1a6] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-blue-400/50 file:mr-3 file:px-4 file:py-1.5 file:border-0 file:rounded-lg file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-500/10 file:text-blue-600 dark:file:text-blue-400 hover:file:bg-blue-100 dark:hover:file:bg-blue-500/20 cursor-pointer"
            />
            {targetFile && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> {targetFile.name}
              </p>
            )}
          </div>
        </div>

        <details className="group">
          <summary className="text-sm font-semibold text-[#1D1D1F] dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2 select-none">
            <Grid3x3 className="w-4 h-4" />
            Grid Center &amp; Advanced Parameters
          </summary>
          <div className="mt-4 space-y-4 pl-6">
            <div>
              <h4 className="text-xs font-semibold text-[#86868B] dark:text-[#a1a1a6] mb-3 uppercase tracking-wider">Search Space Center (Å)</h4>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'X', value: centerX, setter: setCenterX },
                  { label: 'Y', value: centerY, setter: setCenterY },
                  { label: 'Z', value: centerZ, setter: setCenterZ },
                ].map((coord) => (
                  <div key={coord.label}>
                    <label className="block text-xs font-medium text-[#3a3a3c] dark:text-[#a1a1a6] mb-1.5">Center {coord.label}</label>
                    <input
                      type="number"
                      value={coord.value}
                      onChange={(e) => coord.setter(parseFloat(e.target.value))}
                      step="0.1"
                      className="w-full px-3 py-2 rounded-lg bg-[#F5F5F7] dark:bg-black/40 border border-black/[0.08] dark:border-white/10 text-[#1D1D1F] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-blue-400/50"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-[#86868B] dark:text-[#a1a1a6] mb-3 uppercase tracking-wider">Box Size (Å)</h4>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'X', value: sizeX, setter: setSizeX },
                  { label: 'Y', value: sizeY, setter: setSizeY },
                  { label: 'Z', value: sizeZ, setter: setSizeZ },
                ].map((size) => (
                  <div key={size.label}>
                    <label className="block text-xs font-medium text-[#3a3a3c] dark:text-[#a1a1a6] mb-1.5">Size {size.label}</label>
                    <input
                      type="number"
                      value={size.value}
                      onChange={(e) => size.setter(parseFloat(e.target.value))}
                      step="1"
                      className="w-full px-3 py-2 rounded-lg bg-[#F5F5F7] dark:bg-black/40 border border-black/[0.08] dark:border-white/10 text-[#1D1D1F] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-blue-400/50"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </details>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          type="submit"
          disabled={loading}
          className="w-full px-6 py-3.5 rounded-full bg-[#1D1D1F] hover:bg-black dark:bg-blue-500 dark:hover:bg-blue-600 disabled:bg-[#86868B] dark:disabled:bg-[#3a3a3c] text-white font-semibold transition-all duration-200 shadow-lg disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <motion.svg animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </motion.svg>
              Processing...
            </span>
          ) : 'Submit to Queue'}
        </motion.button>

        <p className="text-xs text-[#86868B] dark:text-[#6e6e73] text-center">
          Estimated runtime: 5-15 minutes per ligand
        </p>
      </form>
    </motion.div>
  );
}
