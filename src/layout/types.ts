export interface LaneBoundary {
  laneId: string;
  minLeft: number;
  maxRight: number;
  dividerX: number;
}

export interface PhaseBoundary {
  phaseId: string;
  label: string;
  minTop: number;
  maxBottom: number;
  dividerY: number;
}
