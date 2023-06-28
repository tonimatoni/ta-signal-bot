import { Injectable } from '@nestjs/common';
import { TfAggregatorService } from '../tf-aggregator/tf-aggregator.service';
import { TradeCloseDto, TradeOpenDto } from '../../types/trade.dto';
import { Subject, finalize } from 'rxjs';
import { TaService } from '../ta/ta.service';
import { TimeframeDto } from '../../types/timeframe.dto';
import { MACDOutput } from 'technicalindicators/declarations/moving_averages/MACD';
import { StochasticRSIOutput } from 'technicalindicators/declarations/momentum/StochasticRSI';
import { ConfigService } from '../config/config.service';

@Injectable()
export class SigGeneratorService {

    counter = 0;
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


    // TEMPORARY
    crossedRsi = null;
    crossedStoch = null;

    entrySignals: Subject<TradeOpenDto> = new Subject();
    exitSignals: Subject<TradeCloseDto> = new Subject();

    prices: number[] = [];



    constructor(
        private readonly tfAggregatorService: TfAggregatorService,
        private readonly taService: TaService,
        private readonly configService: ConfigService

    ) {

        this.tfAggregatorService.tfData
            .pipe(
                finalize(() => {
                    this.entrySignals.complete();
                    this.exitSignals.complete();
                })
            )
            .subscribe((tfData) => {

                this.prices.push(tfData.close);
                this.lastXTfData.push(tfData);

                if (this.lastXTfData.length > this.configService.atr.candlesToConsider) {

                    this.lastXTfData.shift();
                }

                if (this.counter > this.configService.warmupPeriod) {
                    if (this.counter === this.configService.warmupPeriod + 1) console.log(`Will start sending signals now`)

                    if (!this.prevTrade || this.prevTrade.type === 'short')
                        this.sendLongEntrySignal(tfData);
                    if (!this.prevTrade || this.prevTrade.type === 'long')
                        this.sendShortEntrySignal(tfData);

                    if (this.prevTrade && this.prevTrade.type === 'long')
                        this.sendLongExitSignal(tfData);

                    if (this.prevTrade && this.prevTrade.type === 'short')
                        this.sendShortExitSignal(tfData);
                }


                this.counter++;
            });
    }


    sendLongEntrySignal(data: TimeframeDto) {

        const stoch = this.taService.calculateStochRsi(this.prices);
        const rsi = this.taService.calculateRsi(this.prices);
        let macd = this.taService.calculateMACD(this.prices);

        if (this.taService.isStochOverbought(stoch)) {
            this.tradeReady = false;
            this.rsiAbove50 = false;
            this.stochCrossed = false;
        }

        if (this.taService.isStockOversold(stoch)) {

            this.tradeReady = true;
        } else {
            this.tradeReady = false;
        }

        if (
            this.prevStochRsi &&
            this.tradeReady &&
            this.prevStochRsi.k < this.prevStochRsi.d &&
            stoch.k < 20 && stoch.d < 20 &&
            stoch.k > stoch.d
        ) {
            this.stochCrossed = true;
            this.crossedStoch = stoch;
            this.tradeReady = false;
        }

        if (this.stochCrossed && this.prevRsi < 50 && rsi > 50) {
            this.rsiAbove50 = true;
            this.crossedRsi = rsi;

            this.stochCrossed = false;
        } else {
            this.rsiAbove50 = false;
        }

        if (this.rsiAbove50 &&
            this.taService.isMacdCrossed(macd, this.prevMacd) &&
            !this.taService.isStochOverbought(stoch)
        ) {

            if (this.prevTrade) {
                console.log(`Wouldve taken a long trade here but already in a trade`)
                return;
            }

            this.rsiAbove50 = false;

            const { stopLossPrice, takeProfitPrice } = this.taService.getStopPrices(this.lastXTfData, data);

            if (stopLossPrice === 0 || takeProfitPrice === 0) return;
            this.prevTrade = {
                id: data.time + '-' + Math.random(),
                price: data.close,
                stopLossPrice: stopLossPrice,
                takeProfitPrice: takeProfitPrice,
                time: data.time,
                timeFrom: data.time,
                macd,
                crossedRsi: this.crossedRsi,
                crossedStochRsi: this.crossedStoch,
                rsi,
                stochasticRsi: stoch,
                timeTo: data.time + 5 * 60 * 1000,
                type: 'long'
            }

            this.entrySignals.next(this.prevTrade);
        }

        this.prevStochRsi = stoch;
        this.prevMacd = macd;
        this.prevRsi = rsi;
    }

    sendLongExitSignal(tfData: TimeframeDto, force = false) {

        if (!this.prevTrade) return;

        const { stopLossPrice, takeProfitPrice } = this.prevTrade;

        if (tfData.close <= stopLossPrice || tfData.close >= takeProfitPrice || force) {

            const closingPrice = (tfData.close <= stopLossPrice) ? this.prevTrade.stopLossPrice : this.prevTrade.takeProfitPrice;

            const pnl = this.taService.calculatePnl(this.prevTrade.price, closingPrice);

            this.prevTradeClose = {
                id: tfData.time + '-' + Math.random(),
                closedId: this.prevTrade.id,
                price: closingPrice,
                pnl: pnl,
                time: tfData.time,
                timeFrom: tfData.time,
                timeTo: tfData.time + this.configService.timeframe * 60 * 1000
            }

            this.exitSignals.next(this.prevTradeClose);

            this.prevTrade = null;
            this.prevTradeClose = null;
        }

    }


    sendShortEntrySignal(data: TimeframeDto) {

        const stoch = this.taService.calculateStochRsi(this.prices);
        const rsi = this.taService.calculateRsi(this.prices);
        let macd = this.taService.calculateMACD(this.prices);

        if (this.taService.isStockOversold(stoch)) {
            this.tradeReadyShort = false;
            this.rsiAbove50Short = false;
            this.stochCrossedShort = false;
        }

        if (this.taService.isStochOverbought(stoch)) {
            this.tradeReadyShort = true;
        } else {
            this.tradeReadyShort = false;
        }

        if (
            this.prevStochRsi &&
            this.tradeReadyShort &&
            this.prevStochRsi.d < this.prevStochRsi.k &&
            this.taService.isStochOverbought(stoch) &&
            stoch.k < stoch.d
        ) {
            this.stochCrossedShort = true;
            this.crossedStoch = stoch;
            this.tradeReadyShort = false;
        }

        if (this.stochCrossedShort && this.prevRsi > 50 && rsi < 50) {
            this.rsiAbove50Short = true;
            this.crossedRsi = rsi;

            this.stochCrossedShort = false;
        } else {
            this.rsiAbove50Short = false;
        }

        if (this.rsiAbove50Short &&
            this.taService.isMacdCrossedShort(macd, this.prevMacd) &&
            !this.taService.isStockOversold(stoch)
        ) {
            this.sendLongExitSignal(data, true);

            if (this.prevTrade) {
                console.log(`Wouldve taken a short trade here but already in a trade`)
                return;
            }

            this.rsiAbove50Short = false;

            const { stopLossPrice, takeProfitPrice } = this.taService.getStopPrices(this.lastXTfData, data, 'short');

            if (stopLossPrice === 0 || takeProfitPrice === 0) return;

            this.prevTrade = {
                id: data.time + '-' + Math.random(),
                price: data.close,
                stopLossPrice: stopLossPrice,
                takeProfitPrice: takeProfitPrice,
                time: data.time,
                timeFrom: data.time,
                macd,
                crossedRsi: this.crossedRsi,
                crossedStochRsi: this.crossedStoch,
                rsi,
                stochasticRsi: stoch,
                timeTo: data.time + 5 * 60 * 1000,
                type: 'short'
            }

            this.entrySignals.next(this.prevTrade);
        }

        this.prevStochRsi = stoch;
        this.prevMacd = macd;
        this.prevRsi = rsi;
    }

    sendShortExitSignal(tfData: TimeframeDto) {

        if (!this.prevTrade) return;

        const { stopLossPrice, takeProfitPrice } = this.prevTrade;

        if (tfData.close >= stopLossPrice || tfData.close <= takeProfitPrice) {

            const closingPrice = (tfData.close >= stopLossPrice) ? this.prevTrade.stopLossPrice : this.prevTrade.takeProfitPrice;

            const pnl = this.taService.calculatePnl(this.prevTrade.price, closingPrice, 'short');

            this.prevTradeClose = {
                id: tfData.time + '-' + Math.random(),
                closedId: this.prevTrade.id,
                price: closingPrice,
                pnl: pnl,
                time: tfData.time,
                timeFrom: tfData.time,
                timeTo: tfData.time + this.configService.timeframe * 60 * 1000
            }

            this.exitSignals.next(this.prevTradeClose);

            this.prevTrade = null;
            this.prevTradeClose = null;
        }
    }


}
