import assert from "node:assert/strict";
import test from "node:test";
import {
  calculatePanelResize,
  PANEL_RESIZE_CORNERS,
} from "../src/ui/panel-resize.js";

test("resizes from each corner while keeping the opposite corner fixed", () => {
  const rect = { left: 100, top: 100, width: 500, height: 400 };
  const expected = {
    nw: { left: 130, top: 120, width: 470, height: 380 },
    ne: { left: 100, top: 120, width: 530, height: 380 },
    sw: { left: 130, top: 100, width: 470, height: 420 },
    se: { left: 100, top: 100, width: 530, height: 420 },
  };

  assert.deepEqual(PANEL_RESIZE_CORNERS, ["nw", "ne", "sw", "se"]);
  PANEL_RESIZE_CORNERS.forEach((corner) => {
    assert.deepEqual(
      calculatePanelResize(rect, corner, 30, 20, 1200, 900),
      expected[corner],
    );
  });
});

test("keeps panel size within its existing minimum and maximum bounds", () => {
  const rect = { left: 100, top: 100, width: 500, height: 400 };

  assert.deepEqual(
    calculatePanelResize(rect, "nw", 500, 500, 1200, 900),
    { left: 230, top: 200, width: 370, height: 300 },
  );
  assert.deepEqual(
    calculatePanelResize(rect, "se", 1000, 1000, 800, 700),
    { left: 100, top: 100, width: 800, height: 644 },
  );
});
