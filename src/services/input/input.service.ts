import { Injectable } from '@nestjs/common';
import { TickerDto } from '../../types/ticker.dto';
import { Observable, Subject } from 'rxjs';



@Injectable()
export class InputService {

    data: Subject<TickerDto> = new Subject();
    inputData: Observable<TickerDto> = new Observable();

    constructor() {



    }

}
