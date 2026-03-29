
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ResponsiveContainer, Cell, PieChart, Pie, Legend, Tooltip } from 'recharts';
import Stepper from './components/Stepper';
import InfoModal from './components/InfoModal';
import HydraulicSlider from './components/HydraulicSlider';
import { calculateAll } from './utils/calculations';
import { WaterState } from './types';
import { INITIAL_STATE, MAP_CENTER_LAT, MAP_CENTER_LNG, MAP_MID } from './constants';

const STORAGE_KEY = 'emeiWaterCalcV3';

const TABS = [
  { id: 'demand', label: '用水需求', icon: '🔥' },
  { id: 'tanks', label: '水箱容量', icon: '💧' },
  { id: 'sources', label: '現場水源', icon: '🚰' },
  { id: 'relay', label: '循環條件', icon: '🔄' },
  { id: 'result', label: '計算結果', icon: '📊' }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('demand');
  const [state, setState] = useState<WaterState>(INITIAL_STATE);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [selectedSlice, setSelectedSlice] = useState<string | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [presetModalMode, setPresetModalMode] = useState<'none' | 'load' | 'save'>('none');
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editingPresetName, setEditingPresetName] = useState<string>('');
  const [activePresetTab, setActivePresetTab] = useState<string>('emeiPresetA');
  const [confirmClearSlotId, setConfirmClearSlotId] = useState<string | null>(null);
  const [speedsOpen, setSpeedsOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const touchStartRef = useRef<{x: number, y: number, time: number} | null>(null);
  
  const PRESET_SLOTS = [ 'emeiPresetA', 'emeiPresetB', 'emeiPresetC', 'emeiPresetD', 'emeiPresetE' ];
  const DEFAULT_PRESET_NAMES: Record<string, string> = {
     'emeiPresetA': '情境 1',
     'emeiPresetB': '情境 2',
     'emeiPresetC': '情境 3',
     'emeiPresetD': '情境 4',
     'emeiPresetE': '情境 5',
  };

  // Persistence
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setState(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load state", e);
      }
    }

    // Check system dark mode
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Screen Wake Lock
  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator) {
        try {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        } catch (err) {
          console.error(err);
        }
      }
    };
    requestWakeLock();
    
    // Re-acquire lock if visibility changes (e.g., switching apps)
    const handleVisibilityChange = () => {
       if (document.visibilityState === 'visible') {
         requestWakeLock();
       }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (wakeLock) wakeLock.release();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const toggleDark = () => {
    if (navigator.vibrate) navigator.vibrate(15);
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  const update = (key: keyof WaterState, val: number) => {
    setState(prev => ({ ...prev, [key]: val }));
  };

  const confirmReset = () => {
    if (navigator.vibrate) navigator.vibrate([15, 50, 15]);
    setState(INITIAL_STATE);
    setIsResetModalOpen(false);
  };

  const handleTabChange = (id: string) => {
     if (navigator.vibrate) navigator.vibrate(15);
     setActiveTab(id);
  };

  // Swipe navigation
  const TAB_IDS = TABS.map(t => t.id);
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;
    // Must be horizontal swipe: |dx| > 60, |dy| < |dx|, within 400ms
    if (Math.abs(dx) > 60 && Math.abs(dy) < Math.abs(dx) * 0.8 && dt < 400) {
      const curIdx = TAB_IDS.indexOf(activeTab);
      if (dx < 0 && curIdx < TAB_IDS.length - 1) {
        handleTabChange(TAB_IDS[curIdx + 1]);
      } else if (dx > 0 && curIdx > 0) {
        handleTabChange(TAB_IDS[curIdx - 1]);
      }
    }
  };

  // Toast auto-dismiss
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2200);
  };

  // PWA Install Prompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
      // Only show banner if user hasn't dismissed it this session
      if (!sessionStorage.getItem('pwa-banner-dismissed')) {
        setShowInstallBanner(true);
      }
    };
    window.addEventListener('beforeinstallprompt', handler);
    // Also check if already captured
    if ((window as any).__deferredPrompt) {
      setDeferredInstallPrompt((window as any).__deferredPrompt);
      if (!sessionStorage.getItem('pwa-banner-dismissed')) {
        setShowInstallBanner(true);
      }
    }
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Real-time calculation
  const res = useMemo(() => calculateAll(state), [state]);
  
  // Duration formatting helper (prevents 60s edge case)
  const durationDisplay = useMemo(() => {
    if (!isFinite(res.durationMin)) return { m: '-', s: '-' };
    const totalSeconds = Math.round(res.durationMin * 60);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return { m, s };
  }, [res.durationMin]);

  // Map helpers
  const openMap = (type: 'google' | 'mymaps') => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const url = type === 'google' 
          ? `https://www.google.com/maps/@${lat},${lng},15z`
          : `https://www.google.com/maps/d/viewer?mid=${MAP_MID}&ll=${lat}%2C${lng}&z=15`;
        window.open(url, '_blank');
      },
      () => {
         const url = type === 'google' 
          ? `https://www.google.com/maps/@${MAP_CENTER_LAT},${MAP_CENTER_LNG},14z`
          : `https://www.google.com/maps/d/viewer?mid=${MAP_MID}&ll=${MAP_CENTER_LAT}%2C${MAP_CENTER_LNG}&z=14`;
        window.open(url, '_blank');
      }
    );
  };

  // Copy Report Function
  const copyReport = () => {
    if (navigator.vibrate) navigator.vibrate(15);
    const timeStr = res.net <= 0 
      ? '充足 ∞' 
      : durationDisplay.m !== '-' 
        ? `${durationDisplay.m}分${durationDisplay.s}秒` 
        : '-';

    const text = `[水源計算機報表]
總需求: ${Math.round(res.demand)} gpm
總供給: ${Math.round(res.qFrontline + res.circEff)} gpm
淨需求: ${Math.round(res.net)} gpm (${res.net > 0 ? '不足' : '充足'})
水箱撐時: ${timeStr}
供需覆蓋率: ${Math.round(res.coverage)}%`;
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('✅ 報表已複製！可直接貼上');
      }).catch(() => {
        showToast('❌ 複製失敗，請手動截圖');
      });
    } else {
      showToast('❌ 您的瀏覽器不支援自動複製');
    }
  };

  // Ensure chart data values are integers
  const pieDataVisual = [
      { name: '現場', value: Math.round(res.qFrontline), fill: '#3b82f6' },
      { name: '循環', value: Math.round(res.circEff), fill: '#22c55e' },
      { name: '淨需求', value: Math.round(res.net), fill: '#ef4444' }
  ].filter(d => d.value > 0);

  const idleTime = Math.max(0, res.overallInterval - res.tFillSource);

  // Color for coverage bar
  const getCoverageColor = (p: number) => {
    if (p >= 100) return 'bg-green-500';
    if (p >= 70) return 'bg-orange-500';
    return 'bg-red-600';
  };

  // Calculate Status Color for Relay Trucks
  const getRelayStatusColor = (compression: number, count: number) => {
    if (count <= 0) return "bg-gray-300 dark:bg-gray-600"; // Inactive
    if (compression >= 0.95) return "bg-green-500"; // Efficient
    if (compression >= 0.7) return "bg-yellow-500"; // Warning
    return "bg-red-500"; // Bottleneck/Inefficient
  };

  const renderTruckDetail = (count: number, stats: {tFill: number, tDrive: number, tc: number}, label: string) => {
    if (count <= 0) return null;
    const efficiencyPercent = Math.round(res.compression * 100);
    const effColor = getRelayStatusColor(res.compression, 1);
    
    return (
      <div className="mx-2 mb-4 -mt-2 bg-gray-100 dark:bg-slate-800/50 rounded-b-xl border-x-2 border-b-2 border-gray-300 dark:border-slate-600 overflow-hidden">
        <div className="p-3 grid grid-cols-2 gap-x-2 gap-y-1 text-sm font-bold text-gray-700 dark:text-gray-300">
          <div>加滿: <span className="text-black dark:text-white">{isFinite(stats.tFill) ? stats.tFill.toFixed(1) : '-'}</span> 分</div>
          <div>行駛: <span className="text-black dark:text-white">{stats.tDrive.toFixed(1)}</span> 分</div>
          <div>工作: <span className="text-black dark:text-white">{state.modWork.toFixed(1)}</span> 分</div>
          <div className="col-span-2 border-t border-gray-300 dark:border-slate-600 mt-1 pt-1 text-center text-blue-800 dark:text-blue-300">
            總圈: <span className="font-black text-base">{isFinite(stats.tc) ? stats.tc.toFixed(1) : '-'}</span> 分
          </div>
        </div>
        
        {/* Efficiency Bar Visual */}
        <div className="px-3 pb-3">
           <div className="flex justify-between text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
              <span>供水效能 (壓縮比)</span>
              <span>{efficiencyPercent}%</span>
           </div>
           <div className="w-full h-2 bg-gray-300 dark:bg-gray-600 rounded-full overflow-hidden">
             <div 
               className={`h-full transition-all duration-500 ${effColor}`} 
               style={{ width: `${efficiencyPercent}%` }}
             ></div>
           </div>
        </div>
      </div>
    );
  };

  // Render Detail View for Pie Chart
  const renderSliceDetail = () => {
    if (!selectedSlice) return null;
    
    const frontFactor = 1 - state.frontReducePct / 100;

    // Dynamic styling based on selection
    let containerClasses = "bg-gray-100 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600";
    let headerColor = "text-black dark:text-white";

    if (selectedSlice === '現場') {
      containerClasses = "bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-400 ring-4 ring-blue-500/10";
      headerColor = "text-blue-800 dark:text-blue-200";
    } else if (selectedSlice === '循環') {
      containerClasses = "bg-green-50 dark:bg-green-900/20 border-green-500 dark:border-green-400 ring-4 ring-green-500/10";
      headerColor = "text-green-800 dark:text-green-200";
    } else if (selectedSlice === '淨需求') {
      containerClasses = "bg-red-50 dark:bg-red-900/20 border-red-500 dark:border-red-400 ring-4 ring-red-500/10";
      headerColor = "text-red-800 dark:text-red-200";
    }

    return (
      <div className={`mt-4 p-4 rounded-xl border-2 animate-fade-in text-left transition-all ${containerClasses}`}>
        <div className="flex justify-between items-center mb-3">
          <h4 className={`font-black text-xl ${headerColor}`}>{selectedSlice}細節</h4>
          <button 
            onClick={(e) => { e.stopPropagation(); setSelectedSlice(null); }}
            className="w-10 h-10 flex items-center justify-center bg-white/50 dark:bg-black/20 rounded-full text-gray-900 dark:text-gray-100 active:scale-95 font-bold text-xl hover:bg-white/80 dark:hover:bg-black/40 transition-colors"
          >
            ✕
          </button>
        </div>

        {selectedSlice === '現場' && (
           <div className="space-y-3">
             {[
               { l: '消防栓', v: state.hydrant * state.hydrantFlow },
               { l: '小型車抽水', v: state.smallPump * state.smallPumpFlow },
               { l: '一般車抽水', v: state.normalPump * state.normalFlow },
               { l: '水庫車抽水', v: state.reservoirPump * state.reservoirPumpFlow },
               { l: '移動幫浦', v: state.portablePump * state.portablePumpFlow },
             ].filter(i => i.v > 0).length === 0 ? (
               <div className="text-gray-600 dark:text-gray-300 font-black text-lg">未設定現場水源</div>
             ) : (
               [
                 { l: '消防栓', v: state.hydrant * state.hydrantFlow },
                 { l: '小型車抽水', v: state.smallPump * state.smallPumpFlow },
                 { l: '一般車抽水', v: state.normalPump * state.normalFlow },
                 { l: '水庫車抽水', v: state.reservoirPump * state.reservoirPumpFlow },
                 { l: '移動幫浦', v: state.portablePump * state.portablePumpFlow },
               ].filter(i => i.v > 0).map((item, idx) => (
                 <div key={idx} className="flex justify-between text-lg font-black text-black dark:text-white border-b border-gray-300 dark:border-gray-600 last:border-0 pb-2 last:pb-0">
                   <span>{item.l}</span>
                   <span>{Math.round(item.v * frontFactor)} <span className="text-base font-black text-gray-600 dark:text-gray-400">gpm</span></span>
                 </div>
               ))
             )}
             <div className="pt-2 text-sm text-right text-gray-600 dark:text-gray-400 font-bold">
               *已套用前方折減 {state.frontReducePct}%
             </div>
           </div>
        )}

        {selectedSlice === '循環' && (
            <div className="space-y-3">
              {[
                { l: '2噸車', n: state.modN2, q: res.relayStats.q2 },
                { l: '4噸車', n: state.modN4, q: res.relayStats.q4 },
                { l: '10噸車', n: state.modN10, q: res.relayStats.q10 },
                { l: '12噸車', n: state.modN12, q: res.relayStats.q12 },
              ].filter(i => i.n > 0).length === 0 ? (
                <div className="text-gray-600 dark:text-gray-300 font-black text-lg">未投入循環車輛</div>
              ) : (
                 [
                  { l: '2噸車', n: state.modN2, q: res.relayStats.q2 },
                  { l: '4噸車', n: state.modN4, q: res.relayStats.q4 },
                  { l: '10噸車', n: state.modN10, q: res.relayStats.q10 },
                  { l: '12噸車', n: state.modN12, q: res.relayStats.q12 },
                ].filter(i => i.n > 0).map((item, idx) => (
                  <div key={idx} className="flex justify-between text-lg font-black text-black dark:text-white border-b border-gray-300 dark:border-gray-600 last:border-0 pb-2 last:pb-0">
                    <span>{item.l} <span className="text-base font-black text-gray-600 dark:text-gray-400">x{item.n}</span></span>
                    <span>{Math.round(item.n * item.q)} <span className="text-base font-black text-gray-600 dark:text-gray-400">gpm</span></span>
                  </div>
                ))
              )}
              <div className="pt-2 text-sm text-right text-gray-600 dark:text-gray-400 font-bold">
                 *受水源與後方折減限制
              </div>
            </div>
        )}

        {selectedSlice === '淨需求' && (
            <div className="space-y-3">
               <div className="flex justify-between text-lg font-black text-black dark:text-white">
                  <span>總需求</span>
                  <span>{Math.round(res.demand)} <span className="text-base font-black text-gray-600 dark:text-gray-400">gpm</span></span>
               </div>
               <div className="flex justify-between text-lg font-black text-blue-700 dark:text-blue-300">
                  <span>總供給 (現場+循環)</span>
                  <span>-{Math.round(res.qFrontline + res.circEff)} <span className="text-base font-black text-gray-600 dark:text-gray-400">gpm</span></span>
               </div>
               <div className="border-t-2 border-gray-300 dark:border-gray-600 my-1"></div>
               <div className="flex justify-between text-xl font-black text-red-600 dark:text-red-400">
                  <span>淨需求</span>
                  <span>{Math.round(res.net)} <span className="text-base font-black text-red-500 dark:text-red-300">gpm</span></span>
               </div>
               <div className="pt-1 text-sm text-gray-600 dark:text-gray-400 font-bold">
                 需消耗水箱水源，請參考「水箱撐時」。
               </div>
            </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 transition-colors duration-200 font-sans">
      
      {/* Combined Top App Bar (Title + Nav) */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md shadow-md border-b border-gray-200 dark:border-gray-800 transition-colors">
        {/* Top Header Row */}
        <header className="h-[60px] md:h-16 flex items-center justify-between px-2 max-w-md mx-auto w-full gap-2">
          {/* Menu Button */}
          <button 
            onClick={() => { if (navigator.vibrate) navigator.vibrate(15); setIsInfoOpen(true); }} 
            className="h-10 w-12 flex items-center justify-center bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 rounded-xl active:scale-95 transition-transform border-2 border-blue-200 dark:border-blue-800 shrink-0 shadow-sm"
          >
            <span className="text-2xl leading-none font-bold">☰</span>
          </button>
          
          {/* Global Quick Actions */}
          <div className="flex-1 flex gap-1.5 justify-center">
            <button
              onClick={() => { if(navigator.vibrate) navigator.vibrate(15); setPresetModalMode('load'); }} 
              className="flex-1 h-10 px-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 rounded-xl font-black text-[13px] sm:text-base flex justify-center items-center gap-1 active:scale-95 transition-transform border border-blue-200 dark:border-blue-800 whitespace-nowrap"
            >
               <span>📂</span> <span className="leading-none mt-0.5">載入</span>
            </button>
            <button
              onClick={() => { if(navigator.vibrate) navigator.vibrate(15); setPresetModalMode('save'); }} 
              className="flex-1 h-10 px-1 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-xl font-black text-[13px] sm:text-base flex justify-center items-center gap-1 active:scale-95 transition-transform border border-gray-300 dark:border-gray-700 whitespace-nowrap"
            >
               <span>💾</span> <span className="leading-none mt-0.5">儲存</span>
            </button>
            <button
              onClick={() => window.open('https://water.ezoomcloud.com/distribution-map', '_blank')}
              className="flex-[1.1] h-10 px-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-[14px] sm:text-base flex justify-center items-center gap-1 active:scale-95 transition-transform shadow-sm whitespace-nowrap"
            >
               <span>🗺️</span> <span className="leading-none mt-0.5">地圖</span>
            </button>
          </div>
          
          {/* Dark Mode */}
          <button 
            onClick={toggleDark} 
            className="h-10 w-10 shrink-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-xl text-xl active:scale-95 transition-transform border-2 border-gray-200 dark:border-gray-700 shadow-sm"
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        </header>

        {/* Navigation Tabs */}
        <nav className="flex justify-around items-center h-[72px] max-w-md mx-auto w-full px-1 border-t border-gray-100 dark:border-gray-800">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex flex-col items-center justify-center w-full h-full transition-colors active:scale-95 ${
                  isActive ? 'text-blue-600 dark:text-blue-400 font-black' : 'text-gray-500 dark:text-gray-400 font-bold hover:bg-gray-50 dark:hover:bg-gray-800/10'
                }`}
              >
                <div className={`text-[2rem] leading-none mb-1 transition-transform duration-200 ${isActive ? 'scale-[1.15] -translate-y-1 shadow-sm drop-shadow-md' : ''}`}>{tab.icon}</div>
                <div className="text-xs tracking-widest">{tab.label.substring(0, 2)}</div>
              </button>
            )
          })}
        </nav>
      </div>

      <InfoModal isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />

      {/* Custom Large Reset Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center isolate">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsResetModalOpen(false)}></div>
          <div className="relative bg-white dark:bg-gray-800 p-6 rounded-3xl w-[90%] max-w-sm shadow-2xl border-2 border-gray-300 dark:border-gray-600 animate-fade-in">
             <h3 className="text-2xl font-black text-center mb-4 text-black dark:text-white">確定重置所有數據？</h3>
             <p className="text-gray-600 dark:text-gray-300 text-center mb-8 font-bold text-lg">所有輸入將恢復為預設值。</p>
             <div className="grid grid-cols-2 gap-4">
               <button 
                 onClick={() => { if(navigator.vibrate) navigator.vibrate(15); setIsResetModalOpen(false); }}
                 className="py-4 rounded-2xl bg-gray-200 dark:bg-gray-700 text-black dark:text-white font-black text-xl border-2 border-gray-300 dark:border-gray-600 active:scale-95 transition-transform"
               >
                 取消
               </button>
               <button 
                 onClick={confirmReset}
                 className="py-4 rounded-2xl bg-red-600 text-white font-black text-xl border-2 border-red-700 shadow-lg active:scale-95 transition-transform"
               >
                 確認重置
               </button>
             </div>
          </div>
        </div>
      )}

       {/* Preset Manager Modal */}
       {presetModalMode !== 'none' && (
         <div className="fixed inset-0 z-[100] flex flex-col justify-end isolate">
           {/* Overlay */}
           <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setPresetModalMode('none'); setEditingPresetId(null); }}></div>
           
           {/* Bottom Sheet Modal */}
           <div className="relative bg-gray-50 dark:bg-gray-900 rounded-t-3xl w-full max-w-md mx-auto shadow-[0_-10px_40px_rgba(0,0,0,0.2)] animate-slide-up border-t border-gray-200 dark:border-gray-800 flex flex-col max-h-[85vh]">
              {/* Header */}
              <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-t-3xl sticky top-0 z-10 shrink-0 shadow-sm">
                <h3 className="text-xl font-black text-black dark:text-white flex items-center gap-2">
                  {presetModalMode === 'save' ? <span>💾 儲存現況至情境快取</span> : <span>📂 從情境快取讀取</span>}
                </h3>
                <button onClick={() => { setPresetModalMode('none'); setEditingPresetId(null); }} className="text-gray-500 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 w-8 h-8 rounded-full flex items-center justify-center font-bold pb-0.5 active:scale-90 transition-transform">×</button>
              </div>
              
              {/* Body: Row Flex Layout */}
              <div className="flex flex-row overflow-hidden grow bg-gray-50 dark:bg-gray-900 h-[65vh]">
                
                {/* Main Area: Active Preset Display */}
                <div className="flex-1 p-5 overflow-y-auto pb-[calc(2rem+env(safe-area-inset-bottom))]">
                  {(() => {
                    const slotId = activePresetTab;
                    const customName = localStorage.getItem(`${slotId}_name`);
                    const displayName = customName || DEFAULT_PRESET_NAMES[slotId] || slotId;
                    const hasData = !!localStorage.getItem(slotId);
                    const isEditing = editingPresetId === slotId;
                    
                    return (
                      <div className="flex flex-col gap-4 h-full">
                        {/* Title & Edit Row */}
                        <div className="flex flex-col gap-2">
                          {isEditing ? (
                            <div className="flex w-full gap-2 relative">
                              <input 
                                 type="text" 
                                 value={editingPresetName}
                                 onChange={(e) => setEditingPresetName(e.target.value)}
                                 className="w-full bg-white dark:bg-gray-800 border-[3px] border-blue-500 rounded-2xl px-4 py-3 font-black text-xl text-blue-900 dark:text-blue-100 outline-none shadow-sm"
                                 autoFocus
                                 placeholder="輸入情境名稱"
                              />
                              <button 
                                onClick={() => { localStorage.setItem(`${slotId}_name`, editingPresetName); setEditingPresetId(null); }} 
                                className="bg-blue-600 text-white px-5 shrink-0 rounded-2xl font-black text-lg active:scale-95 transition-transform"
                              >
                                確定
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex items-center gap-3">
                                <div className={`w-4 h-4 rounded-full mt-1 shrink-0 ${hasData ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                                <span className="font-black text-gray-900 dark:text-white text-2xl leading-tight block">{displayName}</span>
                              </div>
                              <button onClick={() => { setEditingPresetId(slotId); setEditingPresetName(displayName); }} className="shrink-0 text-sm px-4 py-2 bg-gray-200 active:bg-gray-300 dark:bg-gray-800 dark:active:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-black transition-colors">✏️ 改名</button>
                            </div>
                          )}
                        </div>

                        {/* Details Block - HUGE FONT */}
                        {hasData && !isEditing && (
                          <div className="flex-1 mt-2">
                            {(() => {
                               try {
                                  const sd = JSON.parse(localStorage.getItem(slotId) || '{}');
                                  const dGpm = (sd.n15||0)*100 + (sd.n25||0)*200 + (sd.robotCount||0)*(sd.robotFlow||250);
                                  
                                  const tanks = [];
                                  if(sd.smallTruck) tanks.push(`2T×${sd.smallTruck}`);
                                  if(sd.normalTruck) tanks.push(`4T×${sd.normalTruck}`);
                                  if(sd.reservoirTruck) tanks.push(`10T×${sd.reservoirTruck}`);
                                  if(sd.truck12) tanks.push(`12T×${sd.truck12}`);
                                  const tanksStr = tanks.length ? tanks.join(', ') : '無水箱車';

                                  const sources = [];
                                  if(sd.hydrant) sources.push(`栓 ${sd.hydrantFlow||0} gpm×${sd.hydrant}`);
                                  if(sd.smallPump) sources.push(`小型車泵×${sd.smallPump}`);
                                  if(sd.normalPump) sources.push(`一般車泵×${sd.normalPump}`);
                                  if(sd.truckPump) sources.push(`移動幫浦×${sd.truckPump}`);
                                  const srcStr = sources.length ? sources.join(', ') : '無現場水源';
                                  
                                  const relayTrucks = (sd.modN2||0) + (sd.modN4||0) + (sd.modN10||0) + (sd.modN12||0);
                                  const rTanks = [];
                                  if(sd.modN2) rTanks.push(`2T×${sd.modN2}`);
                                  if(sd.modN4) rTanks.push(`4T×${sd.modN4}`);
                                  if(sd.modN10) rTanks.push(`10T×${sd.modN10}`);
                                  if(sd.modN12) rTanks.push(`12T×${sd.modN12}`);
                                  const rTanksStr = rTanks.length ? rTanks.join(', ') : '無中繼車';

                                  return (
                                    <div className="grid grid-cols-1 gap-3">
                                      <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl border border-red-100 dark:border-red-800/50">
                                        <div className="text-sm font-black text-red-600 dark:text-red-400 mb-1 flex items-center gap-1 opacity-80 uppercase tracking-widest">🔥 現場需求</div>
                                        <div className="text-3xl font-black text-red-900 dark:text-red-100 leading-none mb-1">{dGpm} <span className="text-sm font-bold opacity-80">gpm</span></div>
                                        <div className="text-sm text-red-800/70 dark:text-red-300/70 font-bold">{sd.n15||0}瞄, {sd.n25||0}砲</div>
                                      </div>
                                      
                                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800/50">
                                        <div className="text-sm font-black text-blue-600 dark:text-blue-400 mb-1 flex items-center gap-1 opacity-80 uppercase tracking-widest">💧 攻擊車隊</div>
                                        <div className="text-xl font-black text-blue-900 dark:text-blue-100 leading-tight">{tanksStr}</div>
                                      </div>
                                      
                                      <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-2xl border border-green-100 dark:border-green-800/50">
                                        <div className="text-sm font-black text-green-600 dark:text-green-400 mb-1 flex items-center gap-1 opacity-80 uppercase tracking-widest">⛲ 固定水源</div>
                                        <div className="text-xl font-black text-green-900 dark:text-green-100 leading-tight">{srcStr}</div>
                                      </div>
                                      
                                      <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-2xl border border-purple-100 dark:border-purple-800/50">
                                        <div className="text-sm font-black text-purple-600 dark:text-purple-400 flex items-center gap-1 opacity-80 uppercase tracking-widest mb-1">🔄 循環供水</div>
                                        {relayTrucks > 0 ? (
                                          <div className="flex flex-col">
                                            <div className="text-xl font-black text-purple-900 dark:text-purple-100 leading-tight mb-1">{sd.modDist||0}km · 源 {sd.srcQh||0}gpm</div>
                                            <div className="text-sm text-purple-800/80 dark:text-purple-300/80 font-black leading-tight">{rTanksStr}</div>
                                          </div>
                                        ) : (
                                          <div className="text-xl font-black text-purple-900/50 dark:text-purple-100/50">未啟動</div>
                                        )}
                                      </div>
                                    </div>
                                  );
                               } catch(e) { return null; }
                            })()}
                          </div>
                        )}

                        {/* Action Button Row */}
                        {!isEditing && (
                          <div className={`mt-auto pt-4 ${!hasData ? 'flex-1 flex flex-col justify-end' : ''}`}>
                            {presetModalMode === 'save' ? (
                              <button 
                                onClick={() => {
                                  if (navigator.vibrate) navigator.vibrate(15);
                                  localStorage.setItem(slotId, JSON.stringify(state));
                                  showToast(`✅ 已儲存至「${displayName}」`);
                                  setPresetModalMode('none');
                                }}
                                className={`w-full py-4 rounded-2xl font-black text-xl active:scale-[0.98] transition-all border-2 ${hasData ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800' : 'bg-blue-600 text-white border-blue-700 shadow-lg'}`}
                              >
                                {hasData ? '⚠️ 覆蓋舊資料並儲存' : '💾 儲存至此空欄位'}
                              </button>
                            ) : (
                              <div className="flex flex-row gap-2">
                                <button 
                                  onClick={() => {
                                    if (navigator.vibrate) navigator.vibrate(15);
                                    const p = localStorage.getItem(slotId);
                                    if (p) {
                                      setState(JSON.parse(p));
                                      showToast(`📂 已載入「${displayName}」`);
                                      setPresetModalMode('none');
                                    } else {
                                      showToast(`❌「${displayName}」目前是空欄位`);
                                    }
                                  }}
                                  disabled={!hasData}
                                  className={`flex-[2] py-4 rounded-xl font-black text-xl border-2 active:scale-[0.98] transition-transform ${hasData ? 'bg-blue-600 text-white border-blue-700 shadow-lg' : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-300 dark:border-gray-700 cursor-not-allowed'}`}
                                >
                                  {hasData ? '🚀 載入情境' : '空欄位'}
                                </button>
                                {hasData && (
                                  <button 
                                    onClick={() => {
                                      if (navigator.vibrate) navigator.vibrate(15);
                                      setConfirmClearSlotId(slotId);
                                    }}
                                    className="flex-1 py-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-2 border-red-200 dark:border-red-800/50 rounded-xl font-black text-[17px] active:scale-[0.98] transition-transform"
                                  >
                                    🗑️ 清空
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Right Side: Tab Selection Column */}
                <div className="w-16 shrink-0 border-l-[3px] border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 pb-[env(safe-area-inset-bottom)] flex flex-col overflow-y-auto">
                   {PRESET_SLOTS.map((slotId, index) => {
                      const customName = localStorage.getItem(`${slotId}_name`);
                      const hasData = !!localStorage.getItem(slotId);
                      const sideLabel = customName || (hasData ? `檔${index+1}` : '空');
                      const isActive = activePresetTab === slotId;
                      
                      return (
                         <button 
                           key={slotId}
                           onClick={() => { setActivePresetTab(slotId); setEditingPresetId(null); }}
                           className={`flex-1 min-h-[5rem] px-1 border-b border-gray-100 dark:border-gray-800 flex flex-col items-center justify-center gap-2 transition-all ${isActive ? 'bg-blue-50 dark:bg-blue-900/30 border-l-[6px] border-l-blue-600' : 'opacity-80 active:bg-gray-100 dark:active:bg-gray-800'}`}
                         >
                            <div className={`font-black tracking-widest transition-transform duration-200 ${isActive ? 'text-blue-700 dark:text-blue-300 text-xl scale-110 drop-shadow-sm' : 'text-gray-400 dark:text-gray-500 text-base'}`} style={{ writingMode: 'vertical-rl', textOrientation: 'upright' }}>
                               {sideLabel.substring(0, 5)}
                            </div>
                            <div className="flex flex-col items-center shrink-0">
                              <div className={`w-2 h-2 rounded-full shadow-inner ${hasData ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-transparent'}`}></div>
                            </div>
                         </button>
                      )
                   })}
                </div>
              </div>
           </div>
         </div>
       )}

       {/* Confirm Clear Modal */}
       {confirmClearSlotId && (
         <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in">
           <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-2 bg-red-500"></div>
             <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2 flex items-center gap-2">
               <span>⚠️</span> 警告
             </h3>
             <p className="text-gray-600 dark:text-gray-300 font-bold mb-6 text-lg leading-relaxed">
               確定要清空「<span className="text-red-600 dark:text-red-400 font-black">{localStorage.getItem(`${confirmClearSlotId}_name`) || DEFAULT_PRESET_NAMES[confirmClearSlotId] || confirmClearSlotId}</span>」的資料嗎？<br/>這項操作<span className="underline decoration-red-500 decoration-2 underline-offset-4">無法復原</span>。
             </p>
             <div className="flex gap-3">
               <button 
                 onClick={() => setConfirmClearSlotId(null)}
                 className="flex-1 py-3 rounded-2xl font-black text-lg text-gray-600 bg-gray-100 active:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:active:bg-gray-600 transition-colors"
               >
                 取消
               </button>
               <button 
                 onClick={() => {
                   if(navigator.vibrate) navigator.vibrate(50);
                   localStorage.removeItem(confirmClearSlotId);
                   localStorage.removeItem(`${confirmClearSlotId}_name`);
                   setConfirmClearSlotId(null);
                   // Re-trigger render
                   setActivePresetTab(confirmClearSlotId);
                 }}
                 className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-lg active:scale-[0.98] transition-all shadow-lg shadow-red-600/30"
               >
                 🗑️ 清空
               </button>
             </div>
           </div>
         </div>
       )}

      {/* Main Content */}
      <main className="pt-[144px] px-3 max-w-md mx-auto w-full space-y-6 pb-4" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {/* Page 1: Demand */}
        {activeTab === 'demand' && (
          <div className="animate-fade-in space-y-5">

            <Stepper label="1.5吋 瞄子 (支)" subLabel="100 gpm" value={state.n15} onChange={(v) => update('n15', v)} />
            <Stepper label="2.5吋 瞄子 (支)" subLabel="200 gpm" value={state.n25} onChange={(v) => update('n25', v)} />
            
            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border-2 border-gray-300 dark:border-gray-600">
               <label className="block text-xl font-black mb-2 text-black dark:text-white">機器人流量 (gpm)</label>
               <div className="flex h-16">
                  <input 
                    type="number" inputMode="decimal" 
                    className="w-full h-full text-center text-3xl font-black bg-gray-100 dark:bg-gray-700 rounded-xl text-blue-800 dark:text-blue-300 outline-none focus:ring-4 ring-blue-500/30 transition-all border border-gray-300 dark:border-gray-600" 
                    value={state.robotFlow} 
                    onChange={e => update('robotFlow', parseFloat(e.target.value)||0)} 
                    onFocus={(e) => e.target.select()}
                  />
               </div>
            </div>
            
            <Stepper label="機器人數量 (台)" value={state.robotCount} onChange={(v) => update('robotCount', v)} />
            
            <button 
              onClick={() => { if(navigator.vibrate) navigator.vibrate(15); setIsResetModalOpen(true); }} 
              className="w-full py-5 mt-8 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-2xl font-black text-xl active:bg-gray-300 dark:active:bg-gray-600 transition-colors border-2 border-gray-300 dark:border-gray-500 shadow-sm"
            >
              ↺ 恢復預設值
            </button>
          </div>
        )}

        {/* Page 2: Tanks */}
        {activeTab === 'tanks' && (
          <div className="animate-fade-in space-y-4">
             <Stepper label="2 噸水箱 (輛)" subLabel="2000L" value={state.smallTruck} onChange={(v) => update('smallTruck', v)} />
             <Stepper label="4 噸水箱 (輛)" subLabel="4000L" value={state.normalTruck} onChange={(v) => update('normalTruck', v)} />
             <Stepper label="10 噸水庫 (輛)" subLabel="10000L" value={state.reservoirTruck} onChange={(v) => update('reservoirTruck', v)} />
             <Stepper label="12 噸水庫 (輛)" subLabel="12000L" value={state.truck12} onChange={(v) => update('truck12', v)} />
             
             <div className="sticky bottom-4 z-20 mt-6 p-5 bg-white dark:bg-gray-800 rounded-2xl text-center border-4 border-blue-200 dark:border-blue-800 shadow-xl">
                <p className="text-gray-900 dark:text-gray-200 text-sm font-black uppercase tracking-widest mb-1">目前車隊總水量</p>
                <div className="text-5xl font-black text-blue-800 dark:text-blue-300 tracking-tighter">
                  {res.totalTankL.toLocaleString()} <span className="text-xl font-bold text-gray-600 dark:text-gray-400">L</span>
                </div>
             </div>
          </div>
        )}

        {/* Page 3: Sources */}
        {activeTab === 'sources' && (
          <div className="animate-fade-in space-y-8">
            
            {/* Fixed Sources */}
            <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl border-2 border-gray-300 dark:border-gray-600 shadow-sm">
               <h3 className="font-black text-2xl mb-4 text-black dark:text-white flex items-center gap-2">
                 <span className="text-blue-600">▌</span> 固定水源
               </h3>
               <div className="space-y-6">
                 {/* Hydrant */}
                 <div className="flex flex-col gap-2">
                   <Stepper label="消防栓 (座)" value={state.hydrant} onChange={(v) => update('hydrant', v)} />
                   <div className="flex flex-col gap-3 pl-2">
                     <div className="flex items-center gap-3">
                       <span className="text-gray-900 dark:text-gray-200 font-bold text-lg min-w-[4rem]">單座流量</span>
                       <input type="number" inputMode="decimal" className="flex-1 h-14 rounded-xl text-center bg-gray-100 dark:bg-gray-700 text-black dark:text-white font-black text-xl border-2 border-gray-300 dark:border-gray-600 outline-none focus:border-blue-500" value={state.hydrantFlow} onChange={e => update('hydrantFlow', parseFloat(e.target.value))} onFocus={(e) => e.target.select()} />
                       <span className="text-gray-800 dark:text-gray-300 font-bold w-10">gpm</span>
                     </div>
                     
                     <div className="flex flex-wrap gap-2">
                       <button onClick={() => update('hydrantFlow', 200)} className="flex-1 min-w-[70px] py-2 bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 rounded-lg text-sm font-bold active:scale-95 transition-transform border border-red-200 dark:border-red-800">末端 200</button>
                       <button onClick={() => update('hydrantFlow', 300)} className="flex-1 min-w-[70px] py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-bold active:scale-95 transition-transform border border-gray-300 dark:border-gray-600">一般 300</button>
                       <button onClick={() => update('hydrantFlow', 500)} className="flex-1 min-w-[70px] py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-bold active:scale-95 transition-transform border border-gray-300 dark:border-gray-600">高壓 500</button>
                       <button onClick={() => update('hydrantFlow', 800)} className="flex-1 min-w-[70px] py-2 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 rounded-lg text-sm font-bold active:scale-95 transition-transform border border-blue-200 dark:border-blue-800">特高壓 800</button>
                     </div>
                   </div>
                 </div>
               </div>
            </div>

            {/* Vehicle Pumps */}
            <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl border-2 border-gray-300 dark:border-gray-600 shadow-sm">
               <h3 className="font-black text-2xl mb-4 text-black dark:text-white flex items-center gap-2">
                 <span className="text-green-600">▌</span> 車輛抽水
               </h3>
               
               <div className="space-y-6">
                  {/* Small Pump */}
                  <div className="flex flex-col gap-2">
                    <Stepper label="小型車 (台)" value={state.smallPump} onChange={v => update('smallPump', v)} />
                    <div className="flex items-center gap-3 pl-2">
                       <span className="text-gray-900 dark:text-gray-200 font-bold text-lg w-16">單車流量</span>
                       <input type="number" inputMode="decimal" className="flex-1 h-14 rounded-xl text-center bg-gray-100 dark:bg-gray-700 text-black dark:text-white font-black text-xl border-2 border-gray-300 dark:border-gray-600 outline-none focus:border-blue-500" value={state.smallPumpFlow} onChange={e => update('smallPumpFlow', parseFloat(e.target.value))} onFocus={(e) => e.target.select()} />
                       <span className="text-gray-800 dark:text-gray-300 font-bold w-8">gpm</span>
                    </div>
                  </div>

                  <div className="w-full h-px bg-gray-300 dark:bg-gray-700"></div>

                  {/* Normal Pump */}
                  <div className="flex flex-col gap-2">
                    <Stepper label="一般車 (台)" value={state.normalPump} onChange={v => update('normalPump', v)} />
                    <div className="flex items-center gap-3 pl-2">
                       <span className="text-gray-900 dark:text-gray-200 font-bold text-lg w-16">單車流量</span>
                       <input type="number" inputMode="decimal" className="flex-1 h-14 rounded-xl text-center bg-gray-100 dark:bg-gray-700 text-black dark:text-white font-black text-xl border-2 border-gray-300 dark:border-gray-600 outline-none focus:border-blue-500" value={state.normalFlow} onChange={e => update('normalFlow', parseFloat(e.target.value))} onFocus={(e) => e.target.select()} />
                       <span className="text-gray-800 dark:text-gray-300 font-bold w-8">gpm</span>
                    </div>
                  </div>

                  <div className="w-full h-px bg-gray-300 dark:bg-gray-700"></div>

                  {/* Reservoir Pump */}
                  <div className="flex flex-col gap-2">
                    <Stepper label="水庫車 (台)" value={state.reservoirPump} onChange={v => update('reservoirPump', v)} />
                    <div className="flex items-center gap-3 pl-2">
                       <span className="text-gray-900 dark:text-gray-200 font-bold text-lg w-16">單車流量</span>
                       <input type="number" inputMode="decimal" className="flex-1 h-14 rounded-xl text-center bg-gray-100 dark:bg-gray-700 text-black dark:text-white font-black text-xl border-2 border-gray-300 dark:border-gray-600 outline-none focus:border-blue-500" value={state.reservoirPumpFlow} onChange={e => update('reservoirPumpFlow', parseFloat(e.target.value))} onFocus={(e) => e.target.select()} />
                       <span className="text-gray-800 dark:text-gray-300 font-bold w-8">gpm</span>
                    </div>
                  </div>

                  <div className="w-full h-px bg-gray-300 dark:bg-gray-700"></div>

                  {/* Portable Pump */}
                  <div className="flex flex-col gap-2">
                    <Stepper label="移動幫浦 (台)" value={state.portablePump} onChange={v => update('portablePump', v)} />
                    <div className="flex items-center gap-3 pl-2">
                       <span className="text-gray-900 dark:text-gray-200 font-bold text-lg w-16">單機流量</span>
                       <input type="number" inputMode="decimal" className="flex-1 h-14 rounded-xl text-center bg-gray-100 dark:bg-gray-700 text-black dark:text-white font-black text-xl border-2 border-gray-300 dark:border-gray-600 outline-none focus:border-blue-500" value={state.portablePumpFlow} onChange={e => update('portablePumpFlow', parseFloat(e.target.value))} onFocus={(e) => e.target.select()} />
                       <span className="text-gray-800 dark:text-gray-300 font-bold w-8">gpm</span>
                    </div>
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* Page 4: Relay Logic */}
        {activeTab === 'relay' && (
          <div className="animate-fade-in space-y-5">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border-2 border-blue-200 dark:border-blue-800">
              <h3 className="text-center font-black text-blue-900 dark:text-blue-100 mb-4 text-xl">基礎設定</h3>
              <Stepper label="取水距離 (km)" step={0.05} value={state.modDist} onChange={v => update('modDist', v)} colorClass="bg-white dark:bg-gray-800" />
              <Stepper label="供水線數 (條)" value={state.modLines} onChange={v => update('modLines', v)} colorClass="bg-white dark:bg-gray-800" />
              <Stepper label="出水壓力 (kg/cm²)" step={0.5} value={state.modP} onChange={v => update('modP', v)} colorClass="bg-white dark:bg-gray-800" />
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border-2 border-gray-300 dark:border-gray-600">
               <label className="block text-xl font-black mb-3 text-black dark:text-white">佔據水源車輛</label>
               <div className="relative">
                 <select 
                  className="w-full h-16 bg-gray-100 dark:bg-gray-700 text-black dark:text-white rounded-xl text-xl font-black px-4 appearance-none outline-none focus:ring-4 ring-blue-500/20 border-2 border-gray-300 dark:border-gray-600"
                  value={state.srcS}
                  onChange={(e) => update('srcS', parseFloat(e.target.value))}
                 >
                   <option value="2">2 噸水箱車</option>
                   <option value="4">4 噸水箱車</option>
                   <option value="10">10 噸水庫車</option>
                   <option value="12">12 噸水庫車</option>
                 </select>
                 <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-800 dark:text-gray-300 text-xl">▼</div>
               </div>
            </div>
            
             <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border-2 border-gray-300 dark:border-gray-600">
               <label className="block text-xl font-black mb-3 text-black dark:text-white">水源名目流量 (gpm)</label>
               <input type="number" inputMode="decimal" className="w-full h-16 text-center text-3xl font-black bg-gray-100 dark:bg-gray-700 text-black dark:text-white rounded-xl outline-none focus:ring-4 ring-blue-500/20 border-2 border-gray-300 dark:border-gray-600" value={state.srcQh} onChange={e => update('srcQh', parseFloat(e.target.value)||0)} onFocus={(e) => e.target.select()} />
            </div>

            <Stepper label="拆裝時間 (分)" step={0.5} value={state.modWork} onChange={v => update('modWork', v)} />
            
            {/* Collapsible Vehicle Speed */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-gray-300 dark:border-gray-600 overflow-hidden">
              <button 
                onClick={() => { if(navigator.vibrate) navigator.vibrate(15); setSpeedsOpen(!speedsOpen); }}
                className="w-full p-4 flex justify-between items-center active:bg-gray-50 dark:active:bg-gray-700 transition-colors"
              >
                <span className="text-xl font-black text-black dark:text-white">⚙️ 車速設定</span>
                <span className={`text-2xl transition-transform duration-200 ${speedsOpen ? 'rotate-180' : ''}`}>▼</span>
              </button>
              {speedsOpen && (
                <div className="grid grid-cols-2 gap-3 p-4 pt-0 animate-fade-in">
                  {[{l:'2噸',k:'v2'}, {l:'4噸',k:'v4'}, {l:'10噸',k:'v10'}, {l:'12噸',k:'v12'}].map((item) => (
                    <div key={item.k} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
                      <label className="text-base font-black text-black dark:text-white block mb-2">{item.l}車速</label>
                      <div className="flex items-baseline justify-center gap-1">
                         <input 
                           type="number" inputMode="decimal"
                           className="w-full text-center text-4xl font-black bg-transparent text-black dark:text-white outline-none p-0" 
                           value={state[item.k as keyof WaterState]} 
                           onChange={e=>update(item.k as keyof WaterState, parseFloat(e.target.value))} 
                           onFocus={(e) => e.target.select()}
                         />
                         <span className="text-base font-bold text-gray-600 dark:text-gray-400">km/h</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Page 5: Results */}
        {activeTab === 'result' && (
          <div className="animate-fade-in space-y-6 pt-2 pb-10">

             {/* Relay Visualizer */}
             <div className="bg-white dark:bg-gray-800 p-4 rounded-3xl shadow-sm border-2 border-gray-300 dark:border-gray-600">
               <h3 className="text-center font-black text-black dark:text-white text-xl mb-4">中繼佈線視覺化</h3>
               <div className="flex items-center justify-between mt-2 mb-6 relative">
                 
                 {/* Source Node */}
                 <div className="flex flex-col items-center z-10 w-[30%]">
                   <div className={`w-14 h-14 rounded-full flex items-center justify-center text-3xl shadow-md border-4 animate-in ${res.qIntakeEff <= 0 || res.hydrantUtilFrac >= 1 ? 'bg-red-100 border-red-500 shadow-red-500/30 ring-2 ring-red-500 animate-pulse' : 'bg-blue-100 border-blue-500'}`}>
                     💧
                   </div>
                   <div className="text-center mt-2 font-bold text-gray-800 dark:text-gray-200 text-sm">水源地取水</div>
                   <div className="text-center font-black text-blue-600 dark:text-blue-400 text-lg leading-none mt-1">{Math.round(res.qIntakeEff)} <span className="text-xs">gpm</span></div>
                 </div>

                 {/* Line 1 */}
                 <div className="flex-1 h-3 -mx-4 z-0 bg-gray-200 dark:bg-gray-700 relative flex items-center justify-center overflow-hidden">
                    <div className={`absolute left-0 top-0 bottom-0 transition-all duration-1000 ${res.qIntakeEff > 0 ? 'bg-blue-400 dark:bg-blue-500' : ''}`} style={{ width: '100%' }}></div>
                 </div>

                 {/* Fleet Node */}
                 <div className="flex flex-col items-center z-10 w-[30%]">
                   <div className={`w-14 h-14 rounded-full flex items-center justify-center bg-white dark:bg-gray-800 text-3xl shadow-md border-4 animate-in ${res.compression >= 1 && res.totalCircDemand > 0 ? 'border-orange-500 shadow-orange-500/30' : 'border-green-500'}`}>
                     🚛
                   </div>
                   <div className="text-center mt-2 font-bold text-gray-800 dark:text-gray-200 text-sm">車隊總運能</div>
                   <div className="text-center font-black text-green-600 dark:text-green-400 text-lg leading-none mt-1">{Math.round(res.totalCircDemand)} <span className="text-xs">gpm</span></div>
                 </div>

                 {/* Line 2 */}
                 <div className="flex-1 h-3 -mx-4 z-0 bg-gray-200 dark:bg-gray-700 relative flex items-center justify-center overflow-hidden">
                    <div className="absolute top-0 bottom-0 left-0 bg-green-400 dark:bg-green-500 transition-all duration-1000" style={{ width: res.totalCircDemand > 0 ? '100%' : '0%' }}></div>
                 </div>

                 {/* Fire Node */}
                 <div className="flex flex-col items-center z-10 w-[30%]">
                   <div className={`w-14 h-14 rounded-full flex items-center justify-center text-3xl shadow-md border-4 animate-in ${res.net > 0 ? 'bg-red-50 border-red-500' : 'bg-green-50 border-green-500'}`}>
                     🔥
                   </div>
                   <div className="text-center mt-2 font-bold text-gray-800 dark:text-gray-200 text-sm">火場實供</div>
                   <div className="text-center font-black text-red-600 dark:text-red-400 text-lg leading-none mt-1">{Math.round(res.circEff)} <span className="text-xs">gpm</span></div>
                 </div>

               </div>
               
               <div className="text-center bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl border border-gray-200 dark:border-gray-600 mt-6">
                 <div className="font-bold text-gray-500 dark:text-gray-400 text-xs mb-1">供水系統狀態</div>
                 <div className="font-black text-lg text-black dark:text-white leading-tight">{res.bottleneckMsg}</div>
               </div>
             </div>

             {/* Chart & Coverage Section */}
             <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-sm border-2 border-gray-300 dark:border-gray-600">
               <div className="flex items-center justify-between mb-2">
                  <button onClick={async()=>{if(navigator.vibrate)navigator.vibrate(15);try{const el=document.getElementById('root');if(!el)return;const{default:h2c}=await import('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm');const canvas=await h2c(el,{useCORS:true,scale:2});canvas.toBlob(async(blob)=>{if(!blob)return;if(navigator.share){const file=new File([blob],'report.png',{type:'image/png'});await navigator.share({files:[file],title:'report'});}else{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='report.png';a.click();}showToast('📸 截圖已產生');});}catch(e){showToast('❌ 截圖失敗');}}} className="text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-3 py-1.5 rounded-lg font-bold active:scale-95 transition-transform shadow-sm border border-gray-300 dark:border-gray-600 flex items-center gap-1"><span>📸</span> 截圖</button>
                  <h3 className="font-black text-black dark:text-white text-xl">供需組成分析</h3>
                  <button onClick={copyReport} className="text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-3 py-1.5 rounded-lg font-bold active:scale-95 transition-transform shadow-sm border border-gray-300 dark:border-gray-600 flex items-center gap-1"><span>📋</span> 複製</button>
                </div>
               
               <div className="h-64 w-full">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieDataVisual}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                        onClick={(data) => { if(navigator.vibrate) navigator.vibrate(15); setSelectedSlice(prev => prev === data.name ? null : data.name); }}
                      >
                        {pieDataVisual.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} strokeWidth={0} cursor="pointer" />
                        ))}
                      </Pie>
                      <Legend 
                        verticalAlign="bottom" 
                        height={36} 
                        iconType="circle" 
                        formatter={(val) => <span className="text-lg font-black text-gray-900 dark:text-gray-200 ml-1 mr-3">{val}</span>} 
                      />
                      <Tooltip 
                        contentStyle={{
                           backgroundColor: 'rgba(255, 255, 255, 0.95)',
                           borderRadius: '12px',
                           border: 'none',
                           boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                           padding: '10px 14px'
                        }}
                        itemStyle={{ color: '#000', fontWeight: 900, fontSize: '1.1rem' }}
                        formatter={(val: number) => [`${val} gpm`]}
                      />
                    </PieChart>
                 </ResponsiveContainer>
               </div>

               {/* Coverage Progress Bar */}
               <div className="mt-4 px-2">
                 <div className="flex justify-between font-black text-lg mb-1">
                   <span className="text-gray-900 dark:text-white">供需覆蓋率</span>
                   <span className={`${res.coverage >= 100 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{Math.round(res.coverage)}%</span>
                 </div>
                 <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-5 border border-gray-300 dark:border-gray-600 overflow-hidden">
                   <div
                     className={`h-5 rounded-full transition-all duration-500 ${getCoverageColor(res.coverage)}`}
                     style={{ width: `${Math.min(100, res.coverage)}%` }}
                   ></div>
                 </div>
               </div>
               
               {/* Pie Chart Click Details */}
               {renderSliceDetail()}
            </div>
            
            {/* Key Metrics Cards Grid */}
            <div className="grid grid-cols-2 gap-3">
              
              {/* 1. Total Demand - Red Theme */}
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl border-2 border-red-200 dark:border-red-800 text-center shadow-sm flex flex-col justify-center">
                <div className="text-red-900 dark:text-red-100 font-bold text-base mb-1">總需求</div>
                <div className="text-3xl font-black text-red-700 dark:text-red-300">
                  {Math.round(res.demand)} <span className="text-base text-red-600/70 dark:text-red-300/70 font-bold">gpm</span>
                </div>
              </div>

              {/* 2. Total Supply - Blue Theme */}
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border-2 border-blue-200 dark:border-blue-800 text-center shadow-sm flex flex-col justify-center">
                <div className="text-blue-900 dark:text-blue-100 font-bold text-base mb-1">總供給</div>
                <div className="text-3xl font-black text-blue-700 dark:text-blue-300">
                  {Math.round(res.qFrontline + res.circEff)} <span className="text-base text-blue-600/70 dark:text-blue-300/70 font-bold">gpm</span>
                </div>
              </div>

              {/* 3. Net Demand Card */}
              <div className={`col-span-2 p-5 rounded-3xl border-4 text-center shadow-lg ${
                res.net > 0 
                  ? 'bg-red-600 border-red-800 text-white' 
                  : 'bg-green-600 border-green-800 text-white'
              }`}>
                 <div className="text-lg font-bold opacity-90 mb-1">淨需求 (短缺)</div>
                 <div className="text-6xl font-black tracking-tighter leading-none">
                   {Math.round(res.net)}
                   <span className="text-2xl ml-2 opacity-90 font-bold">gpm</span>
                 </div>
                 <div className="mt-2 text-xl font-bold bg-black/20 rounded-lg py-1 px-4 inline-block">
                    {res.net <= 0 ? '💧 水源充足' : '⚠️ 水源不足'}
                 </div>
              </div>

              {/* 4. Duration (Horizontal Layout) */}
              <div className="col-span-2 bg-white dark:bg-gray-800 p-5 rounded-2xl border-2 border-gray-300 dark:border-gray-600 text-center shadow-sm flex flex-col justify-center">
                <div className="text-gray-900 dark:text-gray-200 font-bold text-lg mb-1">水箱撐時</div>
                <div className="text-black dark:text-white">
                  {res.net <= 0 
                    ? <span className="text-4xl font-black">∞ <span className="text-lg">充足</span></span>
                    : durationDisplay.m !== '-' 
                      ? <div className="flex items-baseline justify-center gap-2">
                          <span className="text-4xl font-black">{durationDisplay.m} <span className="text-xl text-gray-600 dark:text-gray-400">分</span></span>
                          <span className="text-4xl font-black">{durationDisplay.s} <span className="text-xl text-gray-600 dark:text-gray-400">秒</span></span>
                        </div>
                      : <span className="text-4xl font-black">-</span>}
                </div>
              </div>
            </div>

            {/* Sliders Section */}
            <div className="space-y-2">
               <HydraulicSlider 
                 label="前方折減" 
                 subText="水箱+現場水源 → 瞄子"
                 value={state.frontReducePct} 
                 onChange={v => update('frontReducePct', v)} 
               />
               <HydraulicSlider 
                 label="後方折減" 
                 subText="水源 → 循環車隊"
                 value={state.rearReducePct} 
                 onChange={v => update('rearReducePct', v)} 
               />
            </div>

            {/* Relay Truck Manager */}
            <div className="bg-blue-50 dark:bg-slate-900 p-5 rounded-3xl border-4 border-blue-200 dark:border-slate-700">
               <h3 className="font-black text-3xl mb-6 text-center text-blue-900 dark:text-blue-100">循環車隊配置</h3>
               
               <div>
                 <Stepper label="2 噸車 (輛)" value={state.modN2} onChange={v => update('modN2', v)} 
                   subLabel={state.modN2 > 0 ? `${Math.round(res.relayStats.q2)} gpm/車 (實際)` : `${Math.round(res.relayStats.baseQ2)} gpm/車 (理想)`} 
                   colorClass="bg-white dark:bg-slate-800"
                   statusColor={getRelayStatusColor(res.compression, state.modN2)}
                 />
                 {renderTruckDetail(state.modN2, { tFill: res.relayStats.tFill2, tDrive: res.relayStats.td2, tc: res.relayStats.tc2 }, '2噸')}
               </div>

               <div>
                 <Stepper label="4 噸車 (輛)" value={state.modN4} onChange={v => update('modN4', v)} 
                   subLabel={state.modN4 > 0 ? `${Math.round(res.relayStats.q4)} gpm/車 (實際)` : `${Math.round(res.relayStats.baseQ4)} gpm/車 (理想)`} 
                   colorClass="bg-white dark:bg-slate-800"
                   statusColor={getRelayStatusColor(res.compression, state.modN4)}
                 />
                 {renderTruckDetail(state.modN4, { tFill: res.relayStats.tFill4, tDrive: res.relayStats.td4, tc: res.relayStats.tc4 }, '4噸')}
               </div>

               <div>
                 <Stepper label="10 噸車 (輛)" value={state.modN10} onChange={v => update('modN10', v)} 
                   subLabel={state.modN10 > 0 ? `${Math.round(res.relayStats.q10)} gpm/車 (實際)` : `${Math.round(res.relayStats.baseQ10)} gpm/車 (理想)`} 
                   colorClass="bg-white dark:bg-slate-800"
                   statusColor={getRelayStatusColor(res.compression, state.modN10)}
                 />
                 {renderTruckDetail(state.modN10, { tFill: res.relayStats.tFill10, tDrive: res.relayStats.td10, tc: res.relayStats.tc10 }, '10噸')}
               </div>

               <div>
                 <Stepper label="12 噸車 (輛)" value={state.modN12} onChange={v => update('modN12', v)} 
                   subLabel={state.modN12 > 0 ? `${Math.round(res.relayStats.q12)} gpm/車 (實際)` : `${Math.round(res.relayStats.baseQ12)} gpm/車 (理想)`} 
                   colorClass="bg-white dark:bg-slate-800"
                   statusColor={getRelayStatusColor(res.compression, state.modN12)}
                 />
                 {renderTruckDetail(state.modN12, { tFill: res.relayStats.tFill12, tDrive: res.relayStats.td12, tc: res.relayStats.tc12 }, '12噸')}
               </div>
               
               <div className="mt-6 p-5 bg-white dark:bg-slate-800 rounded-2xl space-y-3 text-lg shadow-sm border-2 border-gray-200 dark:border-slate-600">
                  <div className="flex justify-between items-center border-b border-gray-200 dark:border-slate-600 pb-3">
                    <span className="text-black dark:text-white font-black text-xl">循環總量</span>
                    <span className="font-black text-2xl text-blue-700 dark:text-blue-300">{Math.round(res.circEff)} gpm</span>
                  </div>
                  
                  <div className="pt-2 pb-2">
                    <span className={`font-black text-xl block ${res.bottleneckMsg.includes('瓶頸') ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
                      {res.bottleneckMsg}
                    </span>
                  </div>

                  {/* Detailed Relay Analysis - High Contrast */}
                  <div className="grid grid-cols-1 gap-3 text-base pt-2 text-black dark:text-white font-bold">
                    <div className="flex justify-between">
                      <span>加滿佔據水源車時間:</span>
                      <span className="font-black text-lg">{isFinite(res.tFillSource) ? res.tFillSource.toFixed(1) : '-'} 分</span>
                    </div>
                    <div className="flex justify-between">
                      <span>循環車隊平均到水時間:</span>
                      <span className="font-black text-lg">{isFinite(res.overallInterval) && res.overallInterval > 0 ? res.overallInterval.toFixed(1) : '-'} 分/次</span>
                    </div>
                    <div className="flex justify-between">
                      <span>每一輪消防栓關水等車時間:</span>
                      <span className="font-black text-lg">{isFinite(idleTime) ? idleTime.toFixed(1) : '0'} 分</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>消防栓利用率:</span>
                      <span className={`font-black px-2 py-0.5 rounded text-white ${res.hydrantUtilFrac > 1 ? 'bg-red-600' : 'bg-green-600'}`}>
                        {Math.round(res.hydrantUtilFrac * 100)}%
                      </span>
                    </div>
                    <div className="text-sm text-gray-800 dark:text-gray-300 italic text-right font-bold whitespace-pre-wrap">
                       ({res.hydrantStatusMsg})
                    </div>
                  </div>

                  <div className="mt-3 p-4 bg-gray-100 dark:bg-slate-900 rounded-xl border-2 border-gray-300 dark:border-slate-600">
                    <div className="text-base font-black text-black dark:text-white mb-1">趨勢判讀</div>
                    <div className="text-base text-gray-900 dark:text-gray-100 leading-relaxed font-bold whitespace-pre-wrap">
                      {res.twoPhaseMsg}
                    </div>
                  </div>
               </div>
            </div>
          </div>
        )}

      </main>

      {/* Bottom Status HUD */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-white dark:bg-gray-900 border-t-2 border-gray-300 dark:border-gray-700 shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.1)]">
        
        {/* Status Bar */}
        <footer 
          className="p-3 w-full max-w-md mx-auto flex justify-between items-center gap-4"
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
          <div className="flex flex-col">
             <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">淨需求</span>
             <span className={`text-2xl font-black ${res.net > 0 ? 'text-red-600' : 'text-green-600'}`}>
               {Math.round(res.net)} <span className="text-sm">gpm</span>
             </span>
          </div>
          <div className={`flex-1 flex flex-col items-center justify-center px-4 py-2 rounded-xl shadow-inner ${res.net > 0 ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
             <div className="text-xs font-bold opacity-80 mb-0.5">水箱撐時</div>
             <div className="text-2xl font-black leading-none tracking-tight">
               {res.net <= 0 
                 ? '充足 ∞' 
                 : durationDisplay.m !== '-' 
                   ? `${durationDisplay.m}分 ${durationDisplay.s}秒`
                   : '-'}
             </div>
          </div>
        </footer>
      </div>

       {/* PWA Install Banner */}
       {showInstallBanner && (
         <div className="fixed bottom-[90px] left-2 right-2 z-[200] animate-fade-in max-w-md mx-auto">
           <div className="bg-blue-600 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3 border-2 border-blue-400">
             <span className="text-3xl">📲</span>
             <div className="flex-1">
               <div className="font-black text-lg leading-tight">安裝到桌面</div>
               <div className="text-sm opacity-90 font-bold">離線也能用，一鍵開啟</div>
             </div>
             <button
               onClick={() => {
                 if (deferredInstallPrompt) {
                   deferredInstallPrompt.prompt();
                   deferredInstallPrompt.userChoice.then(() => {
                     setDeferredInstallPrompt(null);
                     setShowInstallBanner(false);
                   });
                 }
               }}
               className="px-4 py-2 bg-white text-blue-700 rounded-xl font-black text-lg active:scale-95 transition-transform shadow-md"
             >
               安裝
             </button>
             <button
               onClick={() => {
                 setShowInstallBanner(false);
                 sessionStorage.setItem('pwa-banner-dismissed', '1');
               }}
               className="text-white/70 text-2xl leading-none px-1 active:scale-95"
             >
               ✕
             </button>
           </div>
         </div>
       )}

       {/* Toast Notification */}
       {toastMsg && (
         <div className="fixed top-[156px] left-1/2 -translate-x-1/2 z-[300] animate-fade-in pointer-events-none">
           <div className="bg-gray-900/90 dark:bg-white/90 text-white dark:text-gray-900 px-6 py-3 rounded-2xl font-black text-lg shadow-2xl backdrop-blur-sm whitespace-nowrap">
             {toastMsg}
           </div>
         </div>
       )}

    </div>
  );
}
