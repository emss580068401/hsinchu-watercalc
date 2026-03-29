import React from 'react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-start isolate">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/90 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>
      
      {/* Panel */}
      <div className="relative w-[95%] sm:w-[85%] max-w-md h-full bg-white dark:bg-gray-900 shadow-2xl overflow-y-auto flex flex-col animate-slide-right border-r border-gray-200 dark:border-gray-700">
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-blue-700 text-white px-4 py-5 flex justify-between items-center shadow-lg shrink-0">
          <h2 className="text-2xl font-black tracking-tight">模型計算說明</h2>
          <button 
            onClick={onClose} 
            className="w-12 h-12 flex items-center justify-center bg-blue-800 rounded-full text-3xl leading-none active:scale-95 transition-transform border-2 border-blue-600"
          >
            &times;
          </button>
        </div>

        <div className="p-6 text-black dark:text-white space-y-8 pb-20 text-lg leading-relaxed font-medium">
          <div>
            <p className="font-bold text-xl">※ 版本號 3.0.0（新竹縣消防局專屬版）</p>
          </div>

          {/* Quick Tool Buttons */}
          <div className="grid grid-cols-1 gap-3">
            <button 
              onClick={() => {
                // PWA Install
                const deferredPrompt = (window as any).__deferredPrompt;
                if (deferredPrompt) {
                  deferredPrompt.prompt();
                  deferredPrompt.userChoice.then(() => { (window as any).__deferredPrompt = null; });
                } else {
                  alert('📲 提示：請用瀏覽器選單中的「加到主畫面」功能安裝。\n\niPhone：點選 Safari 底部的分享按鈕 → 加入主畫面\nAndroid：點選 Chrome 右上角 ⋮ → 安裝應用程式');
                }
              }}
              className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black text-xl active:scale-[0.98] transition-all shadow-lg flex items-center justify-center gap-2"
            >
              📲 安裝到手機桌面
            </button>
            <button 
              onClick={async () => {
                try {
                  const el = document.getElementById('root');
                  if (!el) return;
                  const { default: html2canvas } = await import('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm' as any);
                  const canvas = await html2canvas(el, { useCORS: true, scale: 2 });
                  canvas.toBlob(async (blob: Blob | null) => {
                    if (!blob) return;
                    if (navigator.share) {
                      const file = new File([blob], '水源計算機報表.png', { type: 'image/png' });
                      await navigator.share({ files: [file], title: '水源計算機報表' });
                    } else {
                      const a = document.createElement('a');
                      a.href = URL.createObjectURL(blob);
                      a.download = '水源計算機報表.png';
                      a.click();
                    }
                  });
                } catch(e) { alert('截圖失敗：' + e); }
              }}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xl active:scale-[0.98] transition-all shadow-lg flex items-center justify-center gap-2"
            >
              📸 截圖分享
            </button>
          </div>

          <hr className="border-gray-400 dark:border-gray-600" />

          <section>
            <h3 className="text-2xl font-black text-blue-800 dark:text-blue-300 mb-4">▌核心計算邏輯</h3>
            <div className="space-y-5">
              <div>
                <p className="font-black text-lg">Q_frontline（火場額外水源）</p>
                <p className="font-bold">=（消防栓＋抽水）× 前方折減</p>
                <p className="text-gray-700 dark:text-gray-400 text-base font-bold mt-1">*反映瞄子端操作損耗、彎折與壓損</p>
              </div>
              <div>
                <p className="font-black text-lg">Q_intake（取水端可用流量）</p>
                <p className="font-bold">= 水源名目流量 × 後方折減</p>
                <p className="text-gray-700 dark:text-gray-400 text-base font-bold mt-1">*反映吸水、地勢與管線狀況</p>
              </div>
              <div>
                <p className="font-black text-lg">實際循環供水</p>
                <p className="font-bold">= MIN（車隊循環總運能, Q_intake）</p>
                <p className="text-gray-700 dark:text-gray-400 text-base font-bold mt-1">*木桶理論：最弱一環決定全隊供水能力</p>
              </div>
              <div>
                <p className="font-black text-lg">消防栓利用率 Duty%</p>
                <p className="font-bold">= 車隊需求 ÷ Q_intake</p>
                <p className="text-red-600 dark:text-red-400 font-bold mt-1">* ＞100%：水源抽空，已成供水瓶頸。</p>
                <p className="text-green-700 dark:text-green-400 font-bold">* 100%：供需平衡（近似長距離佈線供水）。</p>
              </div>
            </div>
          </section>

          <hr className="border-gray-400 dark:border-gray-600" />

          <section>
            <h3 className="text-2xl font-black text-blue-800 dark:text-blue-300 mb-4">▌2.3 吋等效內徑 (重要修正)</h3>
            <p className="mb-3 font-bold">
              依據<strong>交通大學《消防車中繼送水壓力損失研究》</strong>實測資料：<br/>
              2.5 吋水帶在不同操作壓力下的摩擦損失均高於教科書公式 FL=2Q²L：
            </p>
            <ul className="list-disc pl-5 space-y-2 font-bold text-gray-800 dark:text-gray-200 mb-4">
               <li><strong>5 kgf/cm² (低壓)</strong>：≈ 1.75 倍 (C≈3.5)</li>
               <li><strong>7 kgf/cm² (最常用)</strong>：≈ <strong>1.50 倍</strong> (C≈3.0)</li>
               <li><strong>9 kgf/cm² (高壓)</strong>：≈ 1.83 倍 (C≈3.66)</li>
            </ul>
            <p className="font-bold">
              水帶摩擦損失近似與「1 / D⁵」成反比。以 1.5 倍摩擦損失反推，2.5 吋 → 等效 <strong>2.3 吋</strong>最為貼近。<br/><br/>
              因此本工具採用 <strong>2.3 吋等效內徑</strong>作為「標準作業線路」設定，以反映一般彎折、接頭縮徑與水帶老化等基本損耗。
            </p>
          </section>

          <hr className="border-gray-400 dark:border-gray-600" />

          <section>
            <h3 className="text-2xl font-black text-blue-800 dark:text-blue-300 mb-4">▌折減係數建議指南</h3>
            
            <div className="mb-6">
              <p className="font-black text-xl mb-2">前方折減 (現場額外水源)</p>
              <ul className="space-y-2 font-bold text-gray-800 dark:text-gray-200">
                <li><span className="bg-green-100 dark:bg-green-900 px-2 py-1 rounded">0~5%</span> 線路良好 (僅基本接頭損耗)</li>
                <li><span className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">5~10%</span> 一般線路 (中距離、少量彎折)</li>
                <li><span className="bg-orange-100 dark:bg-orange-900 px-2 py-1 rounded">10~20%</span> 困難佈線 (長距離、彎多、爬坡)</li>
                <li><span className="bg-red-100 dark:bg-red-900 px-2 py-1 rounded">＞25%</span> 極度不利 (宜改善佈線)</li>
              </ul>
            </div>

            <div>
              <p className="font-black text-xl mb-2">後方折減 (取水端與佔水源車)</p>
              <ul className="space-y-2 font-bold text-gray-800 dark:text-gray-200">
                <li><span className="bg-green-100 dark:bg-green-900 px-2 py-1 rounded">0~5%</span> 水源優良 (短距離、高壓、穩定)</li>
                <li><span className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">5~15%</span> 一般水源 (末端管網、壓力普通)</li>
                <li><span className="bg-orange-100 dark:bg-orange-900 px-2 py-1 rounded">15~25%</span> 水源不佳 (落差大、水深淺、易氣蝕)</li>
                <li><span className="bg-red-100 dark:bg-red-900 px-2 py-1 rounded">＞30%</span> 極差水源 (建議改抽水或增設中繼)</li>
              </ul>
            </div>
          </section>

          <hr className="border-gray-400 dark:border-gray-600" />

          <section>
            <h3 className="text-2xl font-black text-blue-800 dark:text-blue-300 mb-4">▌簡單流量表 (100 gpm 積木法)</h3>
            <p className="mb-3 font-bold text-base">
              為提升火場決策速度，本工具採用「100 gpm 積木化」方式統一瞄子與水帶的建議操作流量。
            </p>
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-xl space-y-3 border-2 border-gray-300 dark:border-gray-600">
              <div className="flex justify-between items-center border-b border-gray-300 dark:border-gray-600 pb-2">
                <span className="font-bold">1.5" 瞄子</span>
                <span className="text-blue-800 dark:text-blue-300 font-black text-xl">🟦 100</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-300 dark:border-gray-600 pb-2">
                <span className="font-bold">2.5" 瞄子</span>
                <span className="text-blue-800 dark:text-blue-300 font-black text-xl">🟦🟦 200</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-300 dark:border-gray-600 pb-2">
                <span className="font-bold">1.5" 水帶</span>
                <span className="text-blue-800 dark:text-blue-300 font-black text-xl">🟦 100</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold">2.5" 水帶</span>
                <span className="text-blue-800 dark:text-blue-300 font-black text-xl">🟦🟦🟦 300</span>
              </div>
            </div>
            <p className="mt-3 font-bold">
              🟦 = 100 gpm<br/>
              以積木數量比對供需，比查表快速、比「感覺」更穩定。
            </p>
          </section>

          <hr className="border-gray-400 dark:border-gray-600" />

          <section>
            <h3 className="text-2xl font-black text-blue-800 dark:text-blue-300 mb-4">▌本計算機的核心前提</h3>
            <p className="font-bold mb-2 text-lg text-red-600 dark:text-red-400">避免錯誤戰術被帶入計算</p>
            <p className="mb-3 font-bold">
              本工具<strong>預設所有人均採用正確且合理的佈線方式</strong>，不會出現違反戰術的大錯誤接法。
            </p>
            <ul className="list-disc pl-5 space-y-2 font-bold text-gray-800 dark:text-gray-200">
               <li>瞄子流量 = 使用者的戰術需求（合理值）</li>
               <li>水帶供給能力 = 火場可接受的安全上限</li>
               <li>本模型不會自動「修正水量」，也不會模擬錯誤佈線。</li>
            </ul>
             <p className="mt-3 bg-red-100 dark:bg-red-900/40 p-3 rounded text-red-800 dark:text-red-200 font-black border border-red-200 dark:border-red-700">
               若現場出現「瞄子需求 &gt; 水帶能力」的配置，應立即調整戰術，而非依靠本工具硬算。
            </p>
          </section>

           <hr className="border-gray-400 dark:border-gray-600" />

          <section>
            <h3 className="text-2xl font-black text-blue-800 dark:text-blue-300 mb-4">▌限流機制</h3>
            <p className="mb-2 font-bold"><strong>瞄子「需求量」若大於水帶的「供給能力」</strong>，供水系統會自然被<span className="text-red-600 dark:text-red-400 font-black">限流</span>。</p>
            <div className="font-bold text-lg p-3 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700">
                <p className="mb-1">2.5" 水帶 (🟦🟦🟦)</p>
                <p className="mb-1 text-center text-xl">vs</p>
                <p className="mb-2">2 支 2.5" 瞄子 (🟦🟦🟦🟦)</p>
                <p className="text-red-600 dark:text-red-400">→ 供水不足 (限流)，無法達到 400 gpm</p>
            </div>
            <p className="mt-3 font-bold text-gray-800 dark:text-gray-200">
              但水帶不會讓水箱「多掉水」，只會讓流量達不到瞄子標示值。
            </p>
          </section>

          <hr className="border-gray-400 dark:border-gray-600" />

          <section>
            <h3 className="text-2xl font-black text-blue-800 dark:text-blue-300 mb-4">▌流量參考 (gpm)</h3>
            
            <div className="space-y-6">
              <div>
                <p className="mb-2 font-black text-lg text-black dark:text-white">📍 市政路邊消防栓 (能力分級)</p>
                <div className="grid grid-cols-[1.4fr_1fr] gap-2 text-base font-bold">
                  <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded border border-gray-300 dark:border-gray-700">特高壓 (工業區)</div>
                  <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded text-right text-blue-800 dark:text-blue-200 font-black border border-blue-200 dark:border-blue-800">700~1000+</div>

                  <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded border border-gray-300 dark:border-gray-700">高壓 (竹北/竹東)</div>
                  <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-right border border-gray-300 dark:border-gray-700">400~700</div>

                  <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded border border-gray-300 dark:border-gray-700">一般 (鄉鎮)</div>
                  <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-right border border-gray-300 dark:border-gray-700">250~350</div>

                  <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded border border-gray-300 dark:border-gray-700">弱水/末端 (偏鄉)</div>
                  <div className="bg-red-100 dark:bg-red-900 p-2 rounded text-right text-red-600 dark:text-red-300 font-black border border-red-200 dark:border-red-800">150~250</div>
                </div>
              </div>
            </div>
          </section>

          <hr className="border-gray-400 dark:border-gray-600" />
          
          <p className="text-base text-gray-600 dark:text-gray-400 font-bold text-center">
             *本模型為「穩態供水模型」，反映長時間可持續供水能力。<br/>
             *實際壓力請以現場壓力錶為最終依據。
          </p>

        </div>
      </div>
    </div>
  );
};

export default InfoModal;