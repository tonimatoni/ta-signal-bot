import { Injectable } from '@nestjs/common';
import { TfAggregatorService } from '../tf-aggregator/tf-aggregator.service';
import { TradeCloseDto, TradeOpenDto } from '../../types/trade.dto';
import { Subject, finalize } from 'rxjs';
import { TaService } from '../ta/ta.service';
import { TimeframeDto } from '../../types/timeframe.dto';
import { MACDOutput } from 'technicalindicators/declarations/moving_averages/MACD';
import { StochasticRSIOutput } from 'technicalindicators/declarations/momentum/StochasticRSI';
import { ConfigService, Strategies } from '../config/config.service';

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
    prevEma: number;

    lastXTfData: TimeframeDto[] = [];


    // TEMPORARY
    crossedRsi = null;
    crossedStoch = null;

    entrySignals: Subject<TradeOpenDto> = new Subject();
    exitSignals: Subject<TradeCloseDto> = new Subject();




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

                this.lastXTfData.push(tfData);

                if (this.lastXTfData.length > this.configService.atr.candlesToConsider) {

                    this.lastXTfData.shift();
                }
                if (this.counter > this.configService.warmupPeriod) {
                    if (this.counter === this.configService.warmupPeriod + 1) console.log(`Will start sending signals now`)

                    this.strategies[configService.strategy].sendLongEntrySignal(tfData);

                    this.strategies[configService.strategy].sendShortEntrySignal(tfData);


                    if (this.prevTrade && this.prevTrade.type === 'long')
                        this.strategies[configService.strategy].sendLongExitSignal(tfData);

                    if (this.prevTrade && this.prevTrade.type === 'short')
                        this.strategies[configService.strategy].sendShortExitSignal(tfData);
                }


                this.counter++;
            });
    }


    strategies = {

        [Strategies.MACD_STOCH_RSI]: {

            sendLongExitSignal: (tfData: TimeframeDto, force = false) => {

                const rsi = this.taService.calculateRsi(this.lastXTfData.map(d => d.close));

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

            },

            sendShortEntrySignal: (data: TimeframeDto) => {

                const stoch = this.taService.calculateStochRsi(this.lastXTfData.map(d => d.close));
                const rsi = this.taService.calculateRsi(this.lastXTfData.map(d => d.close));
                let { macd } = this.taService.calculateMACD(this.lastXTfData.map(d => d.close));

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
                    this.strategies[Strategies.MACD_STOCH_RSI].sendLongExitSignal(data, true);

                    if (this.prevTrade) {
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
            },

            sendShortExitSignal: (tfData: TimeframeDto, force = false) => {

                if (!this.prevTrade) return;

                const rsi = this.taService.calculateRsi(this.lastXTfData.map(d => d.close));

                const { stopLossPrice, takeProfitPrice } = this.prevTrade;

                if (tfData.close >= stopLossPrice || tfData.low >= stopLossPrice || tfData.close <= takeProfitPrice || force) {

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

                    console.table(this.prevTrade);
                    console.table(this.prevTradeClose);


                    this.exitSignals.next(this.prevTradeClose);

                    this.prevTrade = null;
                    this.prevTradeClose = null;
                }
            },

            sendLongEntrySignal: (data: TimeframeDto) => {

                const stoch = this.taService.calculateStochRsi(this.lastXTfData.map(d => d.close));
                const rsi = this.taService.calculateRsi(this.lastXTfData.map(d => d.close));
                let { macd } = this.taService.calculateMACD(this.lastXTfData.map(d => d.close));
                let adx = this.taService.calculateAdx(this.lastXTfData);


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
            },
        },

        [Strategies.MACD_ADX_EMA]: {

            sendLongEntrySignal: (data: TimeframeDto) => {

                let { macd } = this.taService.calculateMACD(this.lastXTfData.map(d => d.close));
                let { prevAdx, adx } = this.taService.calculateAdx(this.lastXTfData);
                let ema = this.taService.calculateEma(this.lastXTfData.map(d => d.close), 180);

                let latestCandle = this.lastXTfData[this.lastXTfData.length - 1];

                let isClosedAboveEma = latestCandle.close > ema && latestCandle.open < ema;
                let isHistogarmPositive = macd.histogram > 0;
                let isAdxAboveThreshold = adx.adx > 35;
                let isAdxRising = adx.adx > prevAdx.adx;
                let isAdxRisingFast = adx.pdi > adx.mdi;

                if (isClosedAboveEma && isHistogarmPositive && isAdxAboveThreshold && isAdxRising && isAdxRisingFast) {

                    if (this.prevTrade) {
                        return;
                    }

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
                        ema,
                        adx,
                        timeTo: data.time + 5 * 60 * 1000,
                        type: 'long'
                    }

                    this.entrySignals.next(this.prevTrade);

                }

                this.prevEma = ema;

            },

            sendLongExitSignal: (data: TimeframeDto) => {

                if (data.time === this.prevTrade.time) return;

                if (data.high > this.prevTrade.takeProfitPrice || data.low < this.prevTrade.stopLossPrice) {


                    let closingPrice = data.high > this.prevTrade.takeProfitPrice ? this.prevTrade.takeProfitPrice : this.prevTrade.stopLossPrice;

                    const pnl = this.taService.calculatePnl(this.prevTrade.price, closingPrice);

                    this.prevTradeClose = {

                        id: data.time + '-' + Math.random(),
                        price: data.close,
                        time: data.time,
                        timeFrom: this.prevTrade.time,
                        closedId: this.prevTrade.id,
                        pnl: pnl,
                        timeTo: data.time + 5 * 60 * 1000,
                    };
                    this.exitSignals.next(this.prevTradeClose);

                    console.table({
                        ...data,
                        ...this.prevTradeClose,
                        openPrice: this.prevTrade.price,
                        stopLossPrice: this.prevTrade.stopLossPrice,
                        takeProfitPrice: this.prevTrade.takeProfitPrice,
                        type: this.prevTrade.type,
                        adx: this.prevTrade.adx
                    });

                    this.prevTrade = null;
                    this.prevTradeClose = null;
                }

            },

            sendShortEntrySignal: (data: TimeframeDto) => {

                let { macd } = this.taService.calculateMACD(this.lastXTfData.map(d => d.close));
                let { prevAdx, adx } = this.taService.calculateAdx(this.lastXTfData);
                let ema = this.taService.calculateEma(this.lastXTfData.map(d => d.close), 180);

                let latestCandle = this.lastXTfData[this.lastXTfData.length - 1];
                let isClosedBelowEma = latestCandle.close < ema && latestCandle.open > ema;
                let isHistogarmNegative = macd.histogram < 0;
                let isAdxAboveThreshold = adx.adx > 35;
                let isAdxRising = adx.adx > prevAdx.adx;
                let isAdxRisingFast = adx.pdi < adx.mdi;

                if (isClosedBelowEma && isHistogarmNegative && isAdxAboveThreshold &&
                    isAdxRising && isAdxRisingFast
                ) {

                    let { stopLossPrice, takeProfitPrice } = this.taService.getStopPrices(this.lastXTfData, data);

                    if (stopLossPrice === 0 || takeProfitPrice === 0) return;

                    if (this.prevTrade) {
                        return;
                    }

                    this.prevTrade = {
                        id: data.time + '-' + Math.random(),
                        price: data.close,
                        stopLossPrice: stopLossPrice,
                        takeProfitPrice: takeProfitPrice,
                        time: data.time,
                        timeFrom: data.time,
                        macd,
                        ema,
                        adx: adx.adx,
                        timeTo: data.time + 5 * 60 * 1000,
                        type: 'short'
                    }

                    this.entrySignals.next(this.prevTrade);

                }

                this.prevEma = ema;
            },

            sendShortExitSignal: (data: TimeframeDto) => {

                if (data.time === this.prevTrade.time) return;

                if (data.high > this.prevTrade.stopLossPrice || data.low < this.prevTrade.takeProfitPrice) {

                    let { stopLossPrice, takeProfitPrice } = this.prevTrade;

                    let closingPrice = (data.high >= stopLossPrice) ? this.prevTrade.stopLossPrice : this.prevTrade.takeProfitPrice;

                    const pnl = this.taService.calculatePnl(this.prevTrade.price, closingPrice, 'short');

                    this.prevTradeClose = {
                        ...data,
                        closedId: this.prevTrade.id,
                        id: data.time + '-' + Math.random(),
                        pnl: pnl,
                        price: closingPrice,
                        time: data.time,
                        timeFrom: this.prevTrade.time,
                        timeTo: data.time + 5 * 60 * 1000,

                    }

                    this.exitSignals.next(this.prevTradeClose);
                    console.table({
                        ...this.prevTradeClose,
                        openPrice: this.prevTrade.price,
                        stopLossPrice: this.prevTrade.stopLossPrice,
                        takeProfitPrice: this.prevTrade.takeProfitPrice,
                        type: this.prevTrade.type,
                        adx: this.prevTrade.adx
                    });
                    this.prevTrade = null;
                    this.prevTradeClose = null;



                }

            },
        },

        [Strategies.ADX_RSI]: {

            sendLongEntrySignal: (data: TimeframeDto) => {

                const { prevAdx, adx } = this.taService.calculateAdx(this.lastXTfData);
                const rsi = this.taService.calculateRsi(this.lastXTfData.map(d => d.close));

                if (
                    prevAdx.adx < 35 &&
                    adx.adx > 35 && adx.pdi > adx.mdi) {

                    // this.strategies[Strategies.ADX_RSI].sendLongExitSignal(data, true);

                    if (this.prevTrade) {
                        return;
                    }

                    const { stopLossPrice, takeProfitPrice } = this.taService.getStopPrices(this.lastXTfData, data, 'long');

                    if (stopLossPrice === 0 || takeProfitPrice === 0) return;

                    this.prevTrade = {
                        id: data.time + '-' + Math.random(),
                        price: data.close,
                        stopLossPrice: stopLossPrice,
                        takeProfitPrice: takeProfitPrice,
                        time: data.time,
                        timeFrom: data.time,
                        adx,
                        rsi,
                        timeTo: data.time + 5 * 60 * 1000,
                        type: 'long'
                    }

                    this.entrySignals.next(this.prevTrade);
                }
            },

            sendLongExitSignal: (tfData: TimeframeDto) => {

                if (!this.prevTrade) return;

                const { stopLossPrice, takeProfitPrice } = this.prevTrade;

                if (tfData.close <= stopLossPrice || tfData.close >= takeProfitPrice) {

                    const closingPrice = (tfData.close <= stopLossPrice) ? this.prevTrade.stopLossPrice : this.prevTrade.takeProfitPrice;

                    const pnl = this.taService.calculatePnl(this.prevTrade.price, closingPrice, 'long');

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
            },

            sendShortEntrySignal: (data: TimeframeDto) => {

                const { prevAdx, adx } = this.taService.calculateAdx(this.lastXTfData);
                const rsi = this.taService.calculateRsi(this.lastXTfData.map(d => d.close));

                if (prevAdx.adx < 35 && adx.adx > 35 && adx.pdi < adx.mdi) {

                    if (this.prevTrade) {
                        return;
                    }

                    const { stopLossPrice, takeProfitPrice } = this.taService.getStopPrices(this.lastXTfData, data, 'short');

                    if (stopLossPrice === 0 || takeProfitPrice === 0) return;

                    this.prevTrade = {
                        id: data.time + '-' + Math.random(),
                        price: data.close,
                        stopLossPrice: stopLossPrice,
                        takeProfitPrice: takeProfitPrice,
                        time: data.time,
                        timeFrom: data.time,
                        adx,
                        rsi,
                        timeTo: data.time + 5 * 60 * 1000,
                        type: 'short'
                    }

                    this.entrySignals.next(this.prevTrade);
                }
            },

            sendShortExitSignal: (tfData: TimeframeDto) => {

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

        },

        [Strategies.BB_RSI_MA]: {

            entryPrice: null,
            holdingPeriod: 0,

            sendLongEntrySignal: (data: TimeframeDto) => {

                const { prevBb, bb } = this.taService.calculateBollingerBands(this.lastXTfData.map(d => d.close));


                if (prevBb.lower < this.lastXTfData[this.lastXTfData.length - 2].close && bb.lower > data.close) {

                    this.strategies[Strategies.BB_RSI_MA].entryPrice = data.close * 0.97
                }
                if (this.strategies[Strategies.BB_RSI_MA].entryPrice < data.close) {

                    const { stopLossPrice, takeProfitPrice } = this.taService.getStopPrices(this.lastXTfData, data, 'long')

                    this.prevTrade = {
                        id: data.time + '-' + Math.random(),
                        price: data.close,
                        stopLossPrice: stopLossPrice,
                        takeProfitPrice: takeProfitPrice,
                        time: data.time,
                        timeFrom: data.time,
                        timeTo: data.time + 5 * 60 * 1000,
                        type: 'long'
                    }

                    this.entrySignals.next(this.prevTrade);
                }



            },
            sendShortEntrySignal: (data: TimeframeDto) => {

            },
            sendLongExitSignal: (data: TimeframeDto) => {


                if (!this.prevTrade) return;

                const rsi = this.taService.calculateRsi(this.lastXTfData.map(d => d.close))
                console.log(rsi)
                const { stopLossPrice, takeProfitPrice } = this.prevTrade;

                if (data.close <= stopLossPrice || rsi > 50 || this.strategies[Strategies.BB_RSI_MA].holdingPeriod > 9) {


                    const closingPrice = (data.close <= stopLossPrice) ? this.prevTrade.stopLossPrice : data.close

                    const pnl = this.taService.calculatePnl(this.prevTrade.price, closingPrice, 'long');

                    this.prevTradeClose = {
                        id: data.time + '-' + Math.random(),
                        closedId: this.prevTrade.id,
                        price: closingPrice,
                        pnl: pnl,
                        time: data.time,
                        timeFrom: data.time,
                        timeTo: data.time + this.configService.timeframe * 60 * 1000
                    }


                    this.exitSignals.next(this.prevTradeClose);

                    this.prevTrade = null;
                    this.prevTradeClose = null;

                    this.strategies[Strategies.BB_RSI_MA].holdingPeriod = 0;
                } else {
                    this.strategies[Strategies.BB_RSI_MA].holdingPeriod += 1;
                }

            },
            sendShortExitSignal: (data: TimeframeDto) => {

            },

        },

        [Strategies.MACD_200EMA]: {
            sendLongEntrySignal: (tfData: TimeframeDto) => {

                // calculate ema and macd
                const { prevMacd, macd } = this.taService.calculateMACD(this.lastXTfData.map(d => d.close));
                const ema = this.taService.calculateEma(this.lastXTfData.map(d => d.close));

                // if price is under 200 ema -> return;
                if (tfData.close < ema) return;

                // if price is above 200 ema and macd crossed bellow 0 -> send signal
                if (this.taService.isMacdCrossed(macd, prevMacd) && tfData.close) {

                    this.prevTrade = {
                        id: tfData.time + '-' + Math.random(),
                        price: tfData.close,
                        stopLossPrice: tfData.close * 0.97,
                        takeProfitPrice: tfData.close * 1.03,
                        time: tfData.time,
                        timeFrom: tfData.time,
                        timeTo: tfData.time + 5 * 60 * 1000,
                        type: 'long'
                    }

                    this.entrySignals.next(this.prevTrade);
                }

            },
            sendShortEntrySignal: (tfData: TimeframeDto) => {

                const {prevMacd, macd} = this.taService.calculateMACD(this.lastXTfData.map(d => d.close));
                const ema = this.taService.calculateEma(this.lastXTfData.map(d => d.close));

                // if price is above 200 ema -> return;
                if (tfData.close > ema) return;

                // if price is under 200 ema and macd crossed above 0 -> send signal
                if (this.taService.isMacdCrossed(macd, prevMacd) && tfData.close) {

                    this.prevTrade = {
                        id: tfData.time + '-' + Math.random(),
                        price: tfData.close,
                        stopLossPrice: tfData.close * 1.03,
                        takeProfitPrice: tfData.close * 0.97,
                        time: tfData.time,
                        timeFrom: tfData.time,
                        timeTo: tfData.time + 5 * 60 * 1000,
                        type: 'short'
                    }

                    this.entrySignals.next(this.prevTrade);
                }
            },
            sendLongExitSignal: (tfData: TimeframeDto) => {


                if (!this.prevTrade) return;

                const { stopLossPrice, takeProfitPrice } = this.prevTrade;

                if (tfData.high >= takeProfitPrice || tfData.low <= stopLossPrice) {

                    const closingPrice = (tfData.close >= takeProfitPrice) ? this.prevTrade.takeProfitPrice : this.prevTrade.stopLossPrice

                    const pnl = this.taService.calculatePnl(this.prevTrade.price, closingPrice, 'long');

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

            },

            sendShortExitSignal: (tfData: TimeframeDto) => {

                if (!this.prevTrade) return;

                const { stopLossPrice, takeProfitPrice } = this.prevTrade;

                if (tfData.high >= stopLossPrice || tfData.low <= takeProfitPrice) {

                    const closingPrice = (tfData.close <= takeProfitPrice) ? this.prevTrade.takeProfitPrice : this.prevTrade.stopLossPrice

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
    }
}