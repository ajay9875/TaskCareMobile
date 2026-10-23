declare module "react-native-step-tracker-pro" {
  export interface StepData {
    steps: number;
    date?: string;
  }

  export interface StepTrackerStatic {
    initialize(config: any): Promise<void>;
    requestPermissions(): Promise<boolean>;
    startTracking(): Promise<void>;
    addListener(
      event: string,
      callback: (data: StepData) => void,
    ): { remove: () => void };
    getTodaySteps(): Promise<number>;
    isBatteryOptimizationEnabled(): Promise<boolean>;
    requestDisableBatteryOptimization(): Promise<void>;
  }

  const StepTracker: StepTrackerStatic;
  export default StepTracker;
}
