import { LiquidityStateV4 } from '@raydium-io/raydium-sdk';
import { logger } from '../helpers';

export class PoolCache {
  private readonly keys: Map<string, { id: string; state: LiquidityStateV4, sold: boolean }> = new Map<
    string,
    { id: string; state: LiquidityStateV4, sold: boolean }
  >();

  public save(id: string, state: LiquidityStateV4) {
    if (!this.keys.has(state.baseMint.toString())) {
      logger.trace(`Caching new pool for mint: ${state.baseMint.toString()}`);
      this.keys.set(state.baseMint.toString(), { id, state, sold: false });
    }
  }

  public async get(mint: string): Promise<{ id: string; state: LiquidityStateV4, sold: boolean }> {
      return this.keys.get(mint)!;
  }

  public async markAsSold(mint: string) {
    //important, so we don't try to sell the same pool twice
    const pool = this.keys.get(mint);
    if (pool) {
      pool.sold = true;
      this.keys.set(mint, pool);
    }
  }

  public async delete(mint: string) {
    this.keys.delete(mint);
  }
}
