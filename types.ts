
export interface WaterState {
  // Page 1: Demand
  n15: number;
  n25: number;
  robotFlow: number;
  robotCount: number;

  // Page 2: Tanks
  smallTruck: number;   // 2 ton
  normalTruck: number;  // 4 ton
  reservoirTruck: number; // 10 ton
  truck12: number;      // 12 ton

  // Page 3: Sources
  hydrant: number;
  hydrantFlow: number;
  smallPump: number;
  smallPumpFlow: number;
  normalPump: number;
  normalFlow: number;
  reservoirPump: number;
  reservoirPumpFlow: number;
  portablePump: number;
  portablePumpFlow: number;

  // Page 4: Relay / Circulation
  modDist: number;   // km
  modLines: number;
  modP: number;      // kg/cm2
  modWork: number;   // minutes
  srcS: number;      // Source truck size (tons)
  srcQh: number;     // Nominal source flow
  v2: number;
  v4: number;
  v10: number;
  v12: number;

  // Relay Trucks Active
  modN2: number;
  modN4: number;
  modN10: number;
  modN12: number;

  // Sliders
  frontReducePct: number;
  rearReducePct: number;
}

export interface CalculationResults {
  demand: number;
  totalTankL: number;
  totalTankGal: number;
  qFrontline: number;
  circEff: number;
  net: number;
  durationMin: number;
  coverage: number;
  
  // Specific Relay stats
  relayStats: {
    tc2: number; tc4: number; tc10: number; tc12: number;
    q2: number; q4: number; q10: number; q12: number; // Effective gpm per truck
    baseQ2: number; baseQ4: number; baseQ10: number; baseQ12: number; // Theoretical
    tFill2: number; tFill4: number; tFill10: number; tFill12: number;
    td2: number; td4: number; td10: number; td12: number;
  };

  // Status messages
  bottleneckMsg: string;
  hydrantStatusMsg: string;
  twoPhaseMsg: string;
  sourceTruckMsg: {
    msg2: string;
    msg4: string;
    msg10: string;
    msg12: string;
  };
  
  // Numeric stats for display
  compression: number;
  qIntakeEff: number;
  totalCircDemand: number;
  hydrantUtilFrac: number;
  tFillSource: number;
  overallInterval: number;
}
