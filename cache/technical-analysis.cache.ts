import { Liquidity, LiquidityPoolKeysV4 } from '@raydium-io/raydium-sdk';
import { COMMITMENT_LEVEL, RPC_ENDPOINT, logger } from '../helpers';
import { Connection } from '@solana/web3.js';

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

        let poolInfo = await Liquidity.fetchInfo({
          connection: connection,
          poolKeys: cached.poolKeys
        });

        let tokenPriceBN = Liquidity.getRate(poolInfo);

        if (cached.prices.length === 0 || parseFloat(tokenPriceBN.toFixed(16)) !== cached.prices[cached.prices.length - 1].value) {
          logger.info(`cache token price ${currentTime} ${tokenPriceBN.toFixed(16)} `)
          cached.prices.push({ value: parseFloat(tokenPriceBN.toFixed(16)), date: currentTime });
        }

        this.set(mint, cached);
      } catch (e) {
        logger.error({ error: e }, `Technical analysis watcher for mint: ${mint} failed`);
      }
    }, 500);
  }

}
