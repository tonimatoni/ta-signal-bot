# Simple Technical Analysis signal bot (created for fun)

## Description

This is a simple TA signal bot created by chaining observables in RxJS. It uses either realtime data, or historical data from a CSV file. The bot is able to generate signals based on the following indicators:
- Moving Average Crossover
- RSI
- MACD
- Stochastic RSI
- Bollinger Bands

It is configurable to add or remove indicators, and to change the parameters of each indicator. Also, it is possible to set the time interval for the data, and the time interval for the signals by aggregating the data. The bot is able to generate signals for long and short positions, and to calculate the profit/loss of the strategy.