#!/usr/bin/env -S gjs -m
// SPDX-License-Identifier: GPL-3.0-or-later
// hypr-shuzhi: Generate wallpapers with Chinese poetry for Hyprland

import GLib from 'gi://GLib?version=2.0';
import Gio from 'gi://Gio?version=2.0';
import Cairo from 'gi://cairo';
import Pango from 'gi://Pango?version=1.0';

import * as T from './util.js';
import * as Draw from './draw.js';
import * as Motto from './motto.js';
import { Palette } from './color.js';


const Sketch = { WAVE: 0, BLOB: 1, OVAL: 2, TREE: 3, CLOUD: 4 };
const SKETCH_MAP = {
  wave: Sketch.WAVE, blob: Sketch.BLOB, oval: Sketch.OVAL,
  tree: Sketch.TREE, cloud: Sketch.CLOUD,
};
const DARK_SKETCHES = [Sketch.WAVE, Sketch.BLOB, Sketch.OVAL, Sketch.CLOUD];
const LIGHT_SKETCHES = [Sketch.WAVE, Sketch.BLOB, Sketch.OVAL, Sketch.TREE];

function getMonitorSize() {
  try {
    let json = T.execute('hyprctl monitors -j');
    let monitors = JSON.parse(json);
    let m = monitors.reduce((p, x) => p.width * p.height > x.width * x.height ? p : x, { width: 1920, height: 1080 });
    return { W: m.width, H: m.height };
  } catch (e) {
    logError(e, 'Failed to detect monitor size');
    return { W: 1920, H: 1080 };
  }
}

function pickSketch(dark, sketchName) {
  if (sketchName && sketchName !== 'random') {
    let idx = SKETCH_MAP[sketchName];
    if (idx !== undefined) return idx;
  }
  return T.lot(dark ? DARK_SKETCHES : LIGHT_SKETCHES);
}

function getSketchModule(idx, dark) {
  switch (idx) {
    case Sketch.WAVE: return Draw.Wave;
    case Sketch.BLOB: return Draw.Blob;
    case Sketch.OVAL: return Draw.Oval;
    case Sketch.TREE: return dark ? Draw.Cloud : Draw.Tree;
    case Sketch.CLOUD: return dark ? Draw.Cloud : Draw.Tree;
    default: return Draw.Wave;
  }
}

function setWallpaper(pngPath) {
  let bgLink = GLib.build_filenamev([GLib.get_home_dir(), '.config', 'omarchy', 'current', 'background']);

  // Remove existing symlink/file and create new symlink
  let linkFile = Gio.File.new_for_path(bgLink);
  try { linkFile.delete(null); } catch (e) { /* ok */ }
  linkFile.make_symbolic_link(pngPath, null);

  // Restart swaybg via hyprctl so it runs under the compositor
  try {
    T.execute('pkill -x swaybg || true');
  } catch (e) { /* ok if swaybg isn't running */ }

  try {
    T.execute(`hyprctl dispatch exec -- swaybg -i ${GLib.shell_quote(bgLink)} -m fill`);
  } catch (e) {
    logError(e, 'Failed to restart swaybg');
    // Fallback: try spawning directly
    try {
      GLib.spawn_command_line_async(`swaybg -i ${GLib.shell_quote(bgLink)} -m fill`);
    } catch (e2) {
      logError(e2, 'Failed to start swaybg');
    }
  }
}

function resolveTheme(config) {
  let theme = config.theme ?? (config.dark != null ? (config.dark ? 'dark' : 'light') : 'dark');
  if (theme === 'random') return Math.random() < 0.5;
  return theme === 'dark';
}

function generate(config) {
  let dark = resolveTheme(config);
  let level = config.level ?? true; // true = horizontal, false = vertical
  let fontName = config.font || 'Serif';
  let fontSize = config.fontSize ?? 36;
  let sketchName = config.sketch || 'random';
  let showColor = config.showColor ?? false;
  let colorFont = config.colorFont || 'Serif 16';

  let { W, H } = getMonitorSize();
  let palette = new Palette();
  let font = Pango.FontDescription.from_string(fontName);
  if (fontSize) font.set_size(fontSize * Pango.SCALE);

  // Fetch motto
  let motto = Motto.fetch(dark);

  // Create PNG surface
  let surface = new Cairo.ImageSurface(Cairo.Format.ARGB32, W, H);
  let cr = new Cairo.Context(surface);

  // Host object (mimics the extension's host interface)
  let host = { W, H, dark, level, font, palette };

  // 1. Paint background
  Draw.paint(Draw.BG, cr, Draw.BG.gen(host));

  // 2. Layout motto (sets Motto.area for sketch avoidance)
  let mottoData = Motto.get(motto, level, dark);
  let mottoLayout = Draw.Motto.gen(cr, mottoData, host);

  // 3. Generate and draw sketch
  let sketchIdx = pickSketch(dark, sketchName);
  let skt = getSketchModule(sketchIdx, dark);
  let colors = skt.dye(host);
  let pts = skt.gen(colors, host);
  Draw.paint(skt, cr, pts, { showColor, colorFont, dark });

  // 4. Draw motto on top
  Draw.paint(Draw.Motto, cr, mottoLayout, host);

  // 5. Write PNG
  let cacheDir = GLib.build_filenamev([GLib.get_home_dir(), '.cache', 'hypr-shuzhi']);
  T.ensureDir(cacheDir);
  let pngPath = GLib.build_filenamev([cacheDir, `wallpaper-${dark ? 'dark' : 'light'}.png`]);
  surface.writeToPNG(pngPath);
  cr.$dispose();

  print(`Generated: ${pngPath} (${W}x${H})`);
  return pngPath;
}

function parseArgs() {
  let config = {
    theme: 'random',
    level: true,
    sketch: 'random',
    font: 'Serif',
    fontSize: 36,
    showColor: false,
    setWallpaper: true,
  };

  // Try to load config file
  let configPath = GLib.build_filenamev([
    GLib.path_get_dirname(GLib.path_get_dirname(import.meta.url.slice(7))),
    'config.json',
  ]);
  try {
    let loaded = T.readJSON(configPath);
    Object.assign(config, loaded);
  } catch (e) { /* no config file, use defaults */ }

  // Parse CLI args
  for (let i = 0; i < ARGV.length; i++) {
    switch (ARGV[i]) {
      case '--light': config.theme = 'light'; break;
      case '--dark': config.theme = 'dark'; break;
      case '--random': config.theme = 'random'; break;
      case '--vertical': config.level = false; break;
      case '--horizontal': config.level = true; break;
      case '--no-set': config.setWallpaper = false; break;
      case '--sketch':
        config.sketch = ARGV[++i] || 'random';
        break;
      case '--font':
        config.font = ARGV[++i] || config.font;
        break;
      case '--font-size':
        config.fontSize = parseInt(ARGV[++i]) || config.fontSize;
        break;
      case '--show-color': config.showColor = true; break;
      case '--help':
        print(`hypr-shuzhi - Generate wallpapers with Chinese poetry

Usage: gjs -m src/main.js [OPTIONS]

Options:
  --dark           Dark theme (default)
  --light          Light theme
  --random         Randomly select dark or light theme
  --horizontal     Horizontal text layout (default)
  --vertical       Vertical text layout
  --sketch TYPE    Sketch type: wave, blob, oval, tree, cloud, random (default)
  --font FONT      Font family name (default: "Serif")
  --font-size N    Font size in points (default: 36)
  --show-color     Show color name on Wave sketch
  --no-set         Generate only, don't set wallpaper
  --help           Show this help`);
        imports.system.exit(0);
    }
  }
  return config;
}

// Main
let config = parseArgs();
let pngPath = generate(config);
if (config.setWallpaper) {
  setWallpaper(pngPath);
  print('Wallpaper updated.');
}
