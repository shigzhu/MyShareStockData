import { createRemoteJsonDataProvider } from "./remoteJsonDataProvider";

export const githubDataFeedBaseUrl = "https://shigzhu.github.io/MyShareStockData";

export const defaultDataProvider = createRemoteJsonDataProvider({
  baseUrl: githubDataFeedBaseUrl
});
