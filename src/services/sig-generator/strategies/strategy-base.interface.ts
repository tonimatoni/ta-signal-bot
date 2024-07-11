import { TimeframeDto } from "../../../types/timeframe.dto";

export interface StrategyBaseInterface {

    shouldEnterLong(tfData: TimeframeDto): boolean;
    shouldEnterShort(tfData: TimeframeDto): boolean;
    shouldExitLong(tfData: TimeframeDto): boolean;
    shouldExitShort(tfData: TimeframeDto): boolean;

    getStopPrices(tfData: TimeframeDto): { stopLoss: number, takeProfit: number };
    
}