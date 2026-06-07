import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../App";
import { rooms } from "../data/rooms";

describe("accessibility and responsive-readiness checks", () => {
  it("renders named lobby controls and status text", () => {
    render(<App />);

    expect(
      screen.getByRole("button", { name: /enter room 1/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /creator mode/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/current score 0/i)).toBeInTheDocument();
    expect(screen.getAllByText(/local_mock/i).length).toBeGreaterThan(0);
  });

  it("does not rely on color-only puzzle or scene information", () => {
    for (const room of rooms) {
      expect(room.title).toBeTruthy();
      expect(room.subtitle).toBeTruthy();
      expect(room.puzzle.instructions).toBeTruthy();
      expect(room.sceneObjects.every((item) => item.label && item.description)).toBe(
        true
      );

      if (room.puzzle.type === "classification_lock") {
        expect(room.puzzle.categories.every((category) => category.label)).toBe(true);
      }
    }
  });

  it("keeps citation and trace controls keyboard-addressable by button text", () => {
    render(<App />);

    expect(
      screen.getByRole("button", { name: /citations/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /policy pack/i })
    ).toBeInTheDocument();
  });
});
