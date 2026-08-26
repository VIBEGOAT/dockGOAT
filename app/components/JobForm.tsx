'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle, Target, Upload, Grid3x3 } from 'lucide-react';

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
      transition={{ duration: 0.5 }}
      className="bg-gradient-to-br from-slate-800/90 to-indigo-950/90 backdrop-blur-sm rounded-xl border border-indigo-500/30 p-6 shadow-xl shadow-indigo-500/10"
    >
      <div className="flex items-center gap-3 mb-6">
        <motion.div 
          whileHover={{ scale: 1.1, rotate: 360 }}
          transition={{ duration: 0.5 }}
          className="p-2 bg-indigo-500/20 rounded-lg border border-indigo-500/40"
        >
          <Target className="w-5 h-5 text-indigo-300" />
        </motion.div>
        <div>
          <h2 className="text-xl font-bold text-indigo-300">Submit Docking Job</h2>
          <p className="text-xs text-gray-400 font-mono">PDBQT format required</p>
        </div>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-4 p-4 bg-red-900/30 border border-red-500/50 rounded-lg flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-300 text-sm">{error}</p>
        </motion.div>
      )}

      {success && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-4 p-4 bg-emerald-900/30 border border-emerald-500/50 rounded-lg flex items-start gap-3"
        >
          <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <p className="text-emerald-300 text-sm font-medium">Job queued for processing</p>
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Target Disease */}
        <div>
          <label className="block text-sm font-semibold text-cyan-300 mb-2">
            Target Disease <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={jobName}
            onChange={(e) => setJobName(e.target.value)}
            placeholder="e.g., Breast Cancer, SARS-CoV-2, Alzheimer's Disease"
            className="w-full px-4 py-2.5 bg-slate-900/80 border border-indigo-500/30 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent font-mono text-sm transition-all"
          />
        </div>

        {/* File Uploads */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-cyan-300 mb-2">
              Ligand Structure <span className="text-red-400">*</span>
              <span className="text-gray-500 text-xs ml-2">.pdbqt | .sdf</span>
            </label>
            <div className="relative">
              <input
                type="file"
                accept=".pdbqt,.sdf"
                onChange={(e) => setLigandFile(e.target.files?.[0] || null)}
                className="w-full px-4 py-2.5 bg-slate-900/80 border border-cyan-500/30 rounded-lg text-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 file:mr-3 file:px-4 file:py-1.5 file:border-0 file:rounded file:text-sm file:font-semibold file:bg-cyan-500/20 file:text-cyan-300 hover:file:bg-cyan-500/30 cursor-pointer font-mono"
              />
              {ligandFile && (
                <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1 font-mono">
                  <CheckCircle className="w-3 h-3" /> {ligandFile.name}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-cyan-300 mb-2">
              Receptor Structure <span className="text-red-400">*</span>
              <span className="text-gray-500 text-xs ml-2">.pdbqt</span>
            </label>
            <div className="relative">
              <input
                type="file"
                accept=".pdbqt"
                onChange={(e) => setTargetFile(e.target.files?.[0] || null)}
                className="w-full px-4 py-2.5 bg-slate-900/80 border border-cyan-500/30 rounded-lg text-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 file:mr-3 file:px-4 file:py-1.5 file:border-0 file:rounded file:text-sm file:font-semibold file:bg-cyan-500/20 file:text-cyan-300 hover:file:bg-cyan-500/30 cursor-pointer font-mono"
              />
              {targetFile && (
                <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1 font-mono">
                  <CheckCircle className="w-3 h-3" /> {targetFile.name}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Grid Center Configuration */}
        <div className="space-y-3 border-t border-cyan-500/20 pt-5">
          <details className="group" open>
            <summary className="text-sm font-semibold text-cyan-300 cursor-pointer hover:text-cyan-200 transition-colors flex items-center gap-2">
              <Grid3x3 className="w-4 h-4" />
              Grid Center & Box Dimensions
            </summary>
            <div className="mt-4 space-y-4">
              {/* Grid Center Coordinates */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">Search Space Center (Å)</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-cyan-400 mb-1.5">
                      Center X
                    </label>
                    <input
                      type="number"
                      value={centerX}
                      onChange={(e) => setCenterX(parseFloat(e.target.value))}
                      step="0.1"
                      className="w-full px-3 py-2 bg-slate-900/80 border border-cyan-500/30 rounded text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-cyan-400 mb-1.5">
                      Center Y
                    </label>
                    <input
                      type="number"
                      value={centerY}
                      onChange={(e) => setCenterY(parseFloat(e.target.value))}
                      step="0.1"
                      className="w-full px-3 py-2 bg-slate-900/80 border border-cyan-500/30 rounded text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-cyan-400 mb-1.5">
                      Center Z
                    </label>
                    <input
                      type="number"
                      value={centerZ}
                      onChange={(e) => setCenterZ(parseFloat(e.target.value))}
                      step="0.1"
                      className="w-full px-3 py-2 bg-slate-900/80 border border-cyan-500/30 rounded text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Box Dimensions */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">Box Size (Å)</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-emerald-400 mb-1.5">
                      Size X
                    </label>
                    <input
                      type="number"
                      value={sizeX}
                      onChange={(e) => setSizeX(parseFloat(e.target.value))}
                      step="1"
                      className="w-full px-3 py-2 bg-slate-900/80 border border-emerald-500/30 rounded text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-emerald-400 mb-1.5">
                      Size Y
                    </label>
                    <input
                      type="number"
                      value={sizeY}
                      onChange={(e) => setSizeY(parseFloat(e.target.value))}
                      step="1"
                      className="w-full px-3 py-2 bg-slate-900/80 border border-emerald-500/30 rounded text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-emerald-400 mb-1.5">
                      Size Z
                    </label>
                    <input
                      type="number"
                      value={sizeZ}
                      onChange={(e) => setSizeZ(parseFloat(e.target.value))}
                      step="1"
                      className="w-full px-3 py-2 bg-slate-900/80 border border-emerald-500/30 rounded text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Vina Algorithm Parameters */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">Algorithm Parameters</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-blue-400 mb-1.5">
                      Exhaustiveness
                    </label>
                    <input
                      type="number"
                      value={exhaustiveness}
                      onChange={(e) => setExhaustiveness(parseInt(e.target.value))}
                      min="1"
                      max="32"
                      className="w-full px-3 py-2 bg-slate-900/80 border border-blue-500/30 rounded text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-blue-400 mb-1.5">
                      Num Modes
                    </label>
                    <input
                      type="number"
                      value={numModes}
                      onChange={(e) => setNumModes(parseInt(e.target.value))}
                      min="1"
                      max="20"
                      className="w-full px-3 py-2 bg-slate-900/80 border border-blue-500/30 rounded text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-blue-400 mb-1.5">
                      Energy Range
                    </label>
                    <input
                      type="number"
                      value={energyRange}
                      onChange={(e) => setEnergyRange(parseFloat(e.target.value))}
                      step="0.1"
                      className="w-full px-3 py-2 bg-slate-900/80 border border-blue-500/30 rounded text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          </details>
        </div>

        {/* Submit Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={loading}
          className="w-full px-4 py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 disabled:from-gray-600 disabled:to-gray-600 text-white font-bold rounded-lg transition-all duration-200 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 disabled:cursor-not-allowed font-mono uppercase tracking-wider text-sm"
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

        <p className="text-xs text-gray-500 text-center font-mono">
          Estimated runtime: 5-15 minutes per ligand
        </p>
      </form>
    </motion.div>
  );
}
