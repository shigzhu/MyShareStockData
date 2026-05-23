import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("shows both 8:30 and 9:25 strategy sections", () => {
    render(<App />);

    expect(screen.getByText("8:30 准备名单")).toBeInTheDocument();
    expect(screen.getByText("9:25 竞价确认")).toBeInTheDocument();
    expect(screen.getAllByText("首推").length).toBeGreaterThanOrEqual(2);
  });

  it("puts daily primary recommendations first and groups history by month week and day", () => {
    render(<App />);

    expect(screen.getAllByText("今日首推").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("2026年05月").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("第4周").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("2026-05-21").length).toBeGreaterThanOrEqual(1);
  });

  it("records a delete reason and hides the recommendation", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole("button", { name: /删除/ })[0]);
    await user.click(screen.getByRole("button", { name: "风险大" }));

    expect(screen.getByText(/已删除/)).toBeInTheDocument();
  });
});
