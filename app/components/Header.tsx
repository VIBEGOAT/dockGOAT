import React from 'react';
import { Atom, Github } from 'lucide-react';

export default function Header() {
  return (
    <header className="border-b border-cyan-900/40 bg-slate-900/95 backdrop-blur-md sticky top-0 z-50 shadow-lg shadow-cyan-900/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 rounded-lg border border-cyan-500/40 shadow-lg shadow-cyan-500/20">
              <Atom className="w-6 h-6 text-cyan-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-300 to-emerald-300 tracking-tight">
                dockGOAT
              </h1>
              <p className="text-xs text-gray-400 font-mono tracking-wider">COMPUTATIONAL DRUG DISCOVERY</p>
            </div>
          </div>

          <nav className="flex items-center gap-6 text-sm">
            <a 
              href="https://github.com/VIBEGOAT/dockGOAT" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center gap-2 text-gray-400 hover:text-cyan-300 font-medium transition-colors"
            >
              <Github className="w-4 h-4" />
              <span className="hidden sm:inline">Repository</span>
            </a>
            <a href="#" className="text-gray-400 hover:text-cyan-300 font-medium transition-colors font-mono">
              DOCS
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
}
