"use strict";

class Game {
  constructor() {
    this.canvas = document.getElementById("scene");
    this.ctx = this.canvas.getContext("2d");
    this.audio = new AudioEngine();
    this.save = new SaveManager();
    this.state = this.save.load();

    this.cat = new Cat(this.state.look, this.audio);
    this.cat.setWeight(this.state.stats.weight);
    this.cat.weight = this.state.stats.weight;

    this.scenes = { room: new RoomScene(), garden: new GardenScene(), lake: new LakeScene() };
    this.current = "room";

    this.input = { left: false, right: false, shift: false };
    this.particles = [];
    this.mice = [];
    this.env = { dim: 0 };
    this.targetDim = 0;

    this.zzzTimer = 0;
    this.heartTimer = 0;
    this.mouseSpawnTimer = 2;
    this.statusText = "";
    this.statusTimer = 0;
    this.saveTimer = 5;
    this.catchCooldown = 0;

    this.fishing = new FishingGame(document.getElementById("fishingCanvas"), this.audio, this.cat);

    this._bindInput();
    this._bindUI();
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this._syncUI();
  }

  // ---------------- Инициализация / запуск ----------------
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width = this.W * dpr;
    this.canvas.height = this.H * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const k in this.scenes) this.scenes[k].layout(this.W, this.H);
    this._placeCatInScene(true);
  }

  _placeCatInScene(snap = false) {
    const s = this.scenes[this.current];
    this.cat.y = s.floorY;
    this.cat.scale = s.catScale;
    this.cat.bounds = s.bounds;
    if (snap) this.cat.x = (s.bounds.left + s.bounds.right) / 2;
    this.cat.x = Utils.clamp(this.cat.x, s.bounds.left, s.bounds.right);
  }

  start() {
    document.getElementById("splash").classList.add("hidden");
    document.getElementById("game").classList.remove("hidden");
    this.audio.init();
    this.audio.resume();
    this.resize();
    this.last = performance.now();
    this.running = true;
    requestAnimationFrame((t) => this.loop(t));
    this.toast(`Привет! Это ${this.state.name} 🐾`);
  }

  // ---------------- Ввод ----------------
  _bindInput() {
    const keyMap = { "1": "idle", "2": "walk", "3": "jump", "4": "dance", "5": "sneak", "6": "sleep", "7": "eat", "8": "hunt" };
    window.addEventListener("keydown", (e) => {
      if (this.fishing.running) return;
      if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") this.input.left = true;
      if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") this.input.right = true;
      if (e.key === "Shift") this.input.shift = true;
      if (e.code === "Space") { this.triggerAction("jump"); e.preventDefault(); }
      if (keyMap[e.key]) this.triggerAction(keyMap[e.key]);
    });
    window.addEventListener("keyup", (e) => {
      if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") this.input.left = false;
      if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") this.input.right = false;
      if (e.key === "Shift") this.input.shift = false;
    });
    // клик по сцене — кот идёт туда и мяукает / ловит мышь
    this.canvas.addEventListener("pointerdown", (e) => {
      if (!this.running) return;
      const x = e.clientX;
      this.cat.moveTarget = Utils.clamp(x, this.cat.bounds.left, this.cat.bounds.right);
      if (["sleep", "eat"].includes(this.cat.action)) this.triggerAction("idle");
      this.audio.meow();
    });
  }

  // ---------------- UI ----------------
  _bindUI() {
    document.getElementById("startBtn").addEventListener("click", () => this.start());

    document.querySelectorAll(".act-btn").forEach((btn) => {
      btn.addEventListener("click", () => this.triggerAction(btn.dataset.act));
    });
    document.querySelectorAll(".loc-btn").forEach((btn) => {
      btn.addEventListener("click", () => this.switchLocation(btn.dataset.loc));
    });

    // Кастомизация
    this.panel = document.getElementById("customizePanel");
    document.getElementById("closeCustomize").addEventListener("click", () => this._closeCustomize());
    this.preview = document.getElementById("previewCanvas");
    this.previewCtx = this.preview.getContext("2d");

    this._buildSwatches("furSwatches", ["#f4a14e", "#5a4636", "#2b2b2f", "#e8e8ee", "#c98a5b", "#9a9aa6", "#3a3f6b"], "fur", "furPicker");
    this._buildSwatches("bellySwatches", ["#fff6ec", "#ffffff", "#f0e2c8", "#d9d2c4", "#3a3a3f"], "belly", "bellyPicker");
    this._buildSwatches("eyeSwatches", ["#6fd66f", "#ffd166", "#5ec8ff", "#b07cff", "#ff8a3d", "#8d99ae"], "eye", "eyePicker");

    document.getElementById("furPicker").addEventListener("input", (e) => this._setLook("fur", e.target.value));
    document.getElementById("bellyPicker").addEventListener("input", (e) => this._setLook("belly", e.target.value));
    document.getElementById("eyePicker").addEventListener("input", (e) => this._setLook("eye", e.target.value));

    document.querySelectorAll("#patternBtns button").forEach((b) => {
      b.addEventListener("click", () => {
        document.querySelectorAll("#patternBtns button").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        this.state.look.pattern = b.dataset.pattern;
        this._afterLookChange();
      });
    });

    document.getElementById("randomLook").addEventListener("click", () => this._randomLook());

    // Имя
    this.nameInput = document.getElementById("nameInput");
    this.nameInput.addEventListener("input", (e) => {
      const v = e.target.value.trim() || "Кот";
      this.state.name = v;
      document.getElementById("catName").textContent = v;
      this._scheduleSave();
    });
    document.getElementById("renameBtn").addEventListener("click", () => {
      this._openCustomize();
      this.nameInput.focus();
      this.nameInput.select();
    });

    document.getElementById("exitFishing").addEventListener("click", () => this._exitFishing());
  }

  _buildSwatches(containerId, colors, key, pickerId) {
    const c = document.getElementById(containerId);
    c.innerHTML = "";
    colors.forEach((col) => {
      const s = document.createElement("div");
      s.className = "swatch";
      s.style.background = col;
      if (this.state.look[key] === col) s.classList.add("active");
      s.addEventListener("click", () => {
        c.querySelectorAll(".swatch").forEach((x) => x.classList.remove("active"));
        s.classList.add("active");
        document.getElementById(pickerId).value = col;
        this._setLook(key, col);
      });
      c.appendChild(s);
    });
  }

  _setLook(key, value) {
    this.state.look[key] = value;
    this._afterLookChange();
  }

  _afterLookChange() {
    this.cat.look = this.state.look;
    this.audio.blip(600);
    this._scheduleSave();
  }

  _randomLook() {
    const furs = ["#f4a14e", "#5a4636", "#2b2b2f", "#e8e8ee", "#c98a5b", "#9a9aa6", "#d98b5b"];
    const bellies = ["#fff6ec", "#ffffff", "#f0e2c8", "#d9d2c4"];
    const eyes = ["#6fd66f", "#ffd166", "#5ec8ff", "#b07cff", "#ff8a3d"];
    const patterns = ["solid", "tabby", "patches", "tuxedo"];
    this.state.look = {
      fur: Utils.pick(furs), belly: Utils.pick(bellies),
      eye: Utils.pick(eyes), pattern: Utils.pick(patterns),
    };
    document.getElementById("furPicker").value = this.state.look.fur;
    document.getElementById("bellyPicker").value = this.state.look.belly;
    document.getElementById("eyePicker").value = this.state.look.eye;
    document.querySelectorAll("#patternBtns button").forEach((x) =>
      x.classList.toggle("active", x.dataset.pattern === this.state.look.pattern));
    this._afterLookChange();
  }

  _openCustomize() {
    this.panel.classList.remove("hidden");
    this.nameInput.value = this.state.name;
    this._previewLoop = true;
    this._renderPreview();
  }
  _closeCustomize() {
    this.panel.classList.add("hidden");
    this._previewLoop = false;
  }
  _renderPreview() {
    if (!this._previewLoop) return;
    const ctx = this.previewCtx;
    ctx.clearRect(0, 0, this.preview.width, this.preview.height);
    this.cat.renderStatic(ctx, 95, 158, 0.5);
    requestAnimationFrame(() => this._renderPreview());
  }

  _syncUI() {
    document.getElementById("catName").textContent = this.state.name;
    document.getElementById("fishScore").textContent = this.state.scores.fish;
    document.getElementById("mouseScore").textContent = this.state.scores.mice;
    this._updateBars();
  }
  _updateBars() {
    document.getElementById("barHunger").style.width = this.state.stats.hunger + "%";
    document.getElementById("barEnergy").style.width = this.state.stats.energy + "%";
    document.getElementById("barHappy").style.width = this.state.stats.happy + "%";
  }

  // ---------------- Действия ----------------
  triggerAction(act) {
    if (act === "customize") { this._openCustomize(); return; }
    document.querySelectorAll(".act-btn").forEach((b) =>
      b.classList.toggle("active", b.dataset.act === act && act !== "jump"));

    const s = this.scenes[this.current];
    this.cat.moveTarget = null;

    switch (act) {
      case "jump":
        this.cat.setAction("jump");
        this.bubble("Хоп! ⬆️");
        break;
      case "sleep":
        this.cat.moveTarget = s.bedX;
        this.cat.setAction("sleep");
        this.targetDim = 0.78;
        this.bubble("Пора спать 😴");
        this.audio.stopHuntMusic();
        break;
      case "eat":
        this.cat.moveTarget = s.tableX;
        this.cat.setAction("eat");
        this.bubble("Ням-ням 🍽️");
        this.audio.stopHuntMusic();
        break;
      case "hunt":
        this.cat.setAction("hunt");
        this.bubble("Охота началась! 🎯");
        this.audio.startHuntMusic();
        if (this.current === "room") this._fillMice(4);
        this.targetDim = 0;
        break;
      case "dance":
        this.cat.setAction("dance");
        this.bubble("Танцуем! 💃");
        this.audio.purr();
        this.targetDim = 0;
        break;
      case "walk":
        this.cat.setAction("walk");
        this.bubble("Гуляю 🚶");
        this.targetDim = 0;
        this.audio.stopHuntMusic();
        break;
      case "sneak":
        this.cat.setAction("sneak");
        this.bubble("Крадусь... 🐾");
        this.targetDim = 0;
        break;
      case "idle":
      default:
        this.cat.setAction("idle");
        this.targetDim = 0;
        this.audio.stopHuntMusic();
        this.audio.meow();
        break;
    }
    if (act !== "hunt") this.audio.stopHuntMusic();
  }

  switchLocation(loc) {
    if (loc === this.current && loc !== "lake") return;
    document.querySelectorAll(".loc-btn").forEach((b) =>
      b.classList.toggle("active", b.dataset.loc === loc));

    if (loc === "lake") {
      this._enterFishing();
      return;
    }
    this.current = loc;
    this.mice = [];
    this.particles = [];
    this.targetDim = 0;
    this._placeCatInScene(true);
    this.cat.setAction("idle");
    document.querySelectorAll(".act-btn").forEach((b) => b.classList.toggle("active", b.dataset.act === "idle"));
    this.toast(loc === "garden" ? "🌳 Сад" : "🛏️ Комната");
  }

  // ---------------- Рыбалка ----------------
  _enterFishing() {
    document.getElementById("fishingOverlay").classList.remove("hidden");
    document.getElementById("fishTimer").textContent = "60";
    document.getElementById("fishCatch").textContent = "0";
    this.fishing.start((caught) => {
      this.state.scores.fish += caught;
      this.state.stats.happy = Utils.clamp(this.state.stats.happy + caught * 2, 0, 100);
      document.getElementById("fishScore").textContent = this.state.scores.fish;
      this._updateBars();
      this._scheduleSave();
      this._exitFishing(caught);
    });
  }
  _exitFishing(caught) {
    this.fishing.stop();
    document.getElementById("fishingOverlay").classList.add("hidden");
    document.querySelector('.loc-btn[data-loc="room"]').classList.add("active");
    document.querySelector('.loc-btn[data-loc="lake"]').classList.remove("active");
    if (caught != null) this.toast(`🎣 Поймано рыбы: ${caught}!`);
  }

  // ---------------- Мышки ----------------
  _fillMice(n) {
    const s = this.scenes[this.current];
    while (this.mice.length < n) this.mice.push(new Mouse(s.holeX, s.floorY, s.bounds));
  }

  // ---------------- Облачка / тосты ----------------
  bubble(text, time = 2.2) { this.statusText = text; this.statusTimer = time; }
  toast(text, time = 2.4) {
    const el = document.getElementById("toast");
    el.textContent = text;
    el.classList.remove("hidden");
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => el.classList.add("hidden"), time * 1000);
  }

  _scheduleSave() { this.saveTimer = Math.min(this.saveTimer, 1); }

  // ---------------- Цикл ----------------
  loop(now) {
    if (!this.running) return;
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    if (!this.fishing.running) {
      this.update(dt);
      this.render();
    }
    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    const st = this.state.stats;
    const s = this.scenes[this.current];

    // плавная смена освещения
    this.env.dim = Utils.lerp(this.env.dim, this.targetDim, dt * 2);

    // апдейт кота
    this._placeCatInScene(false);
    this.cat.update(dt, this.fishing.running ? null : this.input);

    // ---- Статы ----
    st.hunger = Utils.clamp(st.hunger - dt * 0.7, 0, 100);
    if (this.cat.action === "sleep") {
      st.energy = Utils.clamp(st.energy + dt * 6, 0, 100);
      st.happy = Utils.clamp(st.happy + dt * 0.5, 0, 100);
    } else {
      const drain = this.cat._running ? 4 : 1.2;
      st.energy = Utils.clamp(st.energy - dt * drain, 0, 100);
    }
    // счастье зависит от сытости и энергии
    if (st.hunger < 25 || st.energy < 15) st.happy = Utils.clamp(st.happy - dt * 1.5, 0, 100);
    if (["dance", "hunt"].includes(this.cat.action)) st.happy = Utils.clamp(st.happy + dt * 1.2, 0, 100);

    // ---- Кормление ----
    if (this.cat.action === "eat" && Math.abs(this.cat.x - s.tableX) < 30) {
      st.hunger = Utils.clamp(st.hunger + dt * 16, 0, 100);
      st.weight = Utils.clamp(st.weight + dt * 0.05, 0.7, 1.6);
      st.happy = Utils.clamp(st.happy + dt * 1, 0, 100);
      if (Math.random() < dt * 1.5) this._emitHearts(this.cat.x, this.cat.y - 240 * this.cat.scale, 1);
    }
    // худеет когда голодный/активный
    if (st.hunger < 35) st.weight = Utils.clamp(st.weight - dt * 0.02, 0.7, 1.6);
    this.cat.setWeight(st.weight);

    // ---- ZZZ во сне ----
    if (this.cat.action === "sleep") {
      this.zzzTimer -= dt;
      if (this.zzzTimer <= 0) {
        this.zzzTimer = 0.9;
        this.particles.push(new Particle(
          this.cat.x + 40 * this.cat.dir, this.cat.y - 150 * this.cat.scale,
          { text: "Z", size: Utils.rand(20, 30), color: "rgba(255,255,255,0.9)", vx: 14 * this.cat.dir, vy: -34, life: 2.2 }
        ));
      }
    }

    // ---- Мышки (только в комнате) ----
    if (this.current === "room") {
      this.mouseSpawnTimer -= dt;
      const target = this.cat.action === "hunt" ? 4 : 1;
      if (this.mouseSpawnTimer <= 0 && this.mice.length < target) {
        this.mice.push(new Mouse(s.holeX, s.floorY, s.bounds));
        this.mouseSpawnTimer = Utils.rand(3, 7);
      }
      for (const m of this.mice) m.update(dt, this.cat.x);
      // ловля
      this.catchCooldown -= dt;
      if (this.catchCooldown <= 0) {
        for (const m of this.mice) {
          if (Utils.dist(this.cat.x, 0, m.x, 0) < 52) {
            m.caught = true;
            this.state.scores.mice++;
            document.getElementById("mouseScore").textContent = this.state.scores.mice;
            st.happy = Utils.clamp(st.happy + 4, 0, 100);
            this._emitHearts(m.x, this.cat.y - 60, 6);
            this.bubble("Поймал мышку! 🐭");
            this.audio.blip(900);
            this.catchCooldown = 0.6;
          }
        }
      }
      this.mice = this.mice.filter((m) => !m.caught);
    }

    // частицы
    for (const p of this.particles) p.update(dt);
    this.particles = this.particles.filter((p) => !p.dead);

    // случайное мяуканье
    this.meowTimer = (this.meowTimer || Utils.rand(8, 16)) - dt;
    if (this.meowTimer <= 0) { if (this.cat.action !== "sleep") this.audio.meow(); this.meowTimer = Utils.rand(10, 20); }

    // статус-облако
    if (this.statusTimer > 0) this.statusTimer -= dt;

    // UI шкалы
    this._updateBars();

    // автосохранение
    this.saveTimer -= dt;
    if (this.saveTimer <= 0) {
      this.state.stats = st;
      this.save.save(this.state);
      this.saveTimer = 5;
    }
  }

  _emitHearts(x, y, n) {
    for (let i = 0; i < n; i++) {
      this.particles.push(new Particle(x + Utils.rand(-20, 20), y, {
        text: Utils.pick(["❤", "♥", "✨"]), size: Utils.rand(16, 26),
        color: Utils.pick(["#ff7eb6", "#ffd166", "#ff5d92"]),
        vx: Utils.rand(-30, 30), vy: Utils.rand(-70, -40), life: 1.3,
      }));
    }
  }

  render() {
    const ctx = this.ctx;
    const s = this.scenes[this.current];
    ctx.clearRect(0, 0, this.W, this.H);

    s.drawBack(ctx, performance.now() / 1000, this.env);

    // мышки за/перед котом по глубине (рисуем перед котом для простоты)
    for (const m of this.mice) m.draw(ctx);

    this.cat.draw(ctx);

    // частицы
    for (const p of this.particles) p.draw(ctx);

    s.drawFront(ctx, performance.now() / 1000, this.env);

    // позиция облачка над котом
    this._positionBubble();
  }

  _positionBubble() {
    const el = document.getElementById("statusBubble");
    if (this.statusTimer <= 0) { el.classList.add("hidden"); return; }
    el.classList.remove("hidden");
    el.textContent = this.statusText;
    const topY = this.cat.y - (270 - (this.cat.pose.bodyDY || 0)) * this.cat.scale;
    el.style.left = this.cat.x + "px";
    el.style.top = Math.max(70, topY) + "px";
  }
}

// Запуск
window.addEventListener("DOMContentLoaded", () => {
  window.__game = new Game();
});
