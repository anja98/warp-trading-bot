import { Liquidity, LiquidityPoolKeysV4, TokenAmount, Price, Currency } from '@raydium-io/raydium-sdk';
import { COMMITMENT_LEVEL, RPC_ENDPOINT, logger, calculateTokenPrice } from '../helpers';
import { Connection, PublicKey } from '@solana/web3.js';
import { BN } from 'bn.js';

const TIMEFRAME = 1 // in minutes

export class TechnicalAnalysisCache_Entity {
  constructor(process, poolKeys, prices) {
    this.process = process;
    this.poolKeys = poolKeys;
    this.prices = prices;

    this.done = false;
    this.extendExpiryTime();
  }

  extendExpiryTime(){
    this.expiryTime = new Date(new Date().getTime() + 5 * 60 * 1000); //5 mins
  }

  process: NodeJS.Timeout;
  expiryTime: Date;
  poolKeys: LiquidityPoolKeysV4;
  done: boolean;
  prices: {
    value: number,
    date: Date
  }[];
}

export class TechnicalAnalysisCache {
  private readonly data: Map<string, TechnicalAnalysisCache_Entity> = new Map<string, TechnicalAnalysisCache_Entity>();

  constructor() {
    setInterval(() => { 
      this.data.forEach((cached, key) => {
        if(cached.done || cached.expiryTime < new Date()) {
          logger.trace(`Technical analysis watcher for mint: ${key} expired`);
          clearInterval(cached.process);
          this.data.delete(key);
        }
      });
    }, 30 * 1000);
  }


  public addNew(mint: string, poolKeys: LiquidityPoolKeysV4) {
    let connection = new Connection(RPC_ENDPOINT, {
      commitment: COMMITMENT_LEVEL
    });

    if (this.data.has(mint)) {
      return; //already exists
    }

    logger.trace(`Adding new technical analysis watcher for mint: ${mint}`);

    let process = this.startWatcher(connection, mint);
    this.set(mint, new TechnicalAnalysisCache_Entity(process, poolKeys, []));
  }

  public getPrices(mint: string): number[] {
    if (!this.data.has(mint)) {
      return null;
    }

    let cached = this.data.get(mint);
    cached.extendExpiryTime();
    this.set(mint, cached);
    //logger.debug({cacheprices: cached.prices}, 'dumping price cache so far');
    return cached.prices.sort((a, b) => a.date.getTime() - b.date.getTime()).map(p => p.value);
  }

  public async markAsDone(mint: string) {
    const cached = this.data.get(mint);
    if (cached) {

      logger.trace(`Marking technical analysis watcher for mint: ${mint} as done`);
      cached.done = true;
      this.set(mint, cached);
    }
  }

  private set(mint: string, entity: TechnicalAnalysisCache_Entity) {
    // nu afdrug
    this.data.set(mint, entity);
  }
  /*
  private async getTokenAmount(token: PublicKey) {
    let connection = new Connection(RPC_ENDPOINT, {
      commitment: COMMITMENT_LEVEL
    });

    const tokenAmount = await connection.getTokenAccountBalance(token);
    return new BN(tokenAmount.value.amount);
  }

  private async calculateTokenPrice(poolKeys: LiquidityPoolKeysV4) {
    try {
      const baseAmount = await this.getTokenAmount(poolKeys.baseVault);
      const quoteAmount = await this.getTokenAmount(poolKeys.quoteVault);
      
      logger.trace(`base vault ${poolKeys.baseVault}`);
      logger.trace(`quote vault ${poolKeys.quoteVault}`);
      logger.trace(`base decimals ${poolKeys.baseDecimals}`);
      logger.trace(`quote decimals ${poolKeys.quoteDecimals}`);
      logger.trace(`base amount ${baseAmount}`);
      logger.trace(`quote amount ${quoteAmount}`);
      
      const baseReserve = baseAmount.div(new BN(10).pow(new BN(poolKeys.baseDecimals)));
      const quoteReserve = quoteAmount.div(new BN(10).pow(new BN(poolKeys.quoteDecimals)));
      const price = new Price(new Currency(poolKeys.baseDecimals), baseAmount, 
                              new Currency(poolKeys.quoteDecimals), quoteAmount)

      return price

    } catch (error) {
        console.error(`Failed to calculate token ${poolKeys.baseMint.toBase58()} price: ${error}`);
      throw error;
    }
  }  
  */
  private startWatcher(connection: Connection, mint: string): NodeJS.Timeout {
    return setInterval(async () => {
      try {

        if (!this.data.has(mint)) {
          return; //doesnt exist
        }

        let currentTime = new Date();
        let cached = this.data.get(mint);

        if (cached.done) {
          clearInterval(cached.process);
          this.data.delete(mint);
          return;
        }
        /*
        let poolInfo = await Liquidity.fetchInfo({
          connection: connection,
          poolKeys: cached.poolKeys
        });
       
        let tokenPriceBN = Liquidity.getRate(poolInfo);
        */

        let tokenPriceBN = await calculateTokenPrice(connection, cached.poolKeys);
        /* disable same price skipping. we should track all price movement in the timeframe 
        if (cached.prices.length === 0 || parseFloat(tokenPriceBN.toFixed(16)) !== cached.prices[cached.prices.length - 1].value) {
          logger.info(`cache token price ${currentTime} ${tokenPriceBN.toFixed(16)} `)
          cached.prices.push({ value: parseFloat(tokenPriceBN.toFixed(16)), date: currentTime });
        }
        */

        // track all price movement
        cached.prices.push({ value: parseFloat(tokenPriceBN.toFixed(16)), date: currentTime });

        this.set(mint, cached);
      } catch (e) {
        logger.error({ error: e }, `Technical analysis watcher for mint: ${mint} failed`);
      }
    }, TIMEFRAME * 60000);
  }

}
