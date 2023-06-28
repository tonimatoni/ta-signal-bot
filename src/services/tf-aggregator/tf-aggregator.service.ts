import { Injectable } from '@nestjs/common';
import { Subject, finalize } from 'rxjs';
import { InputService } from '../input/input.service';
import { TickerDto } from '../../types/ticker.dto';
import { ConfigService } from '../config/config.service';

@Injectable()
export class TfAggregatorService {

    tfData: Subject<any> = new Subject();

    timeGroup: number;

    constructor(
        private readonly inputService: InputService,
        private readonly configService: ConfigService
    ) {



        this.inputService.data
            .pipe(
                finalize(() => {
                    this.tfData.complete();
                })
            )
            .subscribe((ticker) => {

                const {
                    minutes,
                    seconds,
                    milliseconds,
                    time
                } = this.getDateProperties(ticker);

                let currentTimeGroup = time - (minutes % this.configService.timeframe) * 60 * 1000 - seconds * 1000 - milliseconds;

                if (!this.timeGroup) {
                    this.timeGroup = currentTimeGroup;
                }

                if (this.timeGroup !== currentTimeGroup) {
                    this.timeGroup = currentTimeGroup;
                    this.tfData.next({
                        timeGroup: this.timeGroup,
                        high: ticker.high,
                        low: ticker.low,
                        volume: ticker.volume,
                        close: ticker.close,
                        open: ticker.open,
                        time: ticker.time,
                        timeFrom: ticker.time,
                        timeTo: ticker.time + this.configService.timeframe * 60 * 1000
                    });
                }



            });
    }

    private getDateProperties(ticker: TickerDto) {



        try {
            const date = new Date(ticker.time);
            const minutes = date.getMinutes();
            const seconds = date.getSeconds();
            const milliseconds = date.getMilliseconds();
            const time = date.getTime();

            return {
                minutes,
                seconds,
                milliseconds,
                time
            }
        } catch (error) {
            console.log(error);
            console.log(ticker);
        }




    }
}
