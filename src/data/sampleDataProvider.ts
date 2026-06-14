import { sampleTradingDay } from "./sampleTradingDay";
import type { DataProvider } from "../domain/dataProvider";

export const sampleDataProvider: DataProvider = {
  async fetchPreMarketInput(tradeDate) {
    return {
      status: "SUCCESS",
      input: {
        ...sampleTradingDay,
        tradeDate
      },
      message: "样本数据已加载"
    };
  },
  async fetchAuctionInput(tradeDate) {
    return {
      status: "SUCCESS",
      input: {
        ...sampleTradingDay,
        tradeDate
      },
      message: "样本集合竞价数据已加载"
    };
  }
};
