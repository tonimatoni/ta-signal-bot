import { Injectable } from '@nestjs/common';

@Injectable()
export class ConfigService {

    amount = 1000;
    leverage = 10;

    riskRewardRatio = 2;

    strategy = Strategies.MACD_200EMA;

    stochastic = {
        period: 14,
        smoothK: 3,
        smoothD: 3,
        overbought: 80,
        oversold: 20
    };

    rsi = {
        period: 2,
        overbought: 70,
        oversold: 30
    };

    macd = {
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
    };

    adx = {
        period: 14,
        candlesToConsider: 100,
    }

    atr = {
        period: 14,
        candlesToConsider: 999,
        multiplier: 2

    }

    ema = {
        period: 200
    }

    
    stopLoss = {
        enabled: false,

        maxPercentage: -0.0035,
        dontPlay: false
    };

    stopPrice = {
        strategy: StopPriceStrategy.EMA,
    }

    timeframe = 60;
    warmupPeriod: number = 200;

}

export enum StopPriceStrategy {

    SWING_LOW = 'swing_low',
    ATR = 'atr',
    EMA = 'ema',
    FIXED = 'fixed',
    NONE = 'none'
};

export enum Strategies {
    MACD_STOCH_RSI = 'macd_stoch_rsi',
    MACD_ADX_EMA = 'macd_adx_ema',
    ADX = 'adx',
    MACD_200EMA = 'macd_200ema',

    BB_RSI_MA = 'bb_rsi_ma',
    ADX_RSI = 'adx_rsi',
    COMBINED = 'combined',
}