'use client';

import { Radio, Globe } from 'lucide-react';

export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-md shadow-soft border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Title */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center justify-center w-11 h-11 bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 rounded-xl shadow-medium">
              <Radio className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                RadioMap
              </h1>
              <p className="text-xs text-gray-400 font-medium">Discover World Radio</p>
            </div>
          </div>

          {/* Right Side Info */}
          <div className="flex items-center space-x-3 bg-gray-800 px-4 py-2 rounded-lg border border-gray-700">
            <Globe className="w-4 h-4 text-primary-400" />
            <span className="text-sm font-medium text-gray-300">Worldwide Radio Stations</span>
          </div>
        </div>
      </div>
    </header>
  );
} 