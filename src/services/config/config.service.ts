import { Injectable } from '@nestjs/common';

@Injectable()
export class ConfigService {

    amount = 1000;
    leverage = 10;

    riskRewardRatio = 1.5;

    strategy = Strategies.MACD_STOCH_RSI;

    stochastic = {
        period: 14,
        smoothK: 3,
        smoothD: 3,
        overbought: 80,
        oversold: 20
    };

    rsi = {
        period: 14,
        overbought: 70,
        oversold: 30
    };

    macd = {
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 5,
    };

    atr = {
        period: 14,
        candlesToConsider: 100,
        multiplier: 2

    }

    ema = {
        period: 200
    }

    
    stopLoss = {
        enabled: true,

        maxPercentage: -0.0035,
        dontPlay: false
    };

    stopPrice = {
        strategy: StopPriceStrategy.ATR,
    }

    timeframe = 5;
    warmupPeriod: number = 300;

}

export enum StopPriceStrategy {

    SWING_LOW = 'swing_low',
    ATR = 'atr',
    FIXED = 'fixed',
    NONE = 'none'
};

export enum Strategies {
    MACD_STOCH_RSI = 'macd_stoch_rsi',
    ADX = 'adx',
    ADX_RSI = 'adx_rsi',
}