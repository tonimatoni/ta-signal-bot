export type TradeOpenDto = {
    id: string;
    type: 'long' | 'short';
    price: number;
    time: number;
    timeFrom: number;
    timeTo: number;
    stopLossPrice: number;
    takeProfitPrice: number;
    [x: string]: any;

    stochasticRsi?: any;
    macd?: any;
    rsi?: number;
}

export type TradeCloseDto = {
    id: string;
    closedId: string;
    price: number;
    time: number;
    timeFrom: number;
    timeTo: number;
    pnl: number;

}