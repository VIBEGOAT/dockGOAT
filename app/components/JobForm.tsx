'use client';

import React, { useState } from 'react';
import { Cloud, AlertCircle, CheckCircle } from 'lucide-react';

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
      setError('Please fill in all fields and select both files');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('userId', 'demo-user'); // In production, use actual user ID
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
        throw new Error(data.error || 'Failed to submit job');
      }

      const data = await response.json();
      setSuccess(true);
      setJobName('');
      setLigandFile(null);
      setTargetFile(null);

      // Notify parent component
      onJobSubmitted(data.jobId);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-2">
        <Cloud className="w-6 h-6 text-blue-400" />
        Submit Docking Job
      </h2>

      {error && (
        <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-200">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-900/50 border border-green-700 rounded-lg flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
          <p className="text-green-200">Job submitted successfully! Refresh to see it in the list.</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Job Name */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Job Name *
          </label>
          <input
            type="text"
            value={jobName}
            onChange={(e) => setJobName(e.target.value)}
            placeholder="e.g., Ligand A vs Protein B"
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* File Uploads */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Ligand File (.pdbqt) *
            </label>
            <input
              type="file"
              accept=".pdbqt,.sdf"
              onChange={(e) => setLigandFile(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
            />
            {ligandFile && (
              <p className="text-xs text-slate-400 mt-1">Selected: {ligandFile.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Target File (.pdbqt) *
            </label>
            <input
              type="file"
              accept=".pdbqt"
              onChange={(e) => setTargetFile(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
            />
            {targetFile && (
              <p className="text-xs text-slate-400 mt-1">Selected: {targetFile.name}</p>
            )}
          </div>
        </div>

        {/* Vina Parameters */}
        <div className="bg-slate-700/50 p-4 rounded-lg border border-slate-600">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">
            AutoDock Vina Parameters
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Center */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Center X
              </label>
              <input
                type="number"
                value={centerX}
                onChange={(e) => setCenterX(parseFloat(e.target.value))}
                step="0.1"
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Center Y
              </label>
              <input
                type="number"
                value={centerY}
                onChange={(e) => setCenterY(parseFloat(e.target.value))}
                step="0.1"
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Center Z
              </label>
              <input
                type="number"
                value={centerZ}
                onChange={(e) => setCenterZ(parseFloat(e.target.value))}
                step="0.1"
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white text-sm focus:outline-none focus:border-blue-400"
              />
            </div>

            {/* Size */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Size X
              </label>
              <input
                type="number"
                value={sizeX}
                onChange={(e) => setSizeX(parseFloat(e.target.value))}
                step="1"
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Size Y
              </label>
              <input
                type="number"
                value={sizeY}
                onChange={(e) => setSizeY(parseFloat(e.target.value))}
                step="1"
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Size Z
              </label>
              <input
                type="number"
                value={sizeZ}
                onChange={(e) => setSizeZ(parseFloat(e.target.value))}
                step="1"
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white text-sm focus:outline-none focus:border-blue-400"
              />
            </div>

            {/* Advanced */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Exhaustiveness
              </label>
              <input
                type="number"
                value={exhaustiveness}
                onChange={(e) => setExhaustiveness(parseInt(e.target.value))}
                min="1"
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Num Modes
              </label>
              <input
                type="number"
                value={numModes}
                onChange={(e) => setNumModes(parseInt(e.target.value))}
                min="1"
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Energy Range
              </label>
              <input
                type="number"
                value={energyRange}
                onChange={(e) => setEnergyRange(parseFloat(e.target.value))}
                step="0.1"
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
        >
          {loading ? 'Submitting...' : 'Submit Docking Job'}
        </button>
      </form>
    </div>
  );
}
