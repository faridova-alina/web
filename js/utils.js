"use strict";

/** Набор математических и цветовых помощников. */
const Utils = {
  clamp(v, min, max) { return v < min ? min : v > max ? max : v; },
  lerp(a, b, t) { return a + (b - a) * t; },
  rand(min, max) { return min + Math.random() * (max - min); },
  randInt(min, max) { return Math.floor(Utils.rand(min, max + 1)); },
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  // Плавное колебание 0..1
  pingPong(t) { return 0.5 - 0.5 * Math.cos(t); },
  // Сглаживание
  easeOut(t) { return 1 - Math.pow(1 - t, 3); },
  easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },

  // Перевод HEX -> {r,g,b}
  hexToRgb(hex) {
    const m = hex.replace("#", "");
    const n = m.length === 3
      ? m.split("").map((c) => c + c).join("")
      : m;
    const int = parseInt(n, 16);
    return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
  },
  rgbToHex(r, g, b) {
    const h = (v) => Utils.clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0");
    return `#${h(r)}${h(g)}${h(b)}`;
  },
  // Осветлить/затемнить HEX (amt: -1..1)
  shade(hex, amt) {
    const { r, g, b } = Utils.hexToRgb(hex);
    if (amt >= 0) {
      return Utils.rgbToHex(
        Utils.lerp(r, 255, amt),
        Utils.lerp(g, 255, amt),
        Utils.lerp(b, 255, amt)
      );
    }
    const k = 1 + amt;
    return Utils.rgbToHex(r * k, g * k, b * k);
  },
  withAlpha(hex, a) {
    const { r, g, b } = Utils.hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  },

  // Расстояние между точками
  dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); },
};
