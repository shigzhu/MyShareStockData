import type { StrategyResult, TradingDayInput } from "./types";

export type DataProviderStatus = "SUCCESS" | "FAILED" | "MISSING_REQUIRED_DATA";

export type DataProviderResult<T> =
  | {
      status: "SUCCESS";
      input: T;
      message?: string;
    }
  | {
      status: "FAILED" | "MISSING_REQUIRED_DATA";
      message: string;
    };

export interface DataProvider {
  fetchTradingStatus?(tradeDate: string): Promise<DataProviderResult<{ isTradingDay: boolean; message?: string }>>;
  fetchPreMarketInput(tradeDate: string): Promise<DataProviderResult<TradingDayInput>>;
  fetchAuctionInput(tradeDate: string, preMarketResult: StrategyResult): Promise<DataProviderResult<TradingDayInput>>;
}
