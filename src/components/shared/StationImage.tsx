'use client';

import { useState } from 'react';
import { Radio } from 'lucide-react';
import { RadioStation } from '@/types/radio';

interface StationImageProps {
  station: RadioStation;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

const StationImage: React.FC<StationImageProps> = ({ 
  station, 
  size = 'medium',
  className = '' 
}) => {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(!!station.favicon);

  const handleImageError = () => {
    console.log(`🖼️ Image failed to load for ${station.name}: ${station.favicon}`);
    setImageError(true);
    setIsLoading(false);
  };

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  // Size configurations
  const sizeClasses = {
    small: 'w-12 h-12',
    medium: 'w-14 h-14', 
    large: 'w-16 h-16'
  };

  const iconSizes = {
    small: 'w-5 h-5',
    medium: 'w-6 h-6',
    large: 'w-7 h-7'
  };

  const baseClasses = `${sizeClasses[size]} rounded-xl object-cover shadow-lg transition-all duration-200`;
  const containerClasses = `relative ${sizeClasses[size]}`;

  // If no favicon or image failed, show default icon
  if (!station.favicon || imageError) {
    return (
      <div className={`${containerClasses} ${className}`}>
        <div className={`${sizeClasses[size]} rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg`}>
          <Radio className={`${iconSizes[size]} text-white`} />
        </div>
      </div>
    );
  }

  return (
    <div className={`${containerClasses} ${className}`}>
      {isLoading && (
        <div className={`absolute inset-0 ${sizeClasses[size]} rounded-xl bg-gray-700 animate-pulse shadow-lg`} />
      )}
      <img
        src={station.favicon}
        alt={station.name}
        className={`${baseClasses} bg-gray-700 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
        onError={handleImageError}
        onLoad={handleImageLoad}
      />
    </div>
  );
};

export default StationImage; 