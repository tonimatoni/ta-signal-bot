import { Injectable } from '@nestjs/common';
import { StochasticRSIOutput } from 'technicalindicators/declarations/momentum/StochasticRSI';
import { MACDOutput } from 'technicalindicators/declarations/moving_averages/MACD';
import { TimeframeDto } from '../../../../types/timeframe.dto';
import { TradeOpenDto, TradeCloseDto } from '../../../../types/trade.dto';
import { TaService } from '../../../ta/ta.service';
import { StrategyBaseInterface } from '../strategy-base.interface';

@Injectable()
export class MacdStochRsiService implements StrategyBaseInterface {

    tradeReady = false;
    stochCrossed = false;
    rsiAbove50 = false;

    tradeReadyShort = false;
    stochCrossedShort = false;
    rsiAbove50Short = false;

    prevTrade: TradeOpenDto;
    prevTradeClose: TradeCloseDto;
    prevStochRsi: StochasticRSIOutput
    prevRsi: number;
    prevMacd: MACDOutput;

    lastXTfData: TimeframeDto[] = [];

    constructor(
        private readonly taService: TaService,
    ) { }
    shouldEnterLong(tfData: TimeframeDto): boolean {
        throw new Error('Method not implemented.');
    }
    shouldEnterShort(tfData: TimeframeDto): boolean {
        throw new Error('Method not implemented.');
    }
    shouldExitLong(tfData: TimeframeDto): boolean {
        throw new Error('Method not implemented.');
    }
    shouldExitShort(tfData: TimeframeDto): boolean {
        throw new Error('Method not implemented.');
    }
    getStopPrices(tfData: TimeframeDto): { stopLoss: number; takeProfit: number; } {
        throw new Error('Method not implemented.');
    }

    

}
