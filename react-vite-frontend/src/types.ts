import { Socket } from 'socket.io-client';

export interface MousePosition {
  x: number;
  y: number;
}

export interface StepGroup {
  id: string;
  name: string;
  steps: Step[];
  loopCount: number;
  collapsed?: boolean;
}

export interface Step {
  id: string;
  type: string;
  data: StepData;
  groupId?: string;
}

export interface StepData {
  wait_time: number;
  randomize: boolean;
  x?: number;
  y?: number;
  button?: string;
  key?: string;
  isGroup?: boolean;
  groupName?: string;
  groupSteps?: Step[];
  groupLoopCount?: number;
  [key: string]: any;
}

export interface RandomTimingConfig {
  enabled: boolean;
  min_factor: number;
  max_factor: number;
}

export type SocketType = Socket | null; 