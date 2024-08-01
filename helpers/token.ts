import { Token } from '@raydium-io/raydium-sdk';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PublicKey, Connection } from '@solana/web3.js';
import { Liquidity, LiquidityPoolKeysV4, TokenAmount, Price, Currency } from '@raydium-io/raydium-sdk';
import { BN } from 'bn.js';

export function getToken(token: string) {
  switch (token) {
    case 'WSOL': {
      return Token.WSOL;
    }
    case 'USDC': {
      return new Token(
        TOKEN_PROGRAM_ID,
        new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
        6,
        'USDC',
        'USDC',
      );
    }
    default: {
      throw new Error(`Unsupported quote mint "${token}". Supported values are USDC and WSOL`);
    }
  }
}

export async function calculateTokenPrice(connection: Connection, poolKeys: LiquidityPoolKeysV4): Promise<Price> {
  try {

    const baseAmount =  new BN((await connection.getTokenAccountBalance(poolKeys.baseVault)).value.amount);
    const quoteAmount = new BN((await connection.getTokenAccountBalance(poolKeys.quoteVault)).value.amount);

    /*
    logger.trace(`base vault ${poolKeys.baseVault}`);
    logger.trace(`quote vault ${poolKeys.quoteVault}`);
    logger.trace(`base decimals ${poolKeys.baseDecimals}`);
    logger.trace(`quote decimals ${poolKeys.quoteDecimals}`);
    logger.trace(`base amount ${baseAmount}`);
    logger.trace(`quote amount ${quoteAmount}`);
    */
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
