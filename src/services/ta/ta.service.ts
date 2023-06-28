import { Injectable } from '@nestjs/common';
import { MACD, RSI, StochasticRSI } from 'technicalindicators';
import { TimeframeDto } from '../../types/timeframe.dto';
import { MACDOutput } from 'technicalindicators/declarations/moving_averages/MACD';

import * as ta from 'technicalindicators'

const ATR = ta.ATR
import { StochasticRSIOutput } from 'technicalindicators/declarations/momentum/StochasticRSI';
import { ConfigService, StopPriceStrategy } from '../config/config.service';
@Injectable()
export class TaService {


    constructor(
        private configService: ConfigService
    ) { }

    calculatePnl(price: number, close: number, direction: 'long' | 'short' = 'long') {

        let change = this.calculateChangePercentage(price, close);

        if(direction === 'short') change *= -1;

        console.log(`PnL: ${this.configService.amount * change}. Change: ${change}`);

        this.configService.amount = this.configService.amount + this.configService.amount * change;

        console.log(`New amount: ${this.configService.amount}`);

        return this.configService.amount * change;
    }

    calculateRsi(data: number[]) {

        const indicator = RSI.calculate({
            values: data,
            period: this.configService.rsi.period
        });

        return indicator[indicator.length - 1]
    }

    calculateStochRsi(data: number[]) {

        const indicator = StochasticRSI.calculate({
            values: data,
            rsiPeriod: this.configService.stochastic.period,
            stochasticPeriod: this.configService.stochastic.period,
            kPeriod: this.configService.stochastic.smoothK,
            dPeriod: this.configService.stochastic.smoothD
        });

        return indicator[indicator.length - 1]
    }

    calculateMACD(data: number[]) {

        const indicator = MACD.calculate({
            values: data,
            fastPeriod: this.configService.macd.fastPeriod,
            slowPeriod: this.configService.macd.slowPeriod,
            signalPeriod: this.configService.macd.signalPeriod,
            SimpleMAOscillator: false,
            SimpleMASignal: false
        });

        return indicator[indicator.length - 1]
    }

    calculateEmas(data: number[]) {

        const indicator = ta.EMA.calculate({
            values: data,
            period: this.configService.ema.period
        });

        return indicator[indicator.length - 1]
    }

    getStopPrices(prices: TimeframeDto[], entryPrice: TimeframeDto, direction: 'long' | 'short' = 'long'): { stopLossPrice: any; takeProfitPrice: any; } {

        if (this.configService.stopPrice.strategy === StopPriceStrategy.ATR) {
            return this.calculateAtrStopPrices(prices, entryPrice, direction);
        } else if (this.configService.stopPrice.strategy === StopPriceStrategy.SWING_LOW) {
            return this.calculateSwingLowStopPrices(prices, entryPrice, direction);
        } return {
            stopLossPrice: 0,
            takeProfitPrice: 0
        }
    }
    calculateSwingLowStopPrices(prices: TimeframeDto[], entryPrice: TimeframeDto, direction: 'long' | 'short') {

        let stopLossPrice = 0;
        if (direction === 'long') {
            stopLossPrice = Math.min(...prices.map(price => price.low).slice(-8));

        } else {
            stopLossPrice = Math.max(...prices.map(price => price.high).slice(-8));
        }


        return this.getPrices(entryPrice, stopLossPrice, direction);
    }

    calculateAtrStopPrices(prices: TimeframeDto[], entryPrice: TimeframeDto, direction: 'long' | 'short') {

        const atr = this.calculateAtr(prices);

        let stopLossPrice = 0;
        if (direction === 'long') {
            stopLossPrice = entryPrice.close - atr * this.configService.atr.multiplier;
        } else {

            stopLossPrice = entryPrice.close + atr * this.configService.atr.multiplier;
        }

        return this.getPrices(entryPrice, stopLossPrice, direction);
    }

    getPrices(entryPrice: TimeframeDto, stopLossPrice: number, direction: 'long' | 'short'): { stopLossPrice: number; takeProfitPrice: number; } {

        if (direction === 'long') {
            return this.getPricesLong(entryPrice, stopLossPrice);
        } else {
            return this.getPricesShort(entryPrice, stopLossPrice);
        }


    }

    getPricesShort(entryPrice: TimeframeDto, stopLossPrice: number) {

        let stopLossChangePercentage = this.calculateChangePercentage(entryPrice.close, stopLossPrice);
        const takeProfitPrice = entryPrice.close - entryPrice.close * Math.abs(stopLossChangePercentage) * this.configService.riskRewardRatio;

        if (this.configService.stopLoss.enabled && stopLossChangePercentage > this.configService.stopLoss.maxPercentage) {

            if (this.configService.stopLoss.dontPlay)
                return {
                    stopLossPrice: 0,
                    takeProfitPrice: 0
                }

        }

        return {
            stopLossPrice,
            takeProfitPrice
        };
    }

    getPricesLong(entryPrice: TimeframeDto, stopLossPrice: number) {

        let stopLossChangePercentage = this.calculateChangePercentage(entryPrice.close, stopLossPrice);
        const takeProfitPrice = entryPrice.close + entryPrice.close * Math.abs(stopLossChangePercentage) * this.configService.riskRewardRatio;


        if (this.configService.stopLoss.enabled && stopLossChangePercentage < this.configService.stopLoss.maxPercentage) {

            if (this.configService.stopLoss.dontPlay)
                return {
                    stopLossPrice: 0,
                    takeProfitPrice: 0
                }

            stopLossChangePercentage = this.configService.stopLoss.maxPercentage;
            stopLossPrice = entryPrice.close + entryPrice.close * stopLossChangePercentage;

        }

        return {
            stopLossPrice,
            takeProfitPrice
        };
    }


    private calculateChangePercentage(firstValue: number, secondValue: number) {

        return ((secondValue - firstValue) / firstValue);
    }

    isMacdCrossed(macd: MACDOutput, prevMacd: MACDOutput) {

        return macd.MACD < 0 &&
            macd.signal < 0 &&
            prevMacd.MACD < prevMacd.signal &&
            macd.MACD > macd.signal
    }

    isMacdCrossedShort(macd: MACDOutput, prevMacd: MACDOutput) {

        return macd.MACD > 0 &&
            macd.signal > 0 &&
            prevMacd.MACD > prevMacd.signal &&
            macd.MACD < macd.signal
    }

    isStochOverbought(stoch: StochasticRSIOutput) {

        return stoch.k > this.configService.stochastic.overbought
            && stoch.d > this.configService.stochastic.overbought;
    }

    isStockOversold(stoch: StochasticRSIOutput) {


        return stoch.k < this.configService.stochastic.oversold
            && stoch.d < this.configService.stochastic.oversold;
    }

    isRsiOversold(rsi: number) {

        return rsi < this.configService.rsi.oversold;
    }

    isRsiOverbought(rsi: number) {

        return rsi > this.configService.rsi.overbought;
    }

    calculateAtr(data: TimeframeDto[]) {

        const atr = ATR.calculate({
            high: data.map(d => d.high),
            low: data.map(d => d.low),
            close: data.map(d => d.close),
            period: this.configService.atr.period
        });

        return atr[atr.length - 1];
    }
}