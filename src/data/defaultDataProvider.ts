import { createRemoteJsonDataProvider } from "./remoteJsonDataProvider";
import { sampleDataProvider } from "./sampleDataProvider";

export const githubDataFeedBaseUrl = "https://shigzhu.github.io/MyShareStockData";

export const defaultDataProvider = createRemoteJsonDataProvider({
  baseUrl: githubDataFeedBaseUrl,
  fallbackProvider: sampleDataProvider
});
