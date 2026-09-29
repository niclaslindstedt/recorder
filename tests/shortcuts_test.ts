// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { savesModal } from "../src/app/shortcuts.ts";

const none = { alt: false, ctrl: false, meta: false, shift: false };

describe("savesModal", () => {
  it("is a bare Enter off a control", () => {
    expect(savesModal("Enter", none, "field")).toBe(true);
    expect(savesModal("Enter", none, "card")).toBe(true);
    expect(savesModal("Enter", none, "control")).toBe(false);
    expect(savesModal("Enter", { ...none, shift: true }, "field")).toBe(false);
    expect(savesModal("a", none, "field")).toBe(false);
  });
});
