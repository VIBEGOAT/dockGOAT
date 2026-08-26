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

  // Vina parameters
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
      formData.append(
        'vinaParams',
        JSON.stringify({
          centerX: parseFloat(centerX.toString()),
          centerY: parseFloat(centerY.toString()),
          centerZ: parseFloat(centerZ.toString()),
          sizeX: parseFloat(sizeX.toString()),
          sizeY: parseFloat(sizeY.toString()),
          sizeZ: parseFloat(sizeZ.toString()),
          exhaustiveness: parseInt(exhaustiveness.toString()),
          numModes: parseInt(numModes.toString()),
          energyRange: parseFloat(energyRange.toString()),
        })
      );

      const response = await fetch('/api/jobs', {
        method: 'POST',
        body: formData,
      });

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
      className="rounded-3xl bg-white dark:bg-[#1c1c1e] border border-black/5 dark:border-white/10 p-8 shadow-sm"
    >
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
          <Upload className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-black dark:text-white">Submit Docking Job</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">PDBQT format required</p>
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
        {/* Target Disease */}
        <div>
          <label className="block text-sm font-semibold text-black dark:text-white mb-2">
            Target Disease <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={jobName}
            onChange={(e) => setJobName(e.target.value)}
            placeholder="e.g., Breast Cancer, COVID-19, Alzheimer's"
            className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 text-black dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:focus:ring-blue-400/50 focus:border-transparent transition-all"
          />
        </div>

        {/* File Uploads */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-black dark:text-white mb-2">
              Ligand Structure <span className="text-red-500">*</span>
              <span className="text-gray-500 dark:text-gray-500 text-xs ml-2">.pdbqt | .sdf</span>
            </label>
            <div className="relative">
              <input
                type="file"
                accept=".pdbqt,.sdf"
                onChange={(e) => setLigandFile(e.target.files?.[0] || null)}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:focus:ring-blue-400/50 file:mr-3 file:px-4 file:py-1.5 file:border-0 file:rounded-lg file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-500/10 file:text-blue-600 dark:file:text-blue-400 hover:file:bg-blue-100 dark:hover:file:bg-blue-500/20 cursor-pointer"
              />
              {ligandFile && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> {ligandFile.name}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-black dark:text-white mb-2">
              Receptor Structure <span className="text-red-500">*</span>
              <span className="text-gray-500 dark:text-gray-500 text-xs ml-2">.pdbqt</span>
            </label>
            <div className="relative">
              <input
                type="file"
                accept=".pdbqt"
                onChange={(e) => setTargetFile(e.target.files?.[0] || null)}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:focus:ring-blue-400/50 file:mr-3 file:px-4 file:py-1.5 file:border-0 file:rounded-lg file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-500/10 file:text-blue-600 dark:file:text-blue-400 hover:file:bg-blue-100 dark:hover:file:bg-blue-500/20 cursor-pointer"
              />
              {targetFile && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> {targetFile.name}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Advanced Parameters */}
        <details className="group">
          <summary className="text-sm font-semibold text-black dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2 select-none">
            <Grid3x3 className="w-4 h-4" />
            Grid Center & Advanced Parameters
          </summary>
          <div className="mt-4 space-y-4 pl-6">
            {/* Grid Center */}
            <div>
              <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-3 uppercase tracking-wider">Search Space Center (Å)</h4>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'X', value: centerX, setter: setCenterX },
                  { label: 'Y', value: centerY, setter: setCenterY },
                  { label: 'Z', value: centerZ, setter: setCenterZ },
                ].map((coord) => (
                  <div key={coord.label}>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-400 mb-1.5">
                      Center {coord.label}
                    </label>
                    <input
                      type="number"
                      value={coord.value}
                      onChange={(e) => coord.setter(parseFloat(e.target.value))}
                      step="0.1"
                      className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 text-black dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:focus:ring-blue-400/50"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Box Size */}
            <div>
              <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-3 uppercase tracking-wider">Box Size (Å)</h4>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'X', value: sizeX, setter: setSizeX },
                  { label: 'Y', value: sizeY, setter: setSizeY },
                  { label: 'Z', value: sizeZ, setter: setSizeZ },
                ].map((size) => (
                  <div key={size.label}>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-400 mb-1.5">
                      Size {size.label}
                    </label>
                    <input
                      type="number"
                      value={size.value}
                      onChange={(e) => size.setter(parseFloat(e.target.value))}
                      step="1"
                      className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 text-black dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:focus:ring-blue-400/50"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </details>

        {/* Submit Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          type="submit"
          disabled={loading}
          className="w-full px-6 py-3.5 rounded-full bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 disabled:bg-gray-400 dark:disabled:bg-gray-700 text-white font-semibold transition-all duration-200 shadow-lg hover:shadow-xl disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <motion.svg
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="h-5 w-5"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </motion.svg>
              Processing...
            </span>
          ) : (
            'Submit to Queue'
          )}
        </motion.button>

        <p className="text-xs text-gray-500 dark:text-gray-600 text-center">
          Estimated runtime: 5-15 minutes per ligand
        </p>
      </form>
    </motion.div>
  );
}
