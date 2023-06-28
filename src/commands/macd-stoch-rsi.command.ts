import { Command, Positional, Option } from 'nestjs-command';
import { Injectable } from '@nestjs/common';
import { InputService } from '../services/input/input.service';
import * as fs from 'fs';
import * as axios from 'axios';
@Injectable()
export class MacdStochRsiCommand {

    // located in ../csvs/price_data.csv
    filePath = `${__dirname}/../csvs/price_data.csv`;
    globalData = [];

    constructor(
        private readonly inputService: InputService,
    ) { }

    @Command({
        command: 'macd-stoch-rsi',
        describe: 'Runs the macd-stoch-rsi strategy',
    })
    async run(
        @Option({
            name: 'backtest',
            describe: 'Backtest the strategy',
            type: 'boolean',
            default: true
        })
        backtest: boolean,
    ) {
        console.log(`Running macd-stoch-rsi strategy with backtest: ${backtest}`)

        const data = fs.readFileSync(this.filePath, 'utf8');

        const csvData = this.extractDataFromCsv(data);

        setInterval(() => {
            
            if (csvData.length === 0) {
                this.inputService.data.complete();
                return;
            }
            
            this.inputService.data.next(csvData.shift());


        }, 0);

        // this.runLive();
    }

    private extractDataFromCsv(csvData) {
        return csvData.split('\n').map((row) => {

            const columns = row.split(';');

            return {
                time: parseInt(columns[0].replaceAll('"', '')),
                close: parseFloat(columns[1].replaceAll('"', '').replaceAll(',', '')),
                open: parseFloat(columns[2].replaceAll('"', '').replaceAll(',', '')),
                high: parseFloat(columns[3].replaceAll('"', '').replaceAll(',', '')),
                low: parseFloat(columns[4].replaceAll('"', '').replaceAll(',', ''))
            }
        })
    }

    // use API for live data https://api.polygon.io/v2/aggs/ticker/X:BTCUSD/range/5/minute/2023-05-09/2023-06-09?adjusted=true&sort=desc&limit=50000&apiKey=vSHjhyE0RBRZpFvnrSgsLgExv3F7nCu2
    async runLive() {
        console.log(`Running macd-stoch-rsi strategy with live data`)

        let fromYear = 2022;
        let fromMonth = 1;
        let toYear = 2022;
        let toMonth = 2;
        const pairs = [];

        while (fromYear != 2023 || fromMonth != 6) {

            const fromMonthStr = fromMonth < 10 ? `0${fromMonth}` : fromMonth;
            const toMonthStr = toMonth < 10 ? `0${toMonth}` : toMonth;

            pairs.push({
                fromMonthStr,
                toMonthStr,
                fromYear,
                toYear,
            });

            fromMonth++;
            toMonth++;

            if (fromMonth == 13) {
                fromMonth = 1;
                fromYear++;
            }

            if (toMonth == 13) {
                toMonth = 1;
                toYear++;
            }
        }

        console.log(pairs)

        for (const pair of pairs) {
            const url = `https://api.polygon.io/v2/aggs/ticker/X:ETHUSD/range/5/minute/${pair.fromYear}-${pair.fromMonthStr}-09/${pair.toYear}-${pair.toMonthStr}-08?adjusted=true&sort=asc&limit=50000&apiKey=vSHjhyE0RBRZpFvnrSgsLgExv3F7nCu2`;

            const response = await axios.default.get(url);

            const data = response.data.results.map((result) => {
                return {
                    time: result.t,
                    close: result.c,
                    open: result.o,
                    high: result.h,
                    low: result.l,
                }
            });

            console.log(data.length)

            await this.sleep(60000);

            this.globalData = [...this.globalData, ...data];
            console.log(this.globalData.length)
        }



        const csvData = this.globalData.map((record) => {
            return `"${record.time}";"${formatNumber(record.close)}";"${formatNumber(record.open)}";"${formatNumber(record.high)}";"${formatNumber(record.low)}"`;
        }).join('\n');

        fs.writeFileSync(this.filePath, csvData, 'utf-8');


        // function for format number (20,000.00)
        function formatNumber(number) {
            return number.toFixed(6).replace(/\d(?=(\d{3})+\.)/g, '$&,');
        }




        // `https://api.polygon.io/v2/aggs/ticker/X:ADAUSD/range/5/minute/${fromYear}-${fromMonth}-09/${toYear}-${toMonth}-08?adjusted=true&sort=asc&limit=50000&apiKey=vSHjhyE0RBRZpFvnrSgsLgExv3F7nCu2`



    }

    // async timeout function
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }



}
