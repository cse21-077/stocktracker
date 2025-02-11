export interface FinancialEvent {
    id?: number;
    ticker: string;
    eventDate: Date;
    eventName: string;
    eventType: string;
    impact: string;
    cleanImpliedVol?: number;
    dirtyVolume?: number;
    totalImpliedVol?: number;
    vol?: number;
  }