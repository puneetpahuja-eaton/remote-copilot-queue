// Thin wrapper around @nut-tree-fork/nut-js exposing screenshot, mouse, and keyboard control.
const path = require("node:path");
const { mkdirSync } = require("node:fs");
const { mouse, keyboard, screen, Key, Point, Button } = require("@nut-tree-fork/nut-js");

const outputDir = path.join(__dirname, ".output", "screenshots");

/** Take a screenshot and save it to the given path (defaults to a timestamped PNG under .output/screenshots). */
async function takeScreenshot(filePath) {
  const target = filePath || path.join(outputDir, `screenshot-${Date.now()}`);
  mkdirSync(path.dirname(target), { recursive: true });
  return screen.capture(path.basename(target), undefined, path.dirname(target));
}

/** Move the mouse to absolute screen coordinates. */
async function moveMouse(x, y) {
  await mouse.setPosition(new Point(x, y));
}

/** Click the mouse at the current position, or at (x, y) if provided. button: "left" | "right" | "middle". */
async function click(x, y, button = "left") {
  if (typeof x === "number" && typeof y === "number") await moveMouse(x, y);
  const nutButton = { left: Button.LEFT, right: Button.RIGHT, middle: Button.MIDDLE }[button] || Button.LEFT;
  await mouse.click(nutButton);
}

/** Type a string of text using the keyboard. */
async function typeText(text) {
  await keyboard.type(text);
}

/** Press a single named key (see nut.js Key enum, e.g. "Enter", "Tab", "Escape"). */
async function pressKey(keyName) {
  const key = Key[keyName];
  if (!key) throw new Error(`Unknown key: ${keyName}`);
  await keyboard.pressKey(key);
  await keyboard.releaseKey(key);
}

module.exports = { takeScreenshot, moveMouse, click, typeText, pressKey, Key };
