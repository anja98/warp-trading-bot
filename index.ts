import { MarketCache, PoolCache, SnipeListCache } from './cache';
import { Listeners } from './listeners';
import { Connection, KeyedAccountInfo, Keypair } from '@solana/web3.js';
import { LIQUIDITY_STATE_LAYOUT_V4, MARKET_STATE_LAYOUT_V3, Token, TokenAmount } from '@raydium-io/raydium-sdk';
import { AccountLayout, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { Bot, BotConfig } from './bot';
import { DefaultTransactionExecutor, TransactionExecutor } from './transactions';
import {
  getToken,
  getWallet,
  logger,
  COMMITMENT_LEVEL,
  RPC_ENDPOINT,
  RPC_WEBSOCKET_ENDPOINT,
  PRE_LOAD_EXISTING_MARKETS,
  LOG_LEVEL,
  QUOTE_MINT,
  MAX_POOL_SIZE,
  MIN_POOL_SIZE,
  MAX_RISK_SCORE,
  QUOTE_AMOUNT,
  PRIVATE_KEY,
  USE_SNIPE_LIST,
  AUTO_SELL_DELAY,
  MAX_SELL_RETRIES,
  AUTO_SELL,
  MAX_BUY_RETRIES,
  AUTO_BUY_DELAY,
  COMPUTE_UNIT_LIMIT,
  COMPUTE_UNIT_PRICE,
  CACHE_NEW_MARKETS,
  TAKE_PROFIT,
  STOP_LOSS,
  BUY_SLIPPAGE,
  SELL_SLIPPAGE,
  PRICE_CHECK_DURATION,
  PRICE_CHECK_INTERVAL,
  SNIPE_LIST_REFRESH_INTERVAL,
  TRANSACTION_EXECUTOR,
  CUSTOM_FEE,
  FILTER_CHECK_INTERVAL,
  FILTER_CHECK_DURATION,
  CONSECUTIVE_FILTER_MATCHES,
  MAX_TOKENS_AT_THE_TIME,
  CHECK_IF_MINT_IS_RENOUNCED,
  CHECK_IF_FREEZABLE,
  CHECK_IF_BURNED,
  CHECK_IF_MUTABLE,
  CHECK_IF_SOCIALS,
  TRAILING_STOP_LOSS,
  SKIP_SELLING_IF_LOST_MORE_THAN,
  MAX_LAG,
  CHECK_HOLDERS,
  CHECK_ABNORMAL_DISTRIBUTION,
  CHECK_TOKEN_DISTRIBUTION,
  CHECK_IF_RUGGED,
  TELEGRAM_CHAT_ID,
  BLACKLIST_REFRESH_INTERVAL,
  MACD_SHORT_PERIOD,
  MACD_LONG_PERIOD,
  MACD_SIGNAL_PERIOD,
  RSI_PERIOD,
  RSI_OVERSOLD_THRESHOLD,
  TELEGRAM_BOT_TOKEN,
  AUTO_SELL_WITHOUT_SELL_SIGNAL,
  BUY_SIGNAL_TIME_TO_WAIT,
  BUY_SIGNAL_PRICE_INTERVAL,
  BUY_SIGNAL_FRACTION_TIME_TO_WAIT,
  BUY_SIGNAL_LOW_VOLUME_THRESHOLD,
  USE_TELEGRAM,
  USE_TA,
  SIMULATE
} from './helpers';
import { WarpTransactionExecutor } from './transactions/warp-transaction-executor';
import { JitoTransactionExecutor } from './transactions/jito-rpc-transaction-executor';
import { TechnicalAnalysisCache } from './cache/technical-analysis.cache';
import { SimulatedTradeCache } from './cache/simulatedtrade.cache';

const pendingSell: string[] = [];

const connection = new Connection(RPC_ENDPOINT, {
  wsEndpoint: RPC_WEBSOCKET_ENDPOINT,
  commitment: COMMITMENT_LEVEL,
});

function printDetails(wallet: Keypair, quoteToken: Token, bot: Bot) {
  logger.info(`  
                                        ..   :-===++++-     
                                .-==+++++++- =+++++++++-    
            ..:::--===+=.=:     .+++++++++++:=+++++++++:    
    .==+++++++++++++++=:+++:    .+++++++++++.=++++++++-.    
    .-+++++++++++++++=:=++++-   .+++++++++=:.=+++++-::-.    
     -:+++++++++++++=:+++++++-  .++++++++-:- =+++++=-:      
      -:++++++=++++=:++++=++++= .++++++++++- =+++++:        
       -:++++-:=++=:++++=:-+++++:+++++====--:::::::.        
        ::=+-:::==:=+++=::-:--::::::::::---------::.        
         ::-:  .::::::::.  --------:::..                    
          :-    .:.-:::.                                    

          WARP DRIVE ACTIVATED 🚀🐟
          Made with ❤️ by humans.
  `);

  const botConfig = bot.config;

  logger.info('------- CONFIGURATION START -------');
  logger.info(`Wallet: ${wallet.publicKey.toString()}`);

  logger.info('- Bot -');
  logger.info(`Using transaction executor: ${TRANSACTION_EXECUTOR}`);

  if (bot.isWarp || bot.isJito) {
    logger.info(`${TRANSACTION_EXECUTOR} fee: ${CUSTOM_FEE}`);
  } else {
    logger.info(`Compute Unit limit: ${botConfig.unitLimit}`);
    logger.info(`Compute Unit price (micro lamports): ${botConfig.unitPrice}`);
  }

  logger.info(`Max tokens at the time: ${botConfig.maxTokensAtTheTime}`);
  logger.info(`Pre load existing markets: ${PRE_LOAD_EXISTING_MARKETS}`);
  logger.info(`Cache new markets: ${CACHE_NEW_MARKETS}`);
  logger.info(`Log level: ${LOG_LEVEL}`);
  logger.info(`Max lag: ${MAX_LAG}`);

  logger.info('- Buy -');
  logger.info(`Buy amount: ${botConfig.quoteAmount.toFixed()} ${botConfig.quoteToken.name}`);
  logger.info(`Auto buy delay: ${botConfig.autoBuyDelay} ms`);
  logger.info(`Max buy retries: ${botConfig.maxBuyRetries}`);
  logger.info(`Buy amount (${quoteToken.symbol}): ${botConfig.quoteAmount.toFixed()}`);
  logger.info(`Buy slippage: ${botConfig.buySlippage}%`);

  logger.info('- Sell -');
  logger.info(`Auto sell: ${AUTO_SELL}`);
  logger.info(`Auto sell delay: ${botConfig.autoSellDelay} ms`);
  logger.info(`Max sell retries: ${botConfig.maxSellRetries}`);
  logger.info(`Sell slippage: ${botConfig.sellSlippage}%`);
  logger.info(`Price check interval: ${botConfig.priceCheckInterval} ms`);
  logger.info(`Price check duration: ${botConfig.priceCheckDuration} ms`);
  logger.info(`Take profit: ${botConfig.takeProfit}%`);
  logger.info(`Stop loss: ${botConfig.stopLoss}%`);
  logger.info(`Trailing stop loss: ${botConfig.trailingStopLoss}`);
  logger.info(`Skip selling if lost more than: ${botConfig.skipSellingIfLostMoreThan}%`);

  logger.info('- Snipe list -');
  logger.info(`Snipe list: ${botConfig.useSnipeList}`);
  logger.info(`Snipe list refresh interval: ${SNIPE_LIST_REFRESH_INTERVAL} ms`);

  if (botConfig.useSnipeList) {
    logger.info('- Filters -');
    logger.info(`Filters are disabled when snipe list is on`);
  } else {
    logger.info('- Filters -');
    logger.info(`Filter check interval: ${botConfig.filterCheckInterval} ms`);
    logger.info(`Filter check duration: ${botConfig.filterCheckDuration} ms`);
    logger.info(`Consecutive filter matches: ${botConfig.consecutiveMatchCount}`);
    logger.info(`Check renounced: ${CHECK_IF_MINT_IS_RENOUNCED}`);
    logger.info(`Check freezable: ${CHECK_IF_FREEZABLE}`);
    logger.info(`Check burned: ${CHECK_IF_BURNED}`);
    logger.info(`Check mutable: ${CHECK_IF_MUTABLE}`);
    logger.info(`Check socials: ${CHECK_IF_SOCIALS}`);
    logger.info(`Check rugged: ${botConfig.checkRugged}`);
    logger.info(`Min pool size: ${botConfig.minPoolSize.toFixed()}`);
    logger.info(`Max pool size: ${botConfig.maxPoolSize.toFixed()}`);
    logger.info(`Max risk score: ${botConfig.maxRiskScore}`);
  }

  logger.info(`Check Holders: ${botConfig.checkHolders}`);    
  logger.info(`Check Token Distribution: ${botConfig.checkTokenDistribution}`);
  logger.info(`Check Abnormal Distribution: ${botConfig.checkAbnormalDistribution}`);
  logger.info(`Blacklist refresh interval: ${BLACKLIST_REFRESH_INTERVAL}`);

  logger.info(`Buy signal MACD: ${MACD_SHORT_PERIOD}/${MACD_LONG_PERIOD}/${MACD_SIGNAL_PERIOD}`);
  logger.info(`Buy signal RSI: ${RSI_PERIOD}`);
  logger.info(`Buy signal RSI Oversold Threshold: ${RSI_OVERSOLD_THRESHOLD}`);
  
  
  logger.info('------- CONFIGURATION END -------');

  logger.info('Bot is running! Press CTRL + C to stop it.');
}

// Function to calculate the time difference
function calculateTimeDifference(pastTime: Date): {hours, mins, secs} {
  const currentTime = new Date();
  const timeDifference = currentTime.getTime() - pastTime.getTime();

  const hours = Math.floor(timeDifference / (1000 * 60 * 60));
  const mins = Math.floor((timeDifference % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((timeDifference % (1000 * 60)) / 1000);

  return {
    hours, mins, secs
  }
}

const runListener = async () => {
  logger.level = LOG_LEVEL;
  logger.info('Bot is starting...');

  const marketCache = new MarketCache(connection);
  const poolCache = new PoolCache();
  const technicalAnalysisCache = new TechnicalAnalysisCache();
  const simulatedTradeCache = new SimulatedTradeCache();

  let txExecutor: TransactionExecutor;

  switch (TRANSACTION_EXECUTOR) {
    case 'warp': {
      txExecutor = new WarpTransactionExecutor(CUSTOM_FEE);
      break;
    }
    case 'jito': {
      txExecutor = new JitoTransactionExecutor(CUSTOM_FEE, connection);
      break;
    }
    default: {
      txExecutor = new DefaultTransactionExecutor(connection);
      break;
    }
  }

  const wallet = getWallet(PRIVATE_KEY.trim());
  const quoteToken = getToken(QUOTE_MINT);
  const botConfig = <BotConfig>{
    wallet,
    quoteAta: getAssociatedTokenAddressSync(quoteToken.mint, wallet.publicKey),
    minPoolSize: new TokenAmount(quoteToken, MIN_POOL_SIZE, false),
    maxPoolSize: new TokenAmount(quoteToken, MAX_POOL_SIZE, false),
    quoteToken,
    quoteAmount: new TokenAmount(quoteToken, QUOTE_AMOUNT, false),
    maxTokensAtTheTime: MAX_TOKENS_AT_THE_TIME,
    useSnipeList: USE_SNIPE_LIST,
    autoSell: AUTO_SELL,
    autoSellDelay: AUTO_SELL_DELAY,
    maxSellRetries: MAX_SELL_RETRIES,
    autoBuyDelay: AUTO_BUY_DELAY,
    maxBuyRetries: MAX_BUY_RETRIES,
    unitLimit: COMPUTE_UNIT_LIMIT,
    unitPrice: COMPUTE_UNIT_PRICE,
    takeProfit: TAKE_PROFIT,
    stopLoss: STOP_LOSS,
    trailingStopLoss: TRAILING_STOP_LOSS,
    skipSellingIfLostMoreThan: SKIP_SELLING_IF_LOST_MORE_THAN,
    buySlippage: BUY_SLIPPAGE,
    sellSlippage: SELL_SLIPPAGE,
    priceCheckInterval: PRICE_CHECK_INTERVAL,
    priceCheckDuration: PRICE_CHECK_DURATION,
    filterCheckInterval: FILTER_CHECK_INTERVAL,
    filterCheckDuration: FILTER_CHECK_DURATION,
    consecutiveMatchCount: CONSECUTIVE_FILTER_MATCHES,
    checkHolders:CHECK_HOLDERS,
    checkTokenDistribution:CHECK_TOKEN_DISTRIBUTION,
    checkAbnormalDistribution:CHECK_ABNORMAL_DISTRIBUTION,
    checkRugged: CHECK_IF_RUGGED,
    maxRiskScore: MAX_RISK_SCORE,
    telegramChatId:TELEGRAM_CHAT_ID,
    telegramBotToken: TELEGRAM_BOT_TOKEN,
    blacklistRefreshInterval: BLACKLIST_REFRESH_INTERVAL,
    MACDLongPeriod: MACD_LONG_PERIOD,
    MACDShortPeriod: MACD_SHORT_PERIOD,
    MACDSignalPeriod: MACD_SIGNAL_PERIOD,
    RSIPeriod: RSI_PERIOD,
    RSIOverSoldThreshold: RSI_OVERSOLD_THRESHOLD,
    autoSellWithoutSellSignal: AUTO_SELL_WITHOUT_SELL_SIGNAL,
    buySignalTimeToWait: BUY_SIGNAL_TIME_TO_WAIT,
    buySignalPriceInterval: BUY_SIGNAL_PRICE_INTERVAL,
    buySignalFractionPercentageTimeToWait: BUY_SIGNAL_FRACTION_TIME_TO_WAIT,
    buySignalLowVolumeThreshold: BUY_SIGNAL_LOW_VOLUME_THRESHOLD,
    useTelegram: USE_TELEGRAM,
    useTechnicalAnalysis: USE_TA,
    simulate: SIMULATE
  };

  const bot = new Bot(connection, marketCache, poolCache, txExecutor, technicalAnalysisCache, simulatedTradeCache, botConfig);
  const valid = await bot.validate();

  if (!valid) {
    logger.info('Bot is exiting...');
    process.exit(1);
  }

  if (PRE_LOAD_EXISTING_MARKETS) {
    await marketCache.init({ quoteToken });
  }

  const runTimestamp = Math.floor(new Date().getTime() / 1000);
  const listeners = new Listeners(connection);
  await listeners.start({
    walletPublicKey: wallet.publicKey,
    quoteToken,
    autoSell: AUTO_SELL,
    cacheNewMarkets: CACHE_NEW_MARKETS,
  });

  listeners.on('market', async (updatedAccountInfo: KeyedAccountInfo) => {
    const marketState = MARKET_STATE_LAYOUT_V3.decode(updatedAccountInfo.accountInfo.data);

    const isInCache = await bot.isInSnipListCache(marketState.baseMint);
    if ((botConfig.useSnipeList && isInCache) || (!botConfig.useSnipeList)) {
      logger.info(`saving market cache token ${marketState.baseMint}`);
      marketCache.save(updatedAccountInfo.accountId.toString(), marketState);
    }
  });

  listeners.on('pool', async (updatedAccountInfo: KeyedAccountInfo) => {
    const poolState = LIQUIDITY_STATE_LAYOUT_V4.decode(updatedAccountInfo.accountInfo.data);
    const poolOpenTime = parseInt(poolState.poolOpenTime.toString());
    const exists = await poolCache.get(poolState.baseMint.toString());

    let currentTimestamp = Math.floor(new Date().getTime() / 1000);
    let lag = currentTimestamp - poolOpenTime;

    // TODO: add another condition if exist, check poolOpenTime within X mins. Token may be burnt after pool open. This should be more
    // efficient than blocking the buy process to sacrificing buy opportunities for other tokens.

    if ((!exists && 
            ((poolOpenTime > runTimestamp) || botConfig.useSnipeList))) {

      const {hours, mins, secs } = calculateTimeDifference(new Date(poolOpenTime * 1000));
      let ago = "";
      if (hours > 0) { ago = ago + hours + " hours "};
      if (mins > 0) {ago = ago + mins + " mins "};
      ago = ago + secs + " secs";
      logger.debug(`${poolState.baseMint} Pool Open ${poolOpenTime} (${ago} ago)`);
      poolCache.save(updatedAccountInfo.accountId.toString(), poolState);

      // no using snipe list. so normal flow is to trade new tokens.
      if (!botConfig.useSnipeList) {
        if(MAX_LAG != 0 && lag > MAX_LAG){
          logger.error(`Lag too high: ${lag} sec`);
          return;
        } else {
          logger.debug(`Lag: ${lag} sec`);
        }
      }
      await bot.buy(updatedAccountInfo.accountId, poolState, lag);

      if (botConfig.simulate && 
            simulatedTradeCache.has(poolState.baseMint)) {

        await bot.sell(updatedAccountInfo.accountId, simulatedTradeCache.getSimulateAccount(poolState.baseMint));

        simulatedTradeCache.removeTrade(poolState.baseMint);
      }
    }
  });

  listeners.on('wallet', async (updatedAccountInfo: KeyedAccountInfo) => {
    const accountData = AccountLayout.decode(updatedAccountInfo.accountInfo.data);

    if (accountData.mint.equals(quoteToken.mint)) {
      return;
    }

    await bot.sell(updatedAccountInfo.accountId, accountData);

  });

  printDetails(wallet, quoteToken, bot);
};

runListener();

