import React from 'react';

interface RatingSliderProps {
  label: string;
  description: string;
  value: number;
  onChange: (val: number) => void;
}

export const RatingSlider: React.FC<RatingSliderProps> = ({ label, description, value, onChange }) => {
  return (
    <div className="mb-6">
      <div className="flex justify-between items-baseline mb-2">
        <label className="text-sm font-semibold text-slate-700">{label}</label>
        <span className="text-indigo-600 font-mono text-lg font-bold">{value}/5</span>
      </div>
      <p className="text-xs text-slate-500 mb-3">{description}</p>
      <div className="relative h-2 bg-slate-200 rounded-full">
        <div 
          className="absolute h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300 shadow-sm"
          style={{ width: `${(value / 5) * 100}%` }}
        />
        <input
          type="range"
          min="1"
          max="5"
          step="0.5"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute w-full h-full opacity-0 cursor-pointer"
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-400 mt-1 uppercase tracking-wider">
        <span>极差</span>
        <span>极佳</span>
      </div>
    </div>
  );
};