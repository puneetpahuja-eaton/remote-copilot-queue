// Thin wrapper around @nut-tree-fork/nut-js exposing screenshot, mouse, and keyboard control.
const path = require("node:path");
const { mkdirSync } = require("node:fs");
const { mouse, keyboard, screen, Key, Point, Button, FileType, Region } = require("@nut-tree-fork/nut-js");

const outputDir = path.join(__dirname, ".output", "screenshots");
// Full-screen PNG capture measured ~530ms on this machine; JPG was slower due to
// native color-space conversion overhead, so PNG is kept as the default. Prefer
// passing { region } for the fastest captures (~9x faster, ~60ms for a small area).
const screenshotFormat = process.env.SCREENSHOT_FORMAT === "jpg" ? FileType.JPG : FileType.PNG;

/**
 * Take a screenshot and save it to disk (defaults to a timestamped file under .output/screenshots).
 * Pass { region: { left, top, width, height } } to capture only part of the screen — much faster
 * than a full-screen grab when you only need to inspect one area.
 */
async function takeScreenshot(filePath, options = {}) {
  const target = filePath || path.join(outputDir, `screenshot-${Date.now()}`);
  mkdirSync(path.dirname(target), { recursive: true });
  const fileName = path.basename(target);
  const dir = path.dirname(target);
  if (options.region) {
    const { left, top, width, height } = options.region;
    return screen.captureRegion(fileName, new Region(left, top, width, height), screenshotFormat, dir);
  }
  return screen.capture(fileName, screenshotFormat, dir);
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
