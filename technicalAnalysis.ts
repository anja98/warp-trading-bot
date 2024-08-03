import { BotConfig } from "./bot";
import { logger } from "./helpers";

export class TechnicalAnalysis {
    constructor(public botConfig: BotConfig) { }

    public calculateEMAs = (prices: number[]): { EMA_3: number, EMA_18: number, prevEMA_3: number } => {
        const shortPeriod = 3;
        const longPeriod = 18;

        if (prices.length < longPeriod - 1) {
            return { EMA_3: null, EMA_18: null, prevEMA_3: null };
        }

        const shortMultiplier = 2 / (shortPeriod + 1);
        const longMultiplier = 2 / (longPeriod + 1);

        let shortEMA = prices.slice(0, shortPeriod).reduce((acc, val) => acc + val, 0) / shortPeriod;
        let longEMA = prices.slice(0, longPeriod).reduce((acc, val) => acc + val, 0) / longPeriod;

        let prevEMA = shortEMA;

        prices.forEach(price => {
            prevEMA = shortEMA;
            shortEMA = (price - shortEMA) * shortMultiplier + shortEMA;
            longEMA = (price - longEMA) * longMultiplier + longEMA;
        });

        return {
            EMA_3: shortEMA,
            EMA_18: longEMA,
            prevEMA_3: prevEMA
        };
    }

    public calculateMACDv2 = (
        prices: number[], 
        _shortPeriod : number = null, 
        _longPeriod: number = null, 
        _signalPeriod: number = null
    ): { macd: number, signal: number } => {
        const shortPeriod = _shortPeriod ?? this.botConfig.MACDShortPeriod;
        const longPeriod = _longPeriod ?? this.botConfig.MACDLongPeriod;
        const signalPeriod = _signalPeriod ?? this.botConfig.MACDSignalPeriod;

        if (prices.length < longPeriod + signalPeriod - 1) {
            return { macd: null, signal: null };
        }

        const shortMultiplier = 2 / (shortPeriod + 1);
        const longMultiplier = 2 / (longPeriod + 1);

        let shortEMA = prices.slice(0, shortPeriod).reduce((acc, val) => acc + val, 0) / shortPeriod;
        let longEMA = prices.slice(0, longPeriod).reduce((acc, val) => acc + val, 0) / longPeriod;

        const macdLine: number[] = [];
        for (let i = longPeriod; i < prices.length; i++) {
            shortEMA = (prices[i] - shortEMA) * shortMultiplier + shortEMA;
            longEMA = (prices[i] - longEMA) * longMultiplier + longEMA;

            const macdValue = shortEMA - longEMA;
            macdLine.push(macdValue);
        }

        let sum = 0;
        for (let i = 0; i < signalPeriod; i++) {
            sum += macdLine[i];
        }
        let signalEMA = sum / signalPeriod;
        const signal: number[] = [signalEMA]; 

        const signalMultiplier = 2 / (signalPeriod + 1);
        for (let i = signalPeriod; i < macdLine.length; i++) {
            signalEMA = (macdLine[i] - signalEMA) * signalMultiplier + signalEMA;
            signal.push(signalEMA);
        }

        return {
            macd: macdLine[macdLine.length - 1],
            signal: signal[signal.length - 1]
        };
    }


    public calculateRSIv2 = (prices: number[]): number => {
        const period = this.botConfig.RSIPeriod;
        const delta: number[] = [];
        let gainSum = 0;
        let lossSum = 0;

        for (let i = 1; i < prices.length; i++) {
            delta.push(prices[i] - prices[i - 1]);
        }

        //logger.debug({prices}, 'RSI delta');

        for (let i = 0; i < period; i++) {
            if (delta[i] > 0) {
                gainSum += delta[i];
            } else {
                lossSum += Math.abs(delta[i]);
            }
        }

        const initialAvgGain = gainSum / period;
        const initialAvgLoss = lossSum / period;

        let prevAvgGain = initialAvgGain;
        let prevAvgLoss = initialAvgLoss;

        let cRSI = 0;

        for (let i = period; i < prices.length; i++) {
            const gain = delta[i] > 0 ? delta[i] : 0;
            const loss = delta[i] < 0 ? Math.abs(delta[i]) : 0;

            const avgGain = ((prevAvgGain * (period - 1)) + gain) / period;
            const avgLoss = ((prevAvgLoss * (period - 1)) + loss) / period;

            const RS = avgGain / avgLoss;
            cRSI = 100 - (100 / (1 + RS));

            prevAvgGain = avgGain;
            prevAvgLoss = avgLoss;
        }

        return cRSI;
    }

    public calculateRSIv3 = (prices: number[], _period: number = null): { RSI: number, RSI_EMA_11: number, RSI_prevEMA_11: number } => {
        const period = _period ?? this.botConfig.RSIPeriod;
        const emaPeriod = 11;
        const delta: number[] = [];
        const rsiValues: number[] = [];
        let gainSum = 0;
        let lossSum = 0;
    
        for (let i = 1; i < prices.length; i++) {
            delta.push(prices[i] - prices[i - 1]);
        }
    
        for (let i = 0; i < period; i++) {
            if (delta[i] > 0) {
                gainSum += delta[i];
            } else {
                lossSum += Math.abs(delta[i]);
            }
        }
    
        const initialAvgGain = gainSum / period;
        const initialAvgLoss = lossSum / period;
    
        let prevAvgGain = initialAvgGain;
        let prevAvgLoss = initialAvgLoss;
    
        let cRSI = 0;
    
        for (let i = period; i < prices.length; i++) {
            const gain = delta[i] > 0 ? delta[i] : 0;
            const loss = delta[i] < 0 ? Math.abs(delta[i]) : 0;
    
            const avgGain = ((prevAvgGain * (period - 1)) + gain) / period;
            const avgLoss = ((prevAvgLoss * (period - 1)) + loss) / period;
    
            const RS = avgGain / avgLoss;
            cRSI = 100 - (100 / (1 + RS));
    
            prevAvgGain = avgGain;
            prevAvgLoss = avgLoss;
    
            rsiValues.push(cRSI);
        }
    
        if (rsiValues.length < emaPeriod) {
            return { RSI: cRSI, RSI_EMA_11: NaN, RSI_prevEMA_11: NaN };
        }
    
        const emaMultiplier = 2 / (emaPeriod + 1);
        let ema_11 = rsiValues.slice(0, emaPeriod).reduce((acc, val) => acc + val, 0) / emaPeriod;
        let prevEMA_11 = ema_11;
    
        for (let i = emaPeriod; i < rsiValues.length; i++) {
            prevEMA_11 = ema_11;
            ema_11 = (rsiValues[i] - ema_11) * emaMultiplier + ema_11;
        }
    
        return { RSI: cRSI, RSI_EMA_11: ema_11, RSI_prevEMA_11: prevEMA_11 };
    }


}