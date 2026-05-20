import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("shows both 8:30 and 9:25 strategy sections", () => {
    render(<App />);

    expect(screen.getByText("8:30 准备名单")).toBeInTheDocument();
    expect(screen.getByText("9:25 竞价确认")).toBeInTheDocument();
    expect(screen.getByText("首推")).toBeInTheDocument();
  });
});
