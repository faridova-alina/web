"use strict";

/** Частица (ZZZ, сердечки, пыль, ноты). */
class Particle {
  constructor(x, y, opts = {}) {
    this.x = x; this.y = y;
    this.vx = opts.vx ?? Utils.rand(-12, 12);
    this.vy = opts.vy ?? Utils.rand(-40, -20);
    this.life = opts.life ?? 1.4;
    this.maxLife = this.life;
    this.text = opts.text ?? null;
    this.size = opts.size ?? 22;
    this.color = opts.color ?? "#fff";
    this.gravity = opts.gravity ?? 0;
    this.rot = Utils.rand(-0.3, 0.3);
  }
  update(dt) {
    this.life -= dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += this.gravity * dt;
  }
  draw(ctx) {
    const a = Utils.clamp(this.life / this.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot * (1 - a));
    if (this.text) {
      ctx.font = `700 ${this.size}px Baloo 2, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = this.color;
      ctx.fillText(this.text, 0, 0);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, this.size * a, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();
    }
    ctx.restore();
  }
  get dead() { return this.life <= 0; }
}

/** Мышка, выползающая из норки. */
class Mouse {
  constructor(holeX, floorY, bounds) {
    this.x = holeX;
    this.y = floorY;
    this.bounds = bounds;
    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.speed = Utils.rand(60, 110);
    this.t = Utils.rand(0, 10);
    this.caught = false;
    this.scared = false;
    this.size = Utils.rand(0.85, 1.15);
    this.changeTimer = Utils.rand(1, 2.5);
  }
  update(dt, catX) {
    this.t += dt;
    if (this.caught) return;
    // боится кота
    const d = catX - this.x;
    if (Math.abs(d) < 130) { this.scared = true; this.dir = d > 0 ? -1 : 1; }
    else { this.scared = false; this.changeTimer -= dt; if (this.changeTimer <= 0) { this.dir *= Math.random() < 0.4 ? -1 : 1; this.changeTimer = Utils.rand(1, 3); } }
    const spd = this.scared ? this.speed * 1.8 : this.speed;
    this.x += this.dir * spd * dt;
    if (this.x < this.bounds.left + 20) { this.x = this.bounds.left + 20; this.dir = 1; }
    if (this.x > this.bounds.right - 20) { this.x = this.bounds.right - 20; this.dir = -1; }
  }
  draw(ctx) {
    if (this.caught) return;
    const s = this.size;
    ctx.save();
    ctx.translate(this.x, this.y - 10 * s);
    ctx.scale(this.dir * s, s);
    const wob = Math.sin(this.t * 14) * 1.4;
    // тень
    ctx.save(); ctx.scale(1, 0.3);
    ctx.beginPath(); ctx.ellipse(0, 34, 22, 14, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fill(); ctx.restore();
    // хвост
    ctx.strokeStyle = "#d98ba0"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-16, 4);
    ctx.quadraticCurveTo(-34, 4 + Math.sin(this.t * 8) * 6, -40, -8 + Math.sin(this.t * 8) * 6);
    ctx.stroke();
    // тело
    ctx.beginPath(); ctx.ellipse(0, 4 + wob, 18, 12, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#9aa0ad"; ctx.fill();
    // голова
    ctx.beginPath(); ctx.arc(16, 0 + wob, 9, 0, Math.PI * 2);
    ctx.fillStyle = "#aab0bd"; ctx.fill();
    // ушки
    ctx.fillStyle = "#c79bb0";
    ctx.beginPath(); ctx.arc(13, -8 + wob, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(20, -8 + wob, 5, 0, Math.PI * 2); ctx.fill();
    // глаз + нос
    ctx.fillStyle = "#16161d";
    ctx.beginPath(); ctx.arc(20, -1 + wob, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ff8aa3";
    ctx.beginPath(); ctx.arc(25, 1 + wob, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

/** Дерево за окном/в саду с шевелящейся листвой. */
class Tree {
  constructor(x, y, scale = 1, hue = 0) {
    this.x = x; this.y = y; this.scale = scale; this.hue = hue;
    this.leaves = [];
    const cols = ["#6fbf5b", "#8fd673", "#57a84a", "#a7e08a"];
    for (let i = 0; i < 26; i++) {
      this.leaves.push({
        ox: Utils.rand(-60, 60), oy: Utils.rand(-130, -50),
        r: Utils.rand(18, 34), c: Utils.pick(cols),
        ph: Utils.rand(0, Math.PI * 2),
      });
    }
  }
  draw(ctx, t) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.scale, this.scale);
    // ствол + ветки
    ctx.strokeStyle = "#7a5230"; ctx.lineCap = "round";
    ctx.lineWidth = 16;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -70); ctx.stroke();
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(0, -50); ctx.lineTo(-38, -86); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -60); ctx.lineTo(40, -92); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(36, -64); ctx.stroke();
    // крона
    for (const lf of this.leaves) {
      const sway = Math.sin(t * 1.4 + lf.ph) * 4;
      ctx.beginPath();
      ctx.arc(lf.ox + sway, lf.oy + Math.cos(t + lf.ph) * 2, lf.r, 0, Math.PI * 2);
      ctx.fillStyle = lf.c;
      ctx.globalAlpha = 0.95;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

/** Базовая сцена. */
class Scene {
  constructor(name) { this.name = name; this.trees = []; }
  layout(w, h) {
    this.w = w; this.h = h;
    this.floorY = h * 0.72;
    this.bounds = { left: w * 0.12, right: w * 0.88 };
    this.catScale = Utils.clamp(h / 820, 0.62, 1.15);
  }
  // точки интереса
  get bedX() { return this.w * 0.78; }
  get tableX() { return this.w * 0.24; }
  get holeX() { return this.w * 0.5; }
  drawBack(ctx, t, env) {}
  drawFront(ctx, t, env) {}
}

/** Комната: кровать, норка, мусорка, окно с занавесками и деревьями. */
class RoomScene extends Scene {
  constructor() {
    super("room");
    this.trees = [new Tree(0, 70, 0.85, 0), new Tree(80, 90, 0.7, 0)];
  }
  drawBack(ctx, t, env) {
    const { w, h, floorY } = this;
    const dim = env.dim;
    // стена
    const wall = ctx.createLinearGradient(0, 0, 0, floorY);
    wall.addColorStop(0, Utils.shade("#c9b6e6", -dim * 0.6));
    wall.addColorStop(1, Utils.shade("#b59ada", -dim * 0.6));
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, w, floorY);
    // плинтус
    ctx.fillStyle = Utils.shade("#8f74c0", -dim * 0.5);
    ctx.fillRect(0, floorY - 16, w, 16);
    // пол
    const floor = ctx.createLinearGradient(0, floorY, 0, h);
    floor.addColorStop(0, Utils.shade("#d8a87a", -dim * 0.5));
    floor.addColorStop(1, Utils.shade("#b07e54", -dim * 0.5));
    ctx.fillStyle = floor;
    ctx.fillRect(0, floorY, w, h - floorY);
    // половицы
    ctx.strokeStyle = Utils.withAlpha("#7a5230", 0.4);
    ctx.lineWidth = 2;
    for (let i = 1; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo((w / 8) * i, floorY);
      ctx.lineTo((w / 8) * i + 30, h);
      ctx.stroke();
    }

    // ---- Окно с занавесками и деревьями ----
    this._drawWindow(ctx, t, env);
    // ---- Норка ----
    this._drawHole(ctx, env);
    // ---- Кровать ----
    this._drawBed(ctx, env);
    // ---- Столик с миской ----
    this._drawTable(ctx, env);
    // ---- Мусорка ----
    this._drawTrash(ctx, env);

    // Ночное затемнение
    if (dim > 0.02) {
      ctx.fillStyle = `rgba(10, 12, 40, ${dim * 0.55})`;
      ctx.fillRect(0, 0, w, h);
      // лунный свет из окна
      const wx = w * 0.5, wy = h * 0.34;
      const g = ctx.createRadialGradient(wx, wy, 20, wx, wy, 260);
      g.addColorStop(0, `rgba(180, 200, 255, ${dim * 0.25})`);
      g.addColorStop(1, "rgba(180,200,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  }
  _drawWindow(ctx, t, env) {
    const { w, h } = this;
    const wx = w * 0.5 - 150, wy = h * 0.18, ww = 300, wh = h * 0.32;
    // рама
    ctx.fillStyle = "#6b4a2e";
    ctx.fillRect(wx - 14, wy - 14, ww + 28, wh + 28);
    // небо за окном
    const sky = ctx.createLinearGradient(0, wy, 0, wy + wh);
    if (env.dim > 0.4) { sky.addColorStop(0, "#1b2350"); sky.addColorStop(1, "#3a3f6b"); }
    else { sky.addColorStop(0, "#aee3ff"); sky.addColorStop(1, "#e7f6ff"); }
    ctx.fillStyle = sky;
    ctx.fillRect(wx, wy, ww, wh);
    // солнце/луна
    ctx.beginPath();
    ctx.arc(wx + ww * 0.74, wy + wh * 0.26, 26, 0, Math.PI * 2);
    ctx.fillStyle = env.dim > 0.4 ? "#eef0ff" : "#fff2a8";
    ctx.shadowColor = env.dim > 0.4 ? "rgba(238,240,255,0.7)" : "rgba(255,242,168,0.8)";
    ctx.shadowBlur = 28; ctx.fill(); ctx.shadowColor = "transparent";
    // деревья за окном (клип) — видны стволы, ветки и листва
    ctx.save();
    ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip();
    ctx.save(); ctx.translate(wx + 78, wy + wh - 6); this.trees[0].draw(ctx, t); ctx.restore();
    ctx.save(); ctx.translate(wx + 212, wy + wh - 6); this.trees[1].draw(ctx, t); ctx.restore();
    ctx.restore();
    // переплёт
    ctx.strokeStyle = "#6b4a2e"; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2); ctx.stroke();
    // занавески
    for (const side of [-1, 1]) {
      const cx = side < 0 ? wx - 14 : wx + ww + 14;
      ctx.save();
      ctx.translate(cx, wy - 14);
      const grad = ctx.createLinearGradient(0, 0, side * 70, 0);
      grad.addColorStop(0, "#ff8fb1"); grad.addColorStop(1, "#ff5d92");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      const folds = 4;
      for (let i = 0; i <= folds; i++) {
        const yy = (wh + 28) * (i / folds);
        const bulge = side * (40 + Math.sin(t * 1.2 + i) * 6) * (i % 2 ? 1 : 0.5);
        ctx.quadraticCurveTo(bulge, yy - (wh + 28) / folds / 2, side * 18, yy);
      }
      ctx.lineTo(0, wh + 28);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // карниз
    ctx.fillStyle = "#caa15f";
    ctx.fillRect(wx - 30, wy - 26, ww + 60, 12);
  }
  _drawHole(ctx, env) {
    const { w, floorY } = this;
    const hx = this.holeX, hy = floorY - 6;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(hx, hy, 36, 30, 0, Math.PI, 0);
    ctx.fillStyle = Utils.shade("#1a0f0a", 0);
    ctx.fill();
    // обводка норки
    ctx.beginPath();
    ctx.ellipse(hx, hy, 38, 32, 0, Math.PI, 0);
    ctx.strokeStyle = Utils.shade("#5a3a22", -env.dim * 0.4);
    ctx.lineWidth = 4; ctx.stroke();
    ctx.restore();
  }
  _drawBed(ctx, env) {
    const { w, floorY } = this;
    const bx = this.bedX, by = floorY;
    const d = env.dim;
    ctx.save();
    // матрас-лежанка
    ctx.beginPath();
    ctx.ellipse(bx, by - 4, 120, 34, 0, 0, Math.PI * 2);
    ctx.fillStyle = Utils.shade("#7e57c2", -d * 0.4);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(bx, by - 18, 110, 30, 0, 0, Math.PI * 2);
    ctx.fillStyle = Utils.shade("#b39ddb", -d * 0.4);
    ctx.fill();
    // бортик
    ctx.lineWidth = 18; ctx.strokeStyle = Utils.shade("#9575cd", -d * 0.4);
    ctx.beginPath();
    ctx.ellipse(bx, by - 22, 104, 26, 0, Math.PI * 0.05, Math.PI * 0.95);
    ctx.stroke();
    // подушечка
    ctx.beginPath();
    ctx.ellipse(bx + 40, by - 26, 30, 16, -0.2, 0, Math.PI * 2);
    ctx.fillStyle = Utils.shade("#fff1f6", -d * 0.4);
    ctx.fill();
    ctx.restore();
  }
  _drawTable(ctx, env) {
    const { floorY } = this;
    const tx = this.tableX, ty = floorY;
    const d = env.dim;
    ctx.save();
    // столик
    ctx.fillStyle = Utils.shade("#a9744f", -d * 0.4);
    ctx.fillRect(tx - 50, ty - 60, 100, 12);
    ctx.fillRect(tx - 44, ty - 50, 8, 50);
    ctx.fillRect(tx + 36, ty - 50, 8, 50);
    // миска
    ctx.beginPath();
    ctx.ellipse(tx, ty - 60, 30, 12, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#ff6f91"; ctx.fill();
    ctx.beginPath();
    ctx.ellipse(tx, ty - 64, 26, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#ffd166"; ctx.fill();
    // корм
    ctx.fillStyle = "#b5651d";
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.arc(tx - 16 + i * 5, ty - 65 + (i % 2) * 3, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  _drawTrash(ctx, env) {
    const { w, floorY } = this;
    const x = w * 0.92, y = floorY;
    const d = env.dim;
    ctx.save();
    ctx.fillStyle = Utils.shade("#8d99ae", -d * 0.4);
    ctx.beginPath();
    ctx.moveTo(x - 26, y - 64); ctx.lineTo(x + 26, y - 64);
    ctx.lineTo(x + 20, y); ctx.lineTo(x - 20, y); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = Utils.shade("#6c7689", -d * 0.4);
    ctx.fillRect(x - 30, y - 72, 60, 10);
    // вертикальные рёбра
    ctx.strokeStyle = Utils.withAlpha("#5a6478", 0.6); ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath(); ctx.moveTo(x + i * 10, y - 60); ctx.lineTo(x + i * 9, y - 4); ctx.stroke();
    }
    // скомканная бумажка
    ctx.fillStyle = "#f3f0e7";
    ctx.beginPath(); ctx.arc(x + 6, y - 66, 8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

/** Сад: трава, цветы, деревья, небо, бабочки. */
class GardenScene extends Scene {
  constructor() {
    super("garden");
    this.trees = [new Tree(0, 0, 1.4, 0), new Tree(0, 0, 1.1, 0), new Tree(0, 0, 1.6, 0)];
    this.flowers = [];
    this.butterflies = [];
    for (let i = 0; i < 5; i++) this.butterflies.push({ ph: Utils.rand(0, 6), sp: Utils.rand(0.4, 0.9), c: Utils.pick(["#ff7eb6", "#ffd166", "#7ee8fa", "#c8a2ff"]) });
  }
  layout(w, h) {
    super.layout(w, h);
    this.floorY = h * 0.72;
    if (this.flowers.length === 0 || this._w !== w) {
      this._w = w;
      this.flowers = [];
      for (let i = 0; i < 18; i++) {
        this.flowers.push({ x: Utils.rand(40, w - 40), y: Utils.rand(this.floorY + 20, h - 20), c: Utils.pick(["#ff6f91", "#ffd166", "#ff8fb1", "#c8a2ff", "#fff"]), s: Utils.rand(0.7, 1.3) });
      }
    }
  }
  drawBack(ctx, t, env) {
    const { w, h, floorY } = this;
    const d = env.dim;
    // небо
    const sky = ctx.createLinearGradient(0, 0, 0, floorY);
    if (d > 0.4) { sky.addColorStop(0, "#1a2350"); sky.addColorStop(1, "#454a82"); }
    else { sky.addColorStop(0, "#7ec8ff"); sky.addColorStop(0.7, "#bfe9ff"); sky.addColorStop(1, "#e9f9d8"); }
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, floorY);
    // солнце
    ctx.beginPath(); ctx.arc(w * 0.82, h * 0.16, 40, 0, Math.PI * 2);
    ctx.fillStyle = d > 0.4 ? "#eef0ff" : "#fff2a8";
    ctx.shadowColor = d > 0.4 ? "rgba(238,240,255,0.6)" : "rgba(255,242,168,0.9)"; ctx.shadowBlur = 40; ctx.fill(); ctx.shadowColor = "transparent";
    // облака
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (let i = 0; i < 3; i++) {
      const cx = ((t * 12 + i * 280) % (w + 200)) - 100;
      const cy = h * (0.14 + i * 0.07);
      this._cloud(ctx, cx, cy);
    }
    // дальние холмы
    ctx.fillStyle = Utils.shade("#9bd36a", -d * 0.4);
    ctx.beginPath(); ctx.moveTo(0, floorY);
    ctx.quadraticCurveTo(w * 0.3, floorY - 80, w * 0.6, floorY - 20);
    ctx.quadraticCurveTo(w * 0.85, floorY - 70, w, floorY - 10);
    ctx.lineTo(w, floorY); ctx.closePath(); ctx.fill();
    // деревья
    this.trees[0].x = w * 0.15; this.trees[0].y = floorY + 10;
    this.trees[1].x = w * 0.55; this.trees[1].y = floorY + 4;
    this.trees[2].x = w * 0.88; this.trees[2].y = floorY + 14;
    for (const tr of this.trees) tr.draw(ctx, t);
    // трава
    const grass = ctx.createLinearGradient(0, floorY, 0, h);
    grass.addColorStop(0, Utils.shade("#86c84e", -d * 0.4));
    grass.addColorStop(1, Utils.shade("#5fa238", -d * 0.4));
    ctx.fillStyle = grass; ctx.fillRect(0, floorY, w, h - floorY);
    // цветы
    for (const f of this.flowers) this._flower(ctx, f, t);
    // бабочки
    for (const b of this.butterflies) {
      const bx = w * 0.5 + Math.sin(t * b.sp + b.ph) * w * 0.4;
      const by = floorY - 60 + Math.cos(t * b.sp * 1.7 + b.ph) * 50;
      this._butterfly(ctx, bx, by, t, b.c);
    }
    if (d > 0.02) { ctx.fillStyle = `rgba(10,12,40,${d * 0.5})`; ctx.fillRect(0, 0, w, h); }
  }
  _cloud(ctx, x, y) {
    ctx.save(); ctx.translate(x, y);
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.arc(26, 4, 20, 0, Math.PI * 2);
    ctx.arc(-24, 6, 18, 0, Math.PI * 2); ctx.arc(6, -10, 18, 0, Math.PI * 2);
    ctx.fill(); ctx.restore();
  }
  _flower(ctx, f, t) {
    ctx.save(); ctx.translate(f.x, f.y); ctx.scale(f.s, f.s);
    const sway = Math.sin(t * 1.5 + f.x) * 3;
    ctx.strokeStyle = "#3f8a2e"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(sway, -14, sway, -22); ctx.stroke();
    ctx.translate(sway, -24);
    ctx.fillStyle = f.c;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      const a = (i / 5) * Math.PI * 2;
      ctx.ellipse(Math.cos(a) * 6, Math.sin(a) * 6, 4, 6, a, 0, Math.PI * 2); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fillStyle = "#ffd166"; ctx.fill();
    ctx.restore();
  }
  _butterfly(ctx, x, y, t, c) {
    ctx.save(); ctx.translate(x, y);
    const flap = Math.abs(Math.sin(t * 12)) * 0.8 + 0.2;
    ctx.fillStyle = c;
    for (const s of [-1, 1]) {
      ctx.save(); ctx.scale(s * flap, 1);
      ctx.beginPath(); ctx.ellipse(8, -3, 7, 9, 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(7, 6, 5, 6, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = "#3a2d20";
    ctx.beginPath(); ctx.ellipse(0, 0, 2, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

/** Озеро: для входа в рыбалку (статичный фон). */
class LakeScene extends Scene {
  constructor() { super("lake"); this.trees = [new Tree(0, 0, 1.2, 0)]; }
  layout(w, h) { super.layout(w, h); this.floorY = h * 0.6; this.bounds = { left: w * 0.2, right: w * 0.8 }; }
  drawBack(ctx, t, env) {
    const { w, h, floorY } = this;
    const d = env.dim;
    const sky = ctx.createLinearGradient(0, 0, 0, floorY);
    sky.addColorStop(0, Utils.shade("#ffb38a", -d * 0.4));
    sky.addColorStop(0.5, Utils.shade("#ffd6a5", -d * 0.3));
    sky.addColorStop(1, Utils.shade("#cde7ff", -d * 0.3));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, floorY);
    // солнце низко
    ctx.beginPath(); ctx.arc(w * 0.5, floorY - 30, 46, 0, Math.PI * 2);
    ctx.fillStyle = "#fff0c2"; ctx.shadowColor = "rgba(255,220,150,0.9)"; ctx.shadowBlur = 50; ctx.fill(); ctx.shadowColor = "transparent";
    // деревья на берегу
    this.trees[0].x = w * 0.12; this.trees[0].y = floorY; this.trees[0].draw(ctx, t);
    // вода
    const water = ctx.createLinearGradient(0, floorY, 0, h);
    water.addColorStop(0, Utils.shade("#3a9bd6", -d * 0.3));
    water.addColorStop(1, Utils.shade("#1f5e94", -d * 0.3));
    ctx.fillStyle = water; ctx.fillRect(0, floorY, w, h - floorY);
    // блики на воде
    ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      const yy = floorY + 20 + i * (h - floorY) / 8;
      ctx.beginPath();
      ctx.moveTo(0, yy);
      for (let xx = 0; xx <= w; xx += 40) ctx.lineTo(xx, yy + Math.sin(xx * 0.05 + t * 2 + i) * 3);
      ctx.stroke();
    }
    // мостик
    ctx.fillStyle = "#8a5a32";
    ctx.fillRect(w * 0.55, floorY - 6, w * 0.3, 14);
    for (let i = 0; i < 5; i++) ctx.fillRect(w * 0.56 + i * w * 0.06, floorY + 8, 8, 40);
    if (d > 0.02) { ctx.fillStyle = `rgba(10,12,40,${d * 0.5})`; ctx.fillRect(0, 0, w, h); }
  }
  get bedX() { return this.w * 0.3; }
  get tableX() { return this.w * 0.3; }
}
