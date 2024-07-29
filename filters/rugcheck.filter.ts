import { Filter, FilterResult } from './pool-filters';
import { LiquidityPoolKeysV4, Token, TokenAmount } from '@raydium-io/raydium-sdk';
import { Connection } from '@solana/web3.js';
import { logger, MAX_RISK_SCORE } from '../helpers';

export class RugCheckFilter implements Filter {
  async execute(poolKeys: LiquidityPoolKeysV4): Promise<FilterResult> {
    try {
      let rugRiskSafe = true;

      const rugRisk = await this.getRugCheck(poolKeys.baseMint.toString());
      if (rugRisk.risk.toLowerCase() === 'danger') {
        rugRiskSafe = false;
      }
      const riskScore = rugRisk.score;

      if (riskScore <= MAX_RISK_SCORE) {
        logger.trace(`RugCheck -> Pass. RugCheck -> ${rugRisk.risk}, Score -> ${riskScore}`);
        return { ok: true };
      } else {
        logger.trace(`RugCheck -> Fail. RugCheck -> ${rugRisk.risk}, Score -> ${riskScore}`);
        return { ok: false, message: `RugCheck -> ${rugRisk.risk}, Score -> ${riskScore}` };
      }
    
    } catch (error) {
      logger.error({ mint: poolKeys.baseMint }, `Failed to check rugcheck. ${error}`);
    }
    return { ok: false, message: 'RugCheck -> Failed to check rugcheck' };
  }

  private async getRugCheck(address: string) {
    const rugCheckURL = `https://api.rugcheck.xyz/v1/tokens/${address}/report/summary`;
    //logger.trace(`checking rugcheck ${rugCheckURL}`);

    try {
      const response = await fetch(rugCheckURL);
      const rugcheckResult = await response.json();
      const risk = rugcheckResult?.risks?.length > 0 ? rugcheckResult?.risks[0].level : "None";
      const score = Number(rugcheckResult?.score);

      return {risk: risk.toString(), score};
    } catch (error) {
      logger.error('Error fetching JSON:', error);
      return {risk: "None", score: 0};
    }
  }
}
