import { PublicKey } from '@solana/web3.js';
import { logger } from '../helpers';
import BN from "bn.js";
import { Price, LiquidityPoolKeysV4 } from '@raydium-io/raydium-sdk';
import { RawAccount } from '@solana/spl-token';

export type SimulatedTradeToken = {
  mint: PublicKey;
  quoteAmount: number;
  quoteDecimal: number;
  baseAmount: number;
  baseDecimal: number;
  buy: Price; // in SOL
  sell: Price; // in SOL
};

export class SimulatedTradeCache {
  private readonly keys: Map<string, SimulatedTradeToken> = new Map<string, SimulatedTradeToken>();

  /**
   * Save simulated buy order.
   * @param mint 
   * @param buy 
   * @param amount 
   */
  public recordBuy(poolKeys: LiquidityPoolKeysV4, buy: Price, quoteAmount: number) {
    const mint = poolKeys.baseMint;
    logger.debug({mint, 
      lpDecimals: poolKeys.lpDecimals, 
      quoteDecimals: poolKeys.quoteDecimals, 
      baseDecimals: poolKeys.baseDecimals,
      buyPrice: buy.toFixed(16)
    });
    let amount = quoteAmount / parseFloat(buy.toFixed(16)); 
    amount = Number(amount.toFixed(poolKeys.baseDecimals));
    logger.debug(`log buy transaction ${mint} buy ${buy.toFixed(16)} amount ${amount} token / ${quoteAmount} SOL`);
    if (this.keys.has(mint.toBase58())) {
      const order = this.keys.get(mint.toBase58());
      order.quoteAmount = quoteAmount;
      order.quoteDecimal = poolKeys.quoteDecimals;
      order.baseAmount = amount; 
      order.baseDecimal = poolKeys.baseDecimals;
      order.buy = buy;
    }
    else {
      this.keys.set(mint.toBase58(), <SimulatedTradeToken> {
        mint: mint,
        quoteAmount: quoteAmount,
        quoteDecimal: poolKeys.quoteDecimals,
        baseAmount: amount,
        baseDecimal: poolKeys.baseDecimals,
        buy: buy
      });
    }
  }

  public recordSell(mint: PublicKey, sell: Price) {
    logger.debug(`log sell transaction ${mint} buy ${sell.toFixed(16)}`);
    if (this.keys.has(mint.toBase58())) {
      const order = this.keys.get(mint.toBase58());
      order.sell = sell;
    }
    else {
      logger.error(`Previous buy order not found for token ${mint} to log sell transaction`);
    }
  }

  public get(mint: PublicKey): SimulatedTradeToken {
    return this.keys.get(mint.toBase58());
  }

  public has(mint: PublicKey): boolean {
    return this.keys.has(mint.toBase58());
  }

  public getTokenAmount(mint: PublicKey): number {
    return this.keys.get(mint.toBase58()).baseAmount;
  }

  public getSimulateAccount(mint: PublicKey): RawAccount {
    const order = this.get(mint); 
    return <RawAccount> {
      mint: order.mint,
      amount: BigInt(Math.round(order.baseAmount * 10 ** order.baseDecimal)),
    }
  }

  public getProfit(mint: PublicKey) {
    const order = this.get(mint);

    let profitOrLoss = (parseFloat(order.sell.toFixed()) - parseFloat(order.buy.toFixed())) * order.baseAmount;
    let percentageChange = (profitOrLoss / parseFloat(order.buy.toFixed())) * 100
    return { tokenAmount: order.baseAmount, profitOrLoss, percentageChange };
  }

  public removeTrade(mint: PublicKey) {
    this.keys.delete(mint.toBase58()) ?
      logger.trace(`removed trade ${mint}`) :
      logger.error(`trade ${mint} not found when removing simulated trade`);
  }
}
