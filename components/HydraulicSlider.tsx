import React from 'react';

interface SliderProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  subText?: string;
}

const HydraulicSlider: React.FC<SliderProps> = ({ label, value, onChange, subText }) => {
  
  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(15);
    }
  };

  const stepValue = (amount: number) => {
    triggerHaptic();
    const next = Math.min(50, Math.max(0, value + amount));
    onChange(next);
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-md border-2 border-gray-300 dark:border-gray-600 mb-4 select-none">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1 pr-2">
           <h3 className="text-xl font-black text-black dark:text-white leading-tight tracking-tight">{label}</h3>
           <p className="text-base font-bold text-gray-900 dark:text-gray-200 mt-1">{subText}</p>
        </div>
        <div className="flex-none bg-blue-100 dark:bg-blue-900 px-3 py-1 rounded-lg border-2 border-blue-200 dark:border-blue-700">
          <span className="text-3xl font-black text-blue-800 dark:text-blue-200">{value}%</span>
        </div>
      </div>
      
      {/* Controls */}
      <div className="flex items-center gap-3">
        {/* Minus 5% */}
        <button 
          onClick={() => stepValue(-5)}
          className="w-16 h-16 flex-none rounded-xl bg-gray-200 dark:bg-gray-700 text-black dark:text-white active:bg-gray-300 dark:active:bg-gray-600 transition-colors flex items-center justify-center border-2 border-gray-300 dark:border-gray-500"
        >
          <span className="text-2xl font-black">−5</span>
        </button>

        {/* Slider Track */}
        <div className="flex-1 relative h-14 flex items-center px-2">
          <input 
            type="range" 
            min="0" 
            max="50" 
            step="5" 
            value={value} 
            onChange={(e) => {
              triggerHaptic();
              onChange(parseInt(e.target.value));
            }}
            className="w-full h-6 bg-gray-300 dark:bg-gray-600 rounded-full appearance-none cursor-pointer accent-blue-600 z-10 border border-gray-400 dark:border-gray-500"
            style={{
              backgroundSize: `${(value/50)*100}% 100%`, 
            }}
          />
          {/* Thumb Style Injection */}
          <style>{`
            input[type=range]::-webkit-slider-thumb {
              -webkit-appearance: none;
              height: 40px;
              width: 40px;
              border-radius: 50%;
              background: #2563eb;
              border: 4px solid white;
              box-shadow: 0 4px 6px rgba(0,0,0,0.3);
              margin-top: -10px; /* Center on h-6 track */
            }
          `}</style>
        </div>

        {/* Plus 5% */}
        <button 
          onClick={() => stepValue(5)}
          className="w-16 h-16 flex-none rounded-xl bg-blue-600 text-white active:bg-blue-700 transition-colors flex items-center justify-center shadow-md shadow-blue-600/30 border-2 border-blue-700"
        >
           <span className="text-2xl font-black">+5</span>
        </button>
      </div>
      
      {/* Legend - High Contrast */}
      <div className="flex justify-between text-sm font-black text-gray-800 dark:text-gray-300 mt-3 px-1">
        <span>良好 (0%)</span>
        <span>困難 (25%)</span>
        <span>極差 (50%)</span>
      </div>
    </div>
  );
};

export default HydraulicSlider;