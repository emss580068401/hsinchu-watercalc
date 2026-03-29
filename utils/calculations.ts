import { WaterState, CalculationResults } from '../types';
import { L_PER_GAL, GAL_PER_TON, PSI_PER_KG, HOSE_D_INCH } from '../constants';

const fmt = (n: number, d = 1) => n.toFixed(d);

function driveTime(D: number, V: number) {
  return (D <= 0 || V <= 0) ? 0 : (2 * D / V) * 60;
}

function calcFillTime(Ssource: number, Ttons: number, Pkg: number, Nline: number, Q_intake_eff: number, rearFactor: number) {
  const Vs = GAL_PER_TON * Ssource;
  const Vt = GAL_PER_TON * Ttons;
  const Ppsi = Pkg * PSI_PER_KG;
  const d = HOSE_D_INCH;

  const Q_supplyLineTheory = 29.7 * d * d * Math.sqrt(Ppsi);
  const Qout = Nline * Q_supplyLineTheory * rearFactor;

  if (Qout <= 0) return Infinity;

  const Qnet = Qout - Q_intake_eff;
  const tIdeal = Vt / Qout;

  if (Qnet <= 0) return tIdeal;

  const tEmpty = Vs / Qnet;
  if (tEmpty >= tIdeal) return tIdeal;

  if (Q_intake_eff <= 0) return Infinity;

  return tEmpty + (Vt - Qout * tEmpty) / Q_intake_eff;
}

function calcModule(Ttons: number, Vkmh: number, Pkg: number, Nline: number, Dkm: number, Twork: number, Ssource: number, Q_intake_eff: number, rearFactor: number) {
  if (Pkg <= 0 || Nline <= 0) return { Tc: Infinity, Q_L: 0, Q_G: 0, tFill: 0, tDrive: 0 };

  const tDrive = driveTime(Dkm, Vkmh);
  const tFill = calcFillTime(Ssource, Ttons, Pkg, Nline, Q_intake_eff, rearFactor);

  if (!isFinite(tFill)) return { Tc: Infinity, Q_L: 0, Q_G: 0, tFill: Infinity, tDrive };

  const Tc = tDrive + Twork + tFill;
  const Q_L = Tc > 0 ? (Ttons * 1000) / Tc : 0;
  const Q_G = Q_L / L_PER_GAL;

  return { Tc, Q_L, Q_G, tFill, tDrive };
}

function getSourceStatusMessage(Ssource: number, Ttons: number, Pkg: number, Nline: number, Q_intake_eff: number, rearFactor: number): string {
  if (Pkg <= 0 || Nline <= 0) return '請設定供水線數與出水壓力';
  
  const Vs = GAL_PER_TON * Ssource;
  const Vt = GAL_PER_TON * Ttons;
  const Ppsi = Pkg * PSI_PER_KG;
  const d = HOSE_D_INCH;

  const Q_supplyLineTheory = 29.7 * d * d * Math.sqrt(Ppsi);
  const Qout = Nline * Q_supplyLineTheory * rearFactor;

  if (Qout <= 0) return '供水線流量為 0';

  const Qnet = Qout - Q_intake_eff;
  const tIdeal = Vt / Qout;

  if (Qnet <= 0) return '供水車不會被抽乾 (補水≥出水)';

  const tEmpty = Vs / Qnet;
  if (tEmpty >= tIdeal) return '加滿循環車前不會抽乾';
  if (Q_intake_eff <= 0) return '加滿前會被抽乾 (無法再補水)';
  
  return '加滿前會被抽乾 (依賴後段補水)';
}

export function calculateAll(s: WaterState): CalculationResults {
  const rearFactor = 1 - s.rearReducePct / 100;
  const frontFactor = 1 - s.frontReducePct / 100;

  // 1. Demand
  const demand = (100 * s.n15) + (200 * s.n25) + (s.robotFlow * s.robotCount);

  // 2. Frontline Sources
  const qFrontlineNominal = 
    (s.hydrant * s.hydrantFlow) +
    (s.smallPump * s.smallPumpFlow) +
    (s.normalPump * s.normalFlow) +
    (s.reservoirPump * s.reservoirPumpFlow) +
    (s.portablePump * s.portablePumpFlow);
  
  const qFrontline = qFrontlineNominal * frontFactor;

  // 3. Intake
  const qIntakeNominal = s.srcQh;
  const qIntakeEff = qIntakeNominal * rearFactor;

  // 4. Relay Modules
  const m2 = calcModule(2, s.v2, s.modP, s.modLines, s.modDist, s.modWork, s.srcS, qIntakeEff, rearFactor);
  const m4 = calcModule(4, s.v4, s.modP, s.modLines, s.modDist, s.modWork, s.srcS, qIntakeEff, rearFactor);
  const m10 = calcModule(10, s.v10, s.modP, s.modLines, s.modDist, s.modWork, s.srcS, qIntakeEff, rearFactor);
  const m12 = calcModule(12, s.v12, s.modP, s.modLines, s.modDist, s.modWork, s.srcS, qIntakeEff, rearFactor);

  const totalCircDemand = 
    (m2.Q_G * s.modN2) + 
    (m4.Q_G * s.modN4) + 
    (m10.Q_G * s.modN10) + 
    (m12.Q_G * s.modN12);

  const compression = totalCircDemand > 0 
    ? (qIntakeEff > 0 ? Math.min(1, qIntakeEff / totalCircDemand) : 0)
    : 0;

  const circEff = totalCircDemand * compression;

  // 5. Net & Tanks
  const qSupply = qFrontline + circEff;
  const net = Math.max(0, demand - qSupply);

  const totalTankL = 
    (s.smallTruck * 2000) + 
    (s.normalTruck * 4000) + 
    (s.reservoirTruck * 10000) + 
    (s.truck12 * 12000);
  const totalTankGal = totalTankL / L_PER_GAL;

  const durationMin = (net > 0 && totalTankGal > 0) ? totalTankGal / net : 0;
  const coverage = demand > 0 ? Math.min(100, (qSupply / demand) * 100) : 0;

  // 6. Messages
  // Bottleneck
  let bottleneckMsg = "水源與車隊尚未計算";
  if (totalCircDemand > 0) {
    if (qIntakeEff <= 0) {
      bottleneckMsg = "折減後取水為 0，水源為瓶頸";
    } else if (compression >= 1) {
      bottleneckMsg = `水源充足，車隊為限制 (車隊佔水源 ${fmt((totalCircDemand/qIntakeEff)*100, 0)}%)`;
    } else {
      bottleneckMsg = `水源為瓶頸 (車隊僅發揮 ${fmt(compression*100, 0)}% 效能)`;
    }
  }

  // Hydrant Status
  let hydrantStatusMsg = "未投入車隊";
  const hydrantUtilFrac = (qIntakeEff > 0 && totalCircDemand > 0) ? totalCircDemand / qIntakeEff : 0;
  const utilP = hydrantUtilFrac * 100;

  if (totalCircDemand > 0) {
    if (qIntakeEff <= 0) hydrantStatusMsg = "無法計算 (取水為0)";
    else if (utilP >= 120) hydrantStatusMsg = "嚴重不足 (>120%)：需求遠大於水源，請立即增加水源或減線！";
    else if (utilP >= 100) hydrantStatusMsg = "已成瓶頸 (100%)：水源極限，無法再加車";
    else if (utilP >= 70) hydrantStatusMsg = "利用率偏高 (70%+)：水源接近滿載";
    else hydrantStatusMsg = "利用率中低 (有餘裕)：可繼續增加循環車輛";
  }

  // Two Phase
  let twoPhaseMsg = "資料不足";
  if (totalCircDemand > 0 && qIntakeEff > 0 && s.srcS > 0) {
    const longTerm = Math.min(totalCircDemand, qIntakeEff);
    const netDrain = totalCircDemand - qIntakeEff;
    
    if (netDrain <= 0) {
      twoPhaseMsg = `供水穩定\n長期可維持 ${fmt(longTerm, 0)} gpm`;
    } else {
      const drainTime = (s.srcS * GAL_PER_TON) / netDrain;
      twoPhaseMsg = `短期 (約${fmt(drainTime, 0)}分內): 供水車有水，維持 ${fmt(totalCircDemand, 0)} gpm\n長期 (> ${fmt(drainTime, 0)}分): 供水車抽乾，降至 ${fmt(longTerm, 0)} gpm`;
    }
  }

  // Intervals
  let tripsPerMin = 0;
  if (s.modN2 > 0 && isFinite(m2.Tc) && m2.Tc > 0) tripsPerMin += s.modN2 / m2.Tc;
  if (s.modN4 > 0 && isFinite(m4.Tc) && m4.Tc > 0) tripsPerMin += s.modN4 / m4.Tc;
  if (s.modN10 > 0 && isFinite(m10.Tc) && m10.Tc > 0) tripsPerMin += s.modN10 / m10.Tc;
  if (s.modN12 > 0 && isFinite(m12.Tc) && m12.Tc > 0) tripsPerMin += s.modN12 / m12.Tc;
  
  const overallInterval = tripsPerMin > 0 ? 1 / tripsPerMin : 0;

  let tFillSource = 0;
  if (qIntakeEff > 0 && s.srcS > 0) {
     tFillSource = (s.srcS * 1000) / (qIntakeEff * L_PER_GAL);
  }

  return {
    demand,
    totalTankL,
    totalTankGal,
    qFrontline,
    circEff,
    net,
    durationMin,
    coverage,
    relayStats: {
      tc2: m2.Tc, tc4: m4.Tc, tc10: m10.Tc, tc12: m12.Tc,
      q2: m2.Q_G * compression, q4: m4.Q_G * compression, q10: m10.Q_G * compression, q12: m12.Q_G * compression,
      baseQ2: m2.Q_G, baseQ4: m4.Q_G, baseQ10: m10.Q_G, baseQ12: m12.Q_G,
      tFill2: m2.tFill, tFill4: m4.tFill, tFill10: m10.tFill, tFill12: m12.tFill,
      td2: m2.tDrive, td4: m4.tDrive, td10: m10.tDrive, td12: m12.tDrive,
    },
    bottleneckMsg,
    hydrantStatusMsg,
    twoPhaseMsg,
    sourceTruckMsg: {
      msg2: getSourceStatusMessage(s.srcS, 2, s.modP, s.modLines, qIntakeEff, rearFactor),
      msg4: getSourceStatusMessage(s.srcS, 4, s.modP, s.modLines, qIntakeEff, rearFactor),
      msg10: getSourceStatusMessage(s.srcS, 10, s.modP, s.modLines, qIntakeEff, rearFactor),
      msg12: getSourceStatusMessage(s.srcS, 12, s.modP, s.modLines, qIntakeEff, rearFactor),
    },
    compression,
    qIntakeEff,
    totalCircDemand,
    hydrantUtilFrac,
    tFillSource,
    overallInterval
  };
}