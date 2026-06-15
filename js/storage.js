"use strict";

/** Сохранение/загрузка состояния игры в LocalStorage. */
class SaveManager {
  constructor(key = "cat-sim-save-v1") {
    this.key = key;
  }

  defaults() {
    return {
      name: "Барсик",
      look: {
        fur: "#f4a14e",      // рыжий
        belly: "#fff6ec",    // бело-кремовый
        eye: "#6fd66f",      // зелёные глаза
        pattern: "patches",  // рыже-белые пятна
      },
      stats: { hunger: 70, energy: 80, happy: 75, weight: 1.0 },
      scores: { fish: 0, mice: 0 },
    };
  }

  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return this.defaults();
      const data = JSON.parse(raw);
      const def = this.defaults();
      // Глубокое слияние с дефолтами на случай новых полей
      return {
        name: data.name || def.name,
        look: { ...def.look, ...(data.look || {}) },
        stats: { ...def.stats, ...(data.stats || {}) },
        scores: { ...def.scores, ...(data.scores || {}) },
      };
    } catch (e) {
      return this.defaults();
    }
  }

  save(state) {
    try {
      localStorage.setItem(this.key, JSON.stringify(state));
    } catch (e) { /* квота переполнена/приватный режим — игнорируем */ }
  }
}
