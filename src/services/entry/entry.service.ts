import { Injectable } from '@nestjs/common';
import { SigGeneratorService } from '../sig-generator/sig-generator.service';
import { ConfigService } from '../config/config.service';
import { Observable, finalize, map } from 'rxjs';
import { TradeCloseDto, TradeOpenDto } from '../../types/trade.dto';
import { plot, Plot } from 'nodeplotlib';

@Injectable()
export class EntryService {

    takenEntryTrades: TradeOpenDto[] = [];
    takenExitTrades: TradeCloseDto[] = [];

    stats = {
        totalTrades: 0,
        totalWinningTrades: 0,
        totalLosingTrades: 0,
        totalPnl: 0,
        totalLongTrades: 0,
        totalShortTrades: 0,
        totalLongWinningTrades: 0,
        totalShortWinningTrades: 0,
        totalLongPnl: 0,
        totalShortPnl: 0,
        latestTradeClosedAt: null,
        latestTradeOpenAt: null,
    }

    constructor(
        private readonly sigGeneratorService: SigGeneratorService,
        private readonly configService: ConfigService,
    ) {
        this.sigGeneratorService.entrySignals.subscribe((signal) => {

            this.takenEntryTrades.push(signal);
        });

        this.sigGeneratorService.exitSignals
            .pipe(
                finalize(() => {
                    console.log(`Taken trades: ${this.takenExitTrades.length}`)
                    console.log(`PNL: ${this.takenExitTrades.reduce((acc, trade) => acc + trade.pnl, 0)}`)
                    console.log(`Winning trades: ${this.takenExitTrades.filter(trade => trade.pnl > 0).length}`)
                    console.log(`Losing trades: ${this.takenExitTrades.filter(trade => trade.pnl < 0).length}`)
                    console.log(`Win rate: ${this.takenExitTrades.filter(trade => trade.pnl > 0).length / this.takenExitTrades.length * 100}%`)

                    this.generateSummary();

                })
            )
            .subscribe((signal) => {

                this.takenExitTrades.push(signal);

                this.stats.totalTrades++;
                this.stats.totalPnl += signal.pnl;
                this.stats.totalWinningTrades += signal.pnl > 0 ? 1 : 0;
                this.stats.totalLosingTrades += signal.pnl < 0 ? 1 : 0;

                const closeId = signal.closedId;

                const entryTrade = this.takenEntryTrades.find(trade => trade.id === closeId);

                if (entryTrade.type == 'long') {
                    this.stats.totalLongTrades++;
                    if (signal.pnl > 0) {
                        this.stats.totalLongWinningTrades++;
                    }

                    this.stats.totalLongPnl += signal.pnl;
                } else {
                    this.stats.totalShortTrades++;
                    if (signal.pnl > 0) {
                        this.stats.totalShortWinningTrades++;
                    }
                    this.stats.totalShortPnl += signal.pnl;
                }
                this.stats.latestTradeClosedAt = new Date(signal.time).toUTCString();
                this.stats.latestTradeOpenAt = new Date(entryTrade.time).toUTCString();
                console.table(this.stats);

            });



    }

    generateSummary() {

        const groupedByMonth = this.takenExitTrades.reduce((acc, trade) => {

            const month = new Date(trade.time).getMonth();
            const year = new Date(trade.time).getFullYear();

            const key = `${month}-${year}`;

            if (!acc[key]) {
                acc[key] = [];
            }

            acc[key].push(trade);

            return acc;
        }, {});

        const monthly = Object.keys(groupedByMonth).map(key => {

            const trades = groupedByMonth[key];

            const totalPnl = trades.reduce((acc, trade) => acc + trade.pnl, 0);

            const winningTrades = trades.filter(trade => trade.pnl > 0).length;
            const losingTrades = trades.filter(trade => trade.pnl < 0).length;

            const winRate = winningTrades / trades.length * 100;

            const avgWin = trades.filter(trade => trade.pnl > 0).reduce((acc, trade) => acc + trade.pnl, 0) / trades.filter(trade => trade.pnl > 0).length;

            const avgLoss = trades.filter(trade => trade.pnl < 0).reduce((acc, trade) => acc + trade.pnl, 0) / trades.filter(trade => trade.pnl < 0).length;

            return {
                month: key,
                totalPnl,
                winningTrades,
                losingTrades,
                winRate,
                avgWin,
                avgLoss,
                avgTrade: totalPnl / trades.length,
                maxDrawdown: totalPnl / trades.length,
                maxDrawdownPct: totalPnl / trades.length,
                trades: trades.length,
            }


        });

        const summary = {
            totalTrades: this.takenExitTrades.length,
            totalPnl: this.takenExitTrades.reduce((acc, trade) => acc + trade.pnl, 0),
            winningTrades: this.takenExitTrades.filter(trade => trade.pnl > 0).length,
            losingTrades: this.takenExitTrades.filter(trade => trade.pnl < 0).length,
            winRate: this.takenExitTrades.filter(trade => trade.pnl > 0).length / this.takenExitTrades.length * 100,
            avgWin: this.takenExitTrades.filter(trade => trade.pnl > 0).reduce((acc, trade) => acc + trade.pnl, 0) / this.takenExitTrades.filter(trade => trade.pnl > 0).length,
            avgLoss: this.takenExitTrades.filter(trade => trade.pnl < 0).reduce((acc, trade) => acc + trade.pnl, 0) / this.takenExitTrades.filter(trade => trade.pnl < 0).length,
            avgTrade: this.takenExitTrades.reduce((acc, trade) => acc + trade.pnl, 0) / this.takenExitTrades.length,
            monthly

        }

        console.log(summary);

    }
}
