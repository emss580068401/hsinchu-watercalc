import React, { useRef } from 'react';

interface StepperProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  step?: number;
  min?: number;
  subLabel?: string;
  colorClass?: string;
  statusColor?: string;
}

const Stepper: React.FC<StepperProps> = ({ 
  label, 
  value, 
  onChange, 
  step = 1, 
  min = 0, 
  subLabel,
  colorClass = "bg-white dark:bg-gray-800",
  statusColor
}) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(15);
    }
  };

  const handleStep = (amount: number) => {
    const newValue = Math.max(min, parseFloat((value + amount).toFixed(2)));
    onChange(newValue);
  };

  const startContinuousChange = (amount: number) => {
    triggerHaptic();
    handleStep(amount);
    timerRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        triggerHaptic();
        handleStep(amount);
      }, 100);
    }, 500);
  };

  const stopContinuousChange = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  // Handle manual input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      onChange(0); 
      return;
    }
    const num = parseFloat(val);
    if (!isNaN(num)) {
      onChange(num);
    }
  };

  return (
    <div className={`p-4 rounded-2xl shadow-md border-2 border-gray-300 dark:border-gray-600 mb-4 select-none ${colorClass}`}>
      {/* Header Label Row */}
      <div className="flex justify-between items-baseline mb-3 px-1">
        <div className="flex items-center gap-2">
          {statusColor && (
            <span className={`w-3 h-3 rounded-full ${statusColor} ring-1 ring-offset-1 ring-gray-300 dark:ring-gray-600`}></span>
          )}
          <label className="text-xl font-black text-black dark:text-white tracking-tight">{label}</label>
        </div>
        {subLabel && <span className="text-base text-gray-900 dark:text-gray-200 font-bold">{subLabel}</span>}
      </div>
      
      {/* Control Row */}
      <div className="flex items-stretch h-20 gap-3">
        {/* Minus Button */}
        <button 
          onPointerDown={(e) => {
            e.preventDefault();
            startContinuousChange(-step);
          }}
          onPointerUp={stopContinuousChange}
          onPointerLeave={stopContinuousChange}
          onContextMenu={(e) => e.preventDefault()}
          className="w-24 flex-none rounded-xl bg-gray-200 dark:bg-gray-700 text-black dark:text-white active:bg-red-600 active:text-white active:scale-95 transition-all flex items-center justify-center shadow-sm border-2 border-gray-300 dark:border-gray-500"
          type="button"
          aria-label="Decrease"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={4} stroke="currentColor" className="w-8 h-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
          </svg>
        </button>
        
        {/* Value Display - Manual Input Enabled */}
        <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900 border-2 border-gray-400 dark:border-gray-500 rounded-xl relative overflow-hidden">
           <input
            type="number"
            inputMode="decimal"
            step="any"
            value={value}
            onChange={handleInputChange}
            onFocus={(e) => e.target.select()} // Auto-select content on click
            className="w-full h-full text-center text-4xl font-black bg-transparent text-blue-800 dark:text-blue-300 outline-none placeholder-gray-300" 
          />
        </div>

        {/* Plus Button */}
        <button 
          onPointerDown={(e) => {
            e.preventDefault();
            startContinuousChange(step);
          }}
          onPointerUp={stopContinuousChange}
          onPointerLeave={stopContinuousChange}
          onContextMenu={(e) => e.preventDefault()}
          className="w-24 flex-none rounded-xl bg-blue-600 text-white active:bg-blue-700 active:scale-95 transition-all flex items-center justify-center shadow-md shadow-blue-600/30 border-2 border-blue-700"
          type="button"
          aria-label="Increase"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={4} stroke="currentColor" className="w-8 h-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Stepper;