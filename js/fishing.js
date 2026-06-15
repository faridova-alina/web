"use strict";

/**
 * Мини-игра «Рыбалка».
 * Рыбки плавают по горизонтальным дорожкам (сетка глубин — «движок» как у тетриса:
 * дискретные ряды). Игрок двигает крючок ← → и подсекает (Пробел/клик) рыбу под крючком.
 */
class FishingGame {
  constructor(canvas, audio, cat) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.audio = audio;
    this.cat = cat;
    this.running = false;
    this.onEnd = null;
    this.input = { left: false, right: false };
    this._bind();
  }

  _bind() {
    this._key = (e, down) => {
      if (!this.running) return;
      if (e.key === "ArrowLeft") this.input.left = down;
      if (e.key === "ArrowRight") this.input.right = down;
      if (down && (e.code === "Space" || e.key === " ")) { this.cast(); e.preventDefault(); }
    };
    window.addEventListener("keydown", (e) => this._key(e, true));
    window.addEventListener("keyup", (e) => this._key(e, false));
    this.canvas.addEventListener("pointerdown", (e) => {
      if (!this.running) return;
      const r = this.canvas.getBoundingClientRect();
      this.hookX = (e.clientX - r.left) * (this.canvas.width / r.width);
      this.cast();
    });
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
  }

  start(onEnd) {
    this.onEnd = onEnd;
    this.resize();
    this.running = true;
    this.time = 60;
    this.caught = 0;
    this.t = 0;
    this.waterY = this.H * 0.32;
    this.hookX = this.W / 2;
    this.hookY = this.waterY;
    this.hookDrop = 0;      // 0..1 анимация заброса
    this.casting = false;
    this.grabbed = null;
    this.fish = [];
    this.bubbles = [];
    this.splashes = [];
    // дорожки глубин
    this.lanes = [];
    const laneCount = 5;
    for (let i = 0; i < laneCount; i++) {
      this.lanes.push(this.waterY + 70 + i * ((this.H - this.waterY - 90) / laneCount));
    }
    for (let i = 0; i < 7; i++) this._spawnFish();
    this.audio && this.audio.startHuntMusic();
    this._last = performance.now();
    this._loop = this._frame.bind(this);
    requestAnimationFrame(this._loop);
    this._timer = setInterval(() => {
      this.time--;
      const el = document.getElementById("fishTimer");
      if (el) el.textContent = this.time;
      if (this.time <= 0) this.stop();
    }, 1000);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    clearInterval(this._timer);
    this.audio && this.audio.stopHuntMusic();
    if (this.onEnd) this.onEnd(this.caught);
  }

  _spawnFish() {
    const lane = Utils.randInt(0, this.lanes.length - 1);
    const dir = Math.random() < 0.5 ? 1 : -1;
    const kinds = [
      { c: "#ff8c5a", pts: 1, size: 1 },
      { c: "#5ec8ff", pts: 1, size: 0.9 },
      { c: "#ffd166", pts: 2, size: 1.1 },
      { c: "#ff6f91", pts: 3, size: 1.3 },
      { c: "#9b7bff", pts: 5, size: 0.8 },  // редкая мелкая ценная
    ];
    const k = Utils.pick(kinds);
    this.fish.push({
      x: dir > 0 ? -40 : this.W + 40,
      y: this.lanes[lane] + Utils.rand(-12, 12),
      dir, speed: Utils.rand(50, 120) * (1 + k.pts * 0.08),
      ...k, ph: Utils.rand(0, 6), caught: false,
    });
  }

  cast() {
    if (this.casting) return;
    this.casting = true;
    this.hookDrop = 0;
    this.audio && this.audio.blip(520);
  }

  _frame(now) {
    if (!this.running) return;
    const dt = Math.min((now - this._last) / 1000, 0.05);
    this._last = now;
    this._update(dt);
    this._draw();
    requestAnimationFrame(this._loop);
  }

  _update(dt) {
    this.t += dt;
    // движение крючка
    const sp = 360;
    if (this.input.left) this.hookX -= sp * dt;
    if (this.input.right) this.hookX += sp * dt;
    this.hookX = Utils.clamp(this.hookX, 30, this.W - 30);

    // анимация заброса
    if (this.casting) {
      this.hookDrop += dt * 2.2;
      if (this.hookDrop >= 1) {
        // момент ловли — у дна
        if (!this.grabbed) {
          let best = null, bestD = 46;
          for (const f of this.fish) {
            if (f.caught) continue;
            const d = Utils.dist(this.hookX, this._hookTipY(), f.x, f.y);
            if (d < bestD) { bestD = d; best = f; }
          }
          if (best) {
            best.caught = true; this.grabbed = best;
            this.audio && this.audio.blip(880);
          }
        }
      }
      if (this.hookDrop >= 2) {
        // вытащили
        this.casting = false;
        this.hookDrop = 0;
        if (this.grabbed) {
          this.caught += this.grabbed.pts;
          this.fish = this.fish.filter((f) => f !== this.grabbed);
          this.grabbed = null;
          this._spawnFish();
          const el = document.getElementById("fishCatch");
          if (el) el.textContent = this.caught;
          this.audio && this.audio.purr();
          for (let i = 0; i < 8; i++) this.splashes.push({ x: this.hookX, y: this.waterY, vx: Utils.rand(-80, 80), vy: Utils.rand(-160, -40), life: 0.6 });
        }
      } else if (this.hookDrop >= 1) {
        this.hookDrop += dt * 2.2; // фаза вытаскивания
      }
    }

    // рыбы
    for (const f of this.fish) {
      if (f === this.grabbed) {
        f.x = this.hookX; f.y = this._hookTipY();
        continue;
      }
      if (f.caught) continue;
      f.x += f.dir * f.speed * dt;
      f.y += Math.sin(this.t * 2 + f.ph) * 8 * dt;
      if (f.x < -60 || f.x > this.W + 60) {
        f.x = f.dir > 0 ? -40 : this.W + 40;
        f.y = Utils.pick(this.lanes) + Utils.rand(-12, 12);
      }
    }
    // пузырьки
    if (Math.random() < 0.3) this.bubbles.push({ x: Utils.rand(0, this.W), y: this.H, r: Utils.rand(2, 6), sp: Utils.rand(20, 60) });
    this.bubbles = this.bubbles.filter((b) => { b.y -= b.sp * dt; return b.y > this.waterY; });
    this.splashes = this.splashes.filter((s) => { s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 400 * dt; return s.life > 0; });
  }

  _hookTipY() {
    const maxY = this.H - 60;
    const phase = this.hookDrop <= 1 ? this.hookDrop : 2 - this.hookDrop;
    return this.waterY + (maxY - this.waterY) * Utils.easeOut(phase);
  }

  _draw() {
    const ctx = this.ctx, W = this.W, H = this.H;
    // небо
    const sky = ctx.createLinearGradient(0, 0, 0, this.waterY);
    sky.addColorStop(0, "#ffcaa0"); sky.addColorStop(1, "#cde7ff");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, this.waterY);
    // солнце
    ctx.beginPath(); ctx.arc(W * 0.82, H * 0.12, 38, 0, Math.PI * 2);
    ctx.fillStyle = "#fff0c2"; ctx.shadowColor = "rgba(255,220,150,0.8)"; ctx.shadowBlur = 40; ctx.fill(); ctx.shadowColor = "transparent";

    // вода
    const water = ctx.createLinearGradient(0, this.waterY, 0, H);
    water.addColorStop(0, "#3aa0d6"); water.addColorStop(1, "#103e6b");
    ctx.fillStyle = water; ctx.fillRect(0, this.waterY, W, H - this.waterY);

    // поверхность воды (волны)
    ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 20) {
      const y = this.waterY + Math.sin(x * 0.04 + this.t * 2) * 5;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // пузырьки
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    for (const b of this.bubbles) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); }

    // рыбы
    for (const f of this.fish) this._drawFish(ctx, f);

    // плот/настил наверху
    ctx.fillStyle = "#8a5a32"; ctx.fillRect(0, this.waterY - 26, W, 26);
    ctx.fillStyle = "#6e4626";
    for (let x = 0; x < W; x += 46) ctx.fillRect(x, this.waterY - 26, 4, 26);

    // кот с удочкой
    this._drawAngler(ctx);

    // леска + крючок
    const tipX = this.hookX, tipY = this._hookTipY();
    const rodX = this.hookX - 4, rodY = this.waterY - 90;
    ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(rodX, rodY); ctx.quadraticCurveTo(tipX, (rodY + tipY) / 2, tipX, tipY); ctx.stroke();
    // крючок + поплавок
    ctx.fillStyle = "#ff4d4d";
    ctx.beginPath(); ctx.arc(tipX, this.waterY, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#dfe6f0"; ctx.lineWidth = 2.4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(tipX, tipY, 6, Math.PI * 0.2, Math.PI * 1.4); ctx.stroke();

    // брызги
    for (const s of this.splashes) {
      ctx.globalAlpha = Utils.clamp(s.life / 0.6, 0, 1);
      ctx.fillStyle = "#bfe6ff";
      ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _drawAngler(ctx) {
    // упрощённый кот, держащий удочку, на настиле
    const cx = this.hookX, cy = this.waterY - 26;
    ctx.save();
    ctx.translate(cx - 40, cy);
    const bob = Math.sin(this.t * 2) * 2;
    // тело
    ctx.fillStyle = this.cat ? this.cat.look.fur : "#f4a14e";
    ctx.beginPath(); ctx.ellipse(0, -26 + bob, 26, 30, 0, 0, Math.PI * 2); ctx.fill();
    // голова
    ctx.beginPath(); ctx.arc(6, -56 + bob, 20, 0, Math.PI * 2); ctx.fill();
    // ушки
    ctx.beginPath(); ctx.moveTo(-8, -70 + bob); ctx.lineTo(-2, -84 + bob); ctx.lineTo(6, -70 + bob); ctx.fill();
    ctx.beginPath(); ctx.moveTo(8, -70 + bob); ctx.lineTo(16, -84 + bob); ctx.lineTo(22, -70 + bob); ctx.fill();
    // глаза
    ctx.fillStyle = "#16161d";
    ctx.beginPath(); ctx.arc(0, -56 + bob, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(12, -56 + bob, 2.5, 0, Math.PI * 2); ctx.fill();
    // удочка
    ctx.strokeStyle = "#5a3a1a"; ctx.lineWidth = 4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(20, -30 + bob); ctx.lineTo(44, -64 + bob); ctx.stroke();
    ctx.restore();
  }

  _drawFish(ctx, f) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.scale(f.dir * f.size, f.size);
    const tail = Math.sin(this.t * 8 + f.ph) * 0.4;
    // тело
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 11, 0, 0, Math.PI * 2);
    const g = ctx.createLinearGradient(0, -11, 0, 11);
    g.addColorStop(0, Utils.shade(f.c, 0.25)); g.addColorStop(1, Utils.shade(f.c, -0.15));
    ctx.fillStyle = g; ctx.fill();
    // хвост
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.lineTo(-30, -10 + tail * 10);
    ctx.lineTo(-30, 10 + tail * 10);
    ctx.closePath(); ctx.fillStyle = Utils.shade(f.c, -0.05); ctx.fill();
    // плавник
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(8, -16); ctx.lineTo(8, -6); ctx.closePath(); ctx.fill();
    // глаз
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(10, -2, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#16161d"; ctx.beginPath(); ctx.arc(11, -2, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
