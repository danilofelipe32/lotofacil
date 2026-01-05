
import React from 'react';

interface NumberBallProps {
  number: number;
  highlighted?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const NumberBall: React.FC<NumberBallProps> = ({ number, highlighted = false, size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-xl font-bold'
  };

  return (
    <div className={`
      flex items-center justify-center rounded-full border-2 transition-all duration-300
      ${highlighted 
        ? 'bg-emerald-500 border-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)] scale-110' 
        : 'bg-gray-800 border-gray-600 text-gray-400'}
      ${sizeClasses[size]}
    `}>
      {number.toString().padStart(2, '0')}
    </div>
  );
};

export default NumberBall;
