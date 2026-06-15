"use strict";

/**
 * Кот: процедурная отрисовка на Canvas + система анимаций.
 * Тело — в профиль (для походки/бега/прыжков), голова повёрнута к зрителю (3/4),
 * поэтому видно оба глаза, оба уха и усы с обеих сторон (по 6).
 */
class Cat {
  constructor(look, audio) {
    this.look = look;            // {fur, belly, eye, pattern}
    this.audio = audio;

    // Положение в сцене (заполняет сцена)
    this.x = 0;
    this.y = 0;                  // координата пола под котом
    this.scale = 1;
    this.dir = 1;                // 1 — смотрит вправо, -1 — влево
    this.bounds = { left: 0, right: 0 };

    // Состояние
    this.action = "idle";
    this.prevAction = "idle";
    this.animTime = 0;           // секунды с начала действия
    this.cycle = 0;              // фаза шага
    this.t = 0;                  // общий таймер

    // Прыжок
    this.jumpProgress = 1;       // 1 — на земле
    this.jumpHeight = 0;

    // Глаза/моргание
    this.blinkTimer = Utils.rand(2, 5);
    this.blink = 0;              // 0..1, 1 — закрыты
    this.lookTarget = { x: 0, y: 0 };
    this.lookTimer = 0;

    // Динамические величины походки
    this.speed = 0;              // текущая горизонтальная скорость
    this.weight = 1.0;           // полнота (1 — норма)

    // Цель движения (для охоты/еды): если задана — кот идёт к ней
    this.moveTarget = null;

    this.pose = this._neutralPose();
  }

  _neutralPose() {
    return {
      bodyDX: 0, bodyDY: 0, bodyTilt: 0, stretch: 1, crouch: 0,
      headDX: 0, headDY: 0, headTilt: 0,
      earTwitch: 0, eyeOpen: 1, pupilDX: 0, pupilDY: 0, browRaise: 0,
      mouthOpen: 0, tailWave: 0, tailLift: 0, whiskerDroop: 0,
      legPhase: { fn: 0, ff: 0.5, bn: 0.5, bf: 0 }, gaitAmp: 0, gaitLift: 0,
      frontPawLift: { near: 0, far: 0 }, fatness: this.weight,
    };
  }

  setAction(action) {
    if (action === this.action) return;
    // Прыжок — одноразовое действие поверх текущего
    if (action === "jump") {
      if (this.jumpProgress >= 1) {
        this.jumpProgress = 0;
        this.jumpHeight = 130;
        this.audio && this.audio.blip(720);
      }
      return;
    }
    this.prevAction = this.action;
    this.action = action;
    this.animTime = 0;
    if (action === "sleep") this.audio && this.audio.purr();
    if (action === "idle") this.audio && Math.random() < 0.4 && this.audio.meow();
  }

  meow() { this.audio && this.audio.meow(); }

  /** Идти к точке x; вернёт true когда дошёл. */
  goTo(targetX, threshold = 8) {
    const dx = targetX - this.x;
    if (Math.abs(dx) <= threshold) return true;
    this.dir = dx > 0 ? 1 : -1;
    return false;
  }

  update(dt, input) {
    this.t += dt;
    this.animTime += dt;
    dt = Math.min(dt, 0.05);

    // --- Управление с клавиатуры (ходьба/бег) ---
    let moving = false;
    let running = input && input.shift;
    const walkable = ["idle", "walk", "sneak", "hunt"].includes(this.action);

    if (input && walkable) {
      let dx = 0;
      if (input.left) dx -= 1;
      if (input.right) dx += 1;
      if (this.moveTarget != null) {
        const d = this.moveTarget - this.x;
        if (Math.abs(d) > 6) dx = d > 0 ? 1 : -1; else this.moveTarget = null;
      }
      if (dx !== 0) {
        moving = true;
        this.dir = dx > 0 ? 1 : -1;
        let base = this.action === "sneak" ? 70 : 150;
        if (running && this.action !== "sneak") base = 320;
        this.speed = base;
        this.x += dx * base * dt;
        this.x = Utils.clamp(this.x, this.bounds.left, this.bounds.right);
        // авто-переход в ходьбу из idle
        if (this.action === "idle") { this.action = "walk"; this.animTime = 0; }
      } else {
        this.speed = 0;
        if (this.action === "walk") { this.action = "idle"; this.animTime = 0; }
      }
    }
    this._running = moving && running && this.action !== "sneak";

    // --- Физика прыжка ---
    if (this.jumpProgress < 1) {
      this.jumpProgress += dt * 1.6;
      if (this.jumpProgress >= 1) { this.jumpProgress = 1; }
    }

    // --- Моргание ---
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0 && this.action !== "sleep") {
      this.blink = 1;
      this.blinkTimer = Utils.rand(2.5, 6);
    }
    if (this.blink > 0) this.blink = Math.max(0, this.blink - dt * 8);

    // --- Случайный взгляд ---
    this.lookTimer -= dt;
    if (this.lookTimer <= 0) {
      this.lookTarget = { x: Utils.rand(-1, 1), y: Utils.rand(-0.6, 0.6) };
      this.lookTimer = Utils.rand(1.2, 3);
    }

    // --- Фаза походки ---
    if (moving) {
      const spd = this._running ? 9 : (this.action === "sneak" ? 3 : 5.5);
      this.cycle += dt * spd;
    }

    this.weight = Utils.lerp(this.weight, this._targetWeight ?? this.weight, dt * 2);
    this._computePose(moving);
  }

  setWeight(w) { this._targetWeight = Utils.clamp(w, 0.7, 1.6); }

  _computePose(moving) {
    const p = this._neutralPose();
    const t = this.t;
    const a = this.action;
    p.fatness = this.weight;

    // Базовое дыхание
    p.bodyDY = Math.sin(t * 2) * 1.5;

    // Моргание / закрытие глаз
    p.eyeOpen = 1 - this.blink;
    p.pupilDX = this.lookTarget.x * 3;
    p.pupilDY = this.lookTarget.y * 2;

    // Хвост по умолчанию мягко покачивается
    p.tailWave = Math.sin(t * 1.8) * 0.18;

    // Уши изредка дёргаются
    const tw = Math.sin(t * 0.7);
    p.earTwitch = tw > 0.96 ? (tw - 0.96) * 6 : 0;

    if (moving) {
      const c = this.cycle * Math.PI * 2;
      const amp = this._running ? 1 : (a === "sneak" ? 0.55 : 0.8);
      p.gaitAmp = amp;
      p.gaitLift = this._running ? 1.25 : (a === "sneak" ? 0.5 : 0.85);
      p.bodyDY += Math.abs(Math.sin(c)) * (this._running ? -10 : -5);
      p.bodyTilt = Math.sin(c) * (this._running ? 0.05 : 0.02);
      p.tailWave = Math.sin(c) * 0.3 + 0.1;
      if (this._running) { p.stretch = 1.12; p.headDX = 6; p.earTwitch = -0.5; p.mouthOpen = 0.3; }
    }

    switch (a) {
      case "sleep": {
        p.eyeOpen = 0;
        p.headDY = 46;
        p.headDX = 14 * this.dir;
        p.headTilt = 0.25 * this.dir;
        p.bodyDY = 30 + Math.sin(t * 1.1) * 4;
        p.crouch = 1;
        p.tailWave = Math.sin(t * 0.9) * 0.12;
        p.whiskerDroop = 0.6;
        break;
      }
      case "sneak": {
        p.crouch = 1;
        p.bodyDY = 26;
        p.stretch = 1.18;
        p.headDY = 18;
        p.headDX = 10 * this.dir;
        p.eyeOpen = Math.min(p.eyeOpen, 0.55);
        p.browRaise = 0.4;
        p.tailLift = -0.3;
        p.tailWave = Math.sin(t * 2.2) * 0.1;
        break;
      }
      case "dance": {
        const d = t * 6;
        p.bodyDX = Math.sin(d) * 12;
        p.bodyDY = -Math.abs(Math.sin(d * 2)) * 12;
        p.bodyTilt = Math.sin(d) * 0.14;
        p.headDX = Math.sin(d + 0.5) * 8;
        p.headTilt = Math.sin(d) * 0.18;
        p.tailWave = Math.sin(d * 1.5) * 0.5;
        p.tailLift = 0.4;
        p.frontPawLift.near = Math.max(0, Math.sin(d)) * 26;
        p.frontPawLift.far = Math.max(0, Math.sin(d + Math.PI)) * 22;
        p.earTwitch = Math.sin(d * 2) * 0.3;
        p.eyeOpen = 0.85 + Math.sin(d) * 0.15;
        p.mouthOpen = 0.4;
        break;
      }
      case "eat": {
        const e = Math.sin(t * 7);
        p.headDY = (34 + e * 6);
        p.headDX = 16 * this.dir;
        p.headTilt = 0.18 * this.dir;
        p.mouthOpen = 0.5 + e * 0.5;
        p.eyeOpen = 0.6;
        break;
      }
      case "hunt": {
        p.crouch = 0.5;
        p.bodyDY = 12;
        p.headDX = 8 * this.dir;
        p.browRaise = 0.6;
        p.eyeOpen = 1;
        p.pupilDX *= 2; // глаза «бегают»
        // лёгкое подрагивание перед прыжком
        p.bodyDX = Math.sin(t * 20) * 1.2;
        p.tailWave = Math.sin(t * 4) * 0.25;
        break;
      }
      case "idle":
      default: {
        // лёгкое «дыхание» уже учтено
        if (Math.sin(t * 0.5) > 0.98) p.headTilt = 0.08 * this.dir;
        break;
      }
    }

    // Прыжок поверх всего
    if (this.jumpProgress < 1) {
      const jp = this.jumpProgress;
      const arc = Math.sin(Math.PI * jp);
      p.bodyDY -= arc * this.jumpHeight;
      // подбор лап в полёте, растяжка на взлёте/посадке
      const tuck = Math.sin(Math.PI * jp);
      p.gaitLift = 0; p.gaitAmp = 0;
      p.frontPawLift.near = tuck * 30;
      p.frontPawLift.far = tuck * 26;
      p.tailWave = -0.4 - arc * 0.3;
      p.stretch = 1 + arc * 0.08;
      p.eyeOpen = Math.max(p.eyeOpen, 0.9);
      p.mouthOpen = arc * 0.4;
      p.legTuck = tuck; // для задних лап
    }

    this.pose = p;
  }

  // ---------------------------------------------------------------------------
  //  ОТРИСОВКА
  // ---------------------------------------------------------------------------

  draw(ctx) {
    this._render(ctx, this.x, this.y, this.scale, this.dir, this.pose);
  }

  /** Статичный рендер (для превью кастомизации). */
  renderStatic(ctx, x, y, scale) {
    const pose = this._neutralPose();
    pose.headDY = -2; pose.eyeOpen = 1;
    this._render(ctx, x, y, scale, 1, pose);
  }

  _render(ctx, x, y, s, dir, pose) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);          // отзеркаливание по направлению
    ctx.scale(s, s);            // единый масштаб; все позы — в локальных единицах
    // Тень
    this._drawShadow(ctx, pose);
    // Сдвиг тела
    ctx.translate(pose.bodyDX, pose.bodyDY);
    ctx.rotate(pose.bodyTilt);

    const fat = pose.fatness;
    // Геометрия (в локальных единицах, ~пиксели при s=1)
    const G = {
      legLen: 78,
      bodyW: 168,
      bodyH: 86 * (0.92 + (fat - 1) * 0.45),
      hipX: -66,
      shX: 60,
    };
    G.bodyTop = -(G.legLen + G.bodyH * 0.55);

    const crouch = pose.crouch;
    G.legLen *= (1 - crouch * 0.42);
    G.bodyTop = -(G.legLen + G.bodyH * 0.55);

    // Растяжение тела (бег/прыжок)
    ctx.save();
    ctx.scale(pose.stretch, 1);

    // 1. Хвост (позади)
    this._drawTail(ctx, G, pose);
    // 2. Дальние лапы
    this._drawLeg(ctx, G, pose, "bf", true);
    this._drawLeg(ctx, G, pose, "ff", true);
    // 3. Тело
    this._drawBody(ctx, G, pose);
    // 4. Ближние лапы
    this._drawLeg(ctx, G, pose, "bn", false);
    this._drawLeg(ctx, G, pose, "fn", false);

    ctx.restore(); // отмена растяжения для головы

    // 5. Голова
    this._drawHead(ctx, G, pose, dir);

    ctx.restore();
  }

  _drawShadow(ctx, pose) {
    ctx.save();
    const squash = 1 - Math.max(0, (this.jumpProgress < 1 ? Math.sin(Math.PI * this.jumpProgress) : 0)) * 0.5;
    ctx.scale(1, 0.32);
    ctx.beginPath();
    ctx.ellipse(0, 6, 92 * squash, 78, 0, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(0, 6, 4, 0, 6, 92);
    g.addColorStop(0, "rgba(0,0,0,0.32)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  }

  // ----- Тело -----
  _drawBody(ctx, G, pose) {
    const fur = this.look.fur;
    const top = G.bodyTop;
    const bottom = -G.legLen + 6;
    const hipX = G.hipX, shX = G.shX;
    const bellySag = 6 + (pose.fatness - 1) * 22;

    ctx.save();
    ctx.beginPath();
    // Контур тела: круп -> спина -> загривок -> грудь -> живот -> круп
    ctx.moveTo(hipX - 30, bottom - 18);                       // низ крупа
    ctx.bezierCurveTo(hipX - 46, top + 30, hipX - 30, top, hipX, top - 2); // круп вверх
    ctx.bezierCurveTo(-10, top - 16, shX - 20, top - 18, shX + 6, top + 4); // спина -> загривок
    ctx.bezierCurveTo(shX + 34, top + 18, shX + 36, top + 46, shX + 28, top + 70); // грудь
    ctx.bezierCurveTo(shX + 20, bottom - 22, 10, bottom - 10 + bellySag, hipX + 20, bottom - 6 + bellySag); // живот
    ctx.bezierCurveTo(hipX, bottom - 4 + bellySag, hipX - 22, bottom - 10, hipX - 30, bottom - 18); // к крупу
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, top, 0, bottom);
    grad.addColorStop(0, Utils.shade(fur, 0.12));
    grad.addColorStop(0.6, fur);
    grad.addColorStop(1, Utils.shade(fur, -0.14));
    ctx.fillStyle = grad;
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 8;
    ctx.fill();
    ctx.shadowColor = "transparent";

    // Узор поверх тела (обрезаем по контуру)
    ctx.clip();
    this._drawPattern(ctx, G, top, bottom, hipX, shX, bellySag);
    ctx.restore();

    // Контурная линия для мягкости
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = Utils.withAlpha(Utils.shade(fur, -0.35), 0.5);
    ctx.stroke();
    ctx.restore();
  }

  _drawPattern(ctx, G, top, bottom, hipX, shX, bellySag) {
    const { pattern, belly, fur } = this.look;
    // Светлый живот/грудь почти всегда
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(shX + 24, top + 40);
    ctx.bezierCurveTo(shX + 30, bottom - 20, 0, bottom - 6 + bellySag, hipX + 6, bottom - 4 + bellySag);
    ctx.bezierCurveTo(hipX + 30, bottom - 30, shX - 10, top + 70, shX + 24, top + 40);
    ctx.closePath();
    ctx.fillStyle = belly;
    ctx.globalAlpha = 0.95;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    if (pattern === "tabby") {
      ctx.save();
      ctx.strokeStyle = Utils.withAlpha(Utils.shade(fur, -0.3), 0.55);
      ctx.lineWidth = 7;
      ctx.lineCap = "round";
      for (let i = 0; i < 6; i++) {
        const bx = hipX + i * 26;
        ctx.beginPath();
        ctx.moveTo(bx, top + 2);
        ctx.quadraticCurveTo(bx - 14, (top + bottom) / 2, bx - 6, bottom - 12);
        ctx.stroke();
      }
      ctx.restore();
    } else if (pattern === "patches") {
      ctx.save();
      ctx.fillStyle = Utils.shade(fur, -0.05);
      this._blob(ctx, hipX + 6, top + 24, 34, 26);
      this._blob(ctx, shX - 6, top + 16, 30, 24);
      ctx.fillStyle = belly;
      ctx.globalAlpha = 0.9;
      this._blob(ctx, hipX + 40, top + 40, 26, 22);
      ctx.globalAlpha = 1;
      ctx.restore();
    } else if (pattern === "tuxedo") {
      ctx.save();
      ctx.fillStyle = belly;
      ctx.beginPath();
      ctx.moveTo(shX + 28, top + 30);
      ctx.bezierCurveTo(shX + 36, bottom, hipX + 20, bottom - 4 + bellySag, hipX, bottom + bellySag);
      ctx.lineTo(shX + 10, bottom);
      ctx.bezierCurveTo(shX + 18, top + 60, shX + 24, top + 44, shX + 28, top + 30);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  _blob(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, Utils.rand(-0.3, 0.3) * 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ----- Лапы (тейпер-полигон + подушечки) -----
  _drawLeg(ctx, G, pose, id, far) {
    const fur = far ? Utils.shade(this.look.fur, -0.16) : this.look.fur;
    const isFront = id[0] === "f";
    const hipX = isFront ? G.shX - 6 : G.hipX + 6;
    // крепление поднято внутрь тела, чтобы верх лапы прятался в силуэт (нет зазора)
    const hipY = G.bodyTop + (isFront ? 42 : 36);
    const sideOff = far ? -10 : 10;

    // Фаза походки
    const phase = pose.legPhase[id];
    const c = (this.cycle + phase) * Math.PI * 2;
    let footX = hipX + (isFront ? 14 : -10) + sideOff * 0.4;
    let footY = -2;
    let lift = 0;

    if (pose.gaitAmp > 0) {
      const swing = Math.sin(c);
      footX += swing * 26 * pose.gaitAmp;
      const up = Math.max(0, Math.sin(c)); // подъём в фазе переноса
      lift = up * 26 * pose.gaitLift;
      footY -= lift;
    }

    // Подбор лап в прыжке
    if (pose.legTuck) {
      footY -= pose.legTuck * (isFront ? 34 : 40);
      footX += (isFront ? -10 : 8) * pose.legTuck;
    }
    // Приседание (крадётся/сон) — лапы шире и ниже согнуты
    const crouch = pose.crouch;

    // Подъём передней лапы (танец)
    if (isFront && pose.frontPawLift) {
      const fl = far ? pose.frontPawLift.far : pose.frontPawLift.near;
      footY -= fl;
      footX += fl * 0.3;
    }

    // Колено (контрольная точка) — фейковый изгиб
    const midX = (hipX + footX) / 2 + (isFront ? 10 : -12) - crouch * (isFront ? -18 : 18);
    const midY = (hipY + footY) / 2 + 6 + crouch * 10;

    const wTop = 26, wMid = 16, wBot = 12;

    ctx.save();
    ctx.translate(sideOff, 0);
    // «бедро/плечо» — мягкий объём в месте крепления, сглаживает переход к телу
    ctx.beginPath();
    ctx.ellipse(hipX, hipY + 6, isFront ? 24 : 28, isFront ? 30 : 34, 0, 0, Math.PI * 2);
    ctx.fillStyle = Utils.shade(fur, far ? -0.16 : 0.02);
    ctx.fill();
    this._taperLimb(ctx, hipX, hipY, midX, midY, footX, footY, wTop, wMid, wBot, fur);
    // Лапка с пальчиками и подушечками
    this._drawPaw(ctx, footX, footY, far, isFront, lift > 8 || (pose.legTuck > 0.2));
    ctx.restore();
  }

  _taperLimb(ctx, hx, hy, mx, my, fx, fy, wTop, wMid, wBot, color) {
    // перпендикуляры
    const perp = (ax, ay, bx, by, w) => {
      const dx = bx - ax, dy = by - ay;
      const len = Math.hypot(dx, dy) || 1;
      return { x: -dy / len * w / 2, y: dx / len * w / 2 };
    };
    const p1 = perp(hx, hy, mx, my, wTop);
    const p2 = perp(hx, hy, fx, fy, wMid);
    const p3 = perp(mx, my, fx, fy, wBot);

    ctx.beginPath();
    ctx.moveTo(hx + p1.x, hy + p1.y);
    ctx.quadraticCurveTo(mx + p2.x, my + p2.y, fx + p3.x, fy + p3.y);
    ctx.lineTo(fx - p3.x, fy - p3.y);
    ctx.quadraticCurveTo(mx - p2.x, my - p2.y, hx - p1.x, hy - p1.y);
    ctx.closePath();
    const g = ctx.createLinearGradient(hx, hy, fx, fy);
    g.addColorStop(0, Utils.shade(color, 0.05));
    g.addColorStop(1, Utils.shade(color, -0.1));
    ctx.fillStyle = g;
    ctx.fill();
  }

  _drawPaw(ctx, x, y, far, isFront, showPads) {
    const fur = far ? Utils.shade(this.look.fur, -0.16) : this.look.fur;
    const toe = Utils.shade(this.look.belly, -0.02);
    ctx.save();
    // основание лапки
    ctx.beginPath();
    ctx.ellipse(x, y - 2, 16, 13, 0, 0, Math.PI * 2);
    ctx.fillStyle = Utils.shade(fur, 0.04);
    ctx.fill();
    // пальчики (3 разделителя сверху)
    ctx.strokeStyle = Utils.withAlpha(Utils.shade(fur, -0.3), 0.5);
    ctx.lineWidth = 1.6;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * 6, y - 12);
      ctx.lineTo(x + i * 6, y - 2);
      ctx.stroke();
    }
    // подушечки (если лапка приподнята — видно с нижней стороны)
    if (showPads) {
      ctx.fillStyle = toe;
      // большая метакарпальная подушечка
      ctx.beginPath();
      ctx.ellipse(x, y + 4, 7, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      // пальцевые бобы
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.ellipse(x + i * 6, y - 4, 3.2, 3.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // ----- Хвост -----
  _drawTail(ctx, G, pose) {
    const fur = this.look.fur;
    // основание заведено внутрь крупа — тело (рисуется поверх) прячет корень,
    // и хвост естественно «вырастает» из тела без зазора
    const baseX = G.hipX + 12;
    const baseY = G.bodyTop + 46;
    const wave = pose.tailWave;
    const lift = pose.tailLift;

    // Кривая хвоста (S-образная), толщина уменьшается
    const segs = 12;
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const tt = i / segs;
      const ang = Math.PI * (0.95 + lift * 0.4) + Math.sin(tt * 3 + this.t * 2) * wave * (0.6 + tt);
      const len = 16;
      const prev = pts[i - 1] || { x: baseX, y: baseY };
      pts.push({ x: prev.x + Math.cos(ang) * len * (1 - tt * 0.1), y: prev.y - Math.sin(ang) * len });
    }
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // утолщённый корень для слитности с телом
    ctx.beginPath();
    ctx.ellipse(baseX, baseY, 18, 22, 0, 0, Math.PI * 2);
    ctx.fillStyle = Utils.shade(fur, -0.04);
    ctx.fill();
    for (let i = 0; i < pts.length - 1; i++) {
      const w = Utils.lerp(26, 7, i / segs);
      ctx.beginPath();
      ctx.moveTo(pts[i].x, pts[i].y);
      ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
      ctx.strokeStyle = Utils.shade(fur, -0.08 + (i / segs) * 0.12);
      ctx.lineWidth = w;
      ctx.stroke();
    }
    // светлый кончик
    const tip = pts[pts.length - 1];
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = this.look.belly;
    ctx.fill();
    ctx.restore();
  }

  // ----- Голова (3/4, к зрителю) -----
  _drawHead(ctx, G, pose, dir) {
    const fur = this.look.fur;
    const hx = G.shX + 30 + pose.headDX / 1;
    const hy = G.bodyTop + 6 + pose.headDY / 1;
    const R = 56;

    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(pose.headTilt);
    // компенсируем зеркало тела, чтобы лицо всегда было «к нам»
    ctx.scale(dir, 1);

    // Уши (позади головы)
    this._drawEar(ctx, -R * 0.62, -R * 0.66, -1, pose);
    this._drawEar(ctx, R * 0.62, -R * 0.66, 1, pose);

    // Контур головы: щёки-меховые, мордочка
    ctx.beginPath();
    ctx.moveTo(0, -R);
    ctx.bezierCurveTo(R * 0.95, -R * 0.95, R * 1.12, R * 0.2, R * 0.66, R * 0.7); // правая щека
    ctx.bezierCurveTo(R * 0.42, R * 1.0, -R * 0.42, R * 1.0, -R * 0.66, R * 0.7); // подбородок
    ctx.bezierCurveTo(-R * 1.12, R * 0.2, -R * 0.95, -R * 0.95, 0, -R);           // левая щека
    ctx.closePath();
    const hg = ctx.createRadialGradient(0, -R * 0.3, 6, 0, 0, R * 1.3);
    hg.addColorStop(0, Utils.shade(fur, 0.16));
    hg.addColorStop(0.7, fur);
    hg.addColorStop(1, Utils.shade(fur, -0.12));
    ctx.fillStyle = hg;
    ctx.shadowColor = "rgba(0,0,0,0.22)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 5;
    ctx.fill();
    ctx.shadowColor = "transparent";

    // меховые щёчные кисточки
    ctx.save();
    ctx.strokeStyle = Utils.shade(fur, -0.1);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    for (const sgn of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        const ey = R * 0.35 + i * 9;
        ctx.moveTo(sgn * R * 0.7, ey);
        ctx.lineTo(sgn * (R * 0.95 + i * 4), ey + 4);
        ctx.stroke();
      }
    }
    ctx.restore();

    // Светлая мордочка/маска вокруг носа
    ctx.beginPath();
    ctx.ellipse(0, R * 0.34, R * 0.5, R * 0.42, 0, 0, Math.PI * 2);
    ctx.fillStyle = Utils.withAlpha(this.look.belly, 0.92);
    ctx.fill();

    // Глаза
    const eyeY = -R * 0.06;
    const eyeX = R * 0.42;
    this._drawEye(ctx, -eyeX, eyeY, pose, R);
    this._drawEye(ctx, eyeX, eyeY, pose, R);

    // Брови (еле заметные)
    if (pose.eyeOpen > 0.2) {
      ctx.save();
      ctx.strokeStyle = Utils.withAlpha(Utils.shade(fur, -0.3), 0.45);
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      const br = pose.browRaise * 6;
      for (const sgn of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sgn * eyeX - 12, eyeY - R * 0.34 - br);
        ctx.quadraticCurveTo(sgn * eyeX, eyeY - R * 0.42 - br, sgn * eyeX + 12, eyeY - R * 0.36 - br);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Нос + рот
    this._drawNoseMouth(ctx, R, pose);

    // Усы (по 6 с каждой стороны)
    this._drawWhiskers(ctx, R, pose);

    ctx.restore();
  }

  _drawEar(ctx, x, y, sgn, pose) {
    const fur = this.look.fur;
    const inner = Utils.shade(this.look.belly, -0.04);
    const tw = pose.earTwitch * sgn;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(sgn * (0.15 + tw));
    // внешнее ухо
    ctx.beginPath();
    ctx.moveTo(0, 26);
    ctx.quadraticCurveTo(sgn * -10, -30, sgn * 18, -40);
    ctx.quadraticCurveTo(sgn * 30, -16, sgn * 30, 18);
    ctx.quadraticCurveTo(sgn * 16, 28, 0, 26);
    ctx.closePath();
    ctx.fillStyle = Utils.shade(fur, -0.04);
    ctx.fill();
    ctx.strokeStyle = Utils.withAlpha(Utils.shade(fur, -0.3), 0.4);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // ушная раковина (внутреннее ухо)
    ctx.beginPath();
    ctx.moveTo(sgn * 2, 16);
    ctx.quadraticCurveTo(sgn * -2, -16, sgn * 15, -26);
    ctx.quadraticCurveTo(sgn * 20, -8, sgn * 19, 12);
    ctx.quadraticCurveTo(sgn * 12, 18, sgn * 2, 16);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -26, 0, 18);
    g.addColorStop(0, Utils.shade("#ff9bb0", 0.1));
    g.addColorStop(1, inner);
    ctx.fillStyle = g;
    ctx.fill();
    // пучок шерсти в ухе
    ctx.strokeStyle = Utils.withAlpha("#ffffff", 0.6);
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(sgn * (10 + i * 4), 12);
      ctx.lineTo(sgn * (12 + i * 4), -6);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawEye(ctx, x, y, pose, R) {
    const open = pose.eyeOpen;
    const eyeColor = this.look.eye;
    const w = 20, h = 17 * open;

    ctx.save();
    ctx.translate(x, y);

    // глазница (мягкая тень)
    ctx.beginPath();
    ctx.ellipse(0, 0, w + 2, 14, 0, 0, Math.PI * 2);
    ctx.fillStyle = Utils.withAlpha("#000000", 0.08);
    ctx.fill();

    if (open > 0.08) {
      // миндалевидная форма глаза (клип)
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-w, 1);
      ctx.quadraticCurveTo(0, -h - 3, w, 1);
      ctx.quadraticCurveTo(0, h + 3, -w, 1);
      ctx.closePath();
      ctx.clip();

      // белок
      ctx.fillStyle = "#fbfcff";
      ctx.fillRect(-w, -h - 4, w * 2, h * 2 + 8);

      // радужка
      const ix = Utils.clamp(pose.pupilDX, -6, 6);
      const iy = Utils.clamp(pose.pupilDY, -4, 4);
      const ir = 11;
      const ig = ctx.createRadialGradient(ix - 2, iy - 2, 1, ix, iy, ir);
      ig.addColorStop(0, Utils.shade(eyeColor, 0.35));
      ig.addColorStop(0.6, eyeColor);
      ig.addColorStop(1, Utils.shade(eyeColor, -0.35));
      ctx.beginPath();
      ctx.arc(ix, iy, ir, 0, Math.PI * 2);
      ctx.fillStyle = ig;
      ctx.fill();
      // лимбальное кольцо
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = Utils.withAlpha(Utils.shade(eyeColor, -0.5), 0.6);
      ctx.stroke();

      // вертикальный кошачий зрачок (сужается при ярком/возбуждении)
      const dilate = pose.browRaise > 0.4 ? 1.6 : 1;
      ctx.beginPath();
      ctx.ellipse(ix, iy, 3.4 * dilate, 9.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#0a0a12";
      ctx.fill();

      // блик
      ctx.beginPath();
      ctx.arc(ix - 3.5, iy - 4, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ix + 3, iy + 3, 1.3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fill();

      ctx.restore();
    }

    // контур глаза (миндалевидный) — верхнее и нижнее веко
    if (open > 0.08) {
      ctx.beginPath();
      ctx.moveTo(-w - 1, 1);
      ctx.quadraticCurveTo(0, -h - 3, w + 1, 1);
      ctx.quadraticCurveTo(0, h + 3, -w - 1, 1);
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = Utils.shade(this.look.fur, -0.42);
      ctx.lineJoin = "round";
      ctx.stroke();
    }

    // линия закрытого глаза
    if (open <= 0.5) {
      ctx.beginPath();
      const lid = 1 - open;
      ctx.moveTo(-w, 1 - 0);
      ctx.quadraticCurveTo(0, 1 + 6 * lid, w, 1);
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = Utils.shade(this.look.fur, -0.45);
      ctx.lineCap = "round";
      ctx.stroke();
      // короткие реснички
      if (open < 0.15) {
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(i * 7, 1 + 2 * lid);
          ctx.lineTo(i * 7 + 1, 1 + 7 * lid);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  _drawNoseMouth(ctx, R, pose) {
    const ny = R * 0.28;
    // нос (сердечком)
    ctx.beginPath();
    ctx.moveTo(0, ny + 8);
    ctx.bezierCurveTo(-9, ny - 2, -8, ny - 8, 0, ny - 2);
    ctx.bezierCurveTo(8, ny - 8, 9, ny - 2, 0, ny + 8);
    ctx.closePath();
    const ng = ctx.createLinearGradient(0, ny - 8, 0, ny + 8);
    ng.addColorStop(0, "#ff9bb0");
    ng.addColorStop(1, "#e2607f");
    ctx.fillStyle = ng;
    ctx.fill();
    // блик на носу
    ctx.beginPath();
    ctx.ellipse(-3, ny - 2, 2.2, 1.4, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fill();

    // рот (две дуги) + язык/рот при открытии
    const mo = pose.mouthOpen;
    ctx.strokeStyle = Utils.shade(this.look.fur, -0.5);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, ny + 8);
    ctx.lineTo(0, ny + 14);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, ny + 14);
    ctx.quadraticCurveTo(-9, ny + 20 + mo * 6, -16, ny + 14 + mo * 10);
    ctx.moveTo(0, ny + 14);
    ctx.quadraticCurveTo(9, ny + 20 + mo * 6, 16, ny + 14 + mo * 10);
    ctx.stroke();
    if (mo > 0.2) {
      ctx.beginPath();
      ctx.ellipse(0, ny + 20 + mo * 8, 7 * mo + 3, 6 * mo + 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#b3445e";
      ctx.fill();
      // язычок
      ctx.beginPath();
      ctx.ellipse(0, ny + 22 + mo * 9, 4 * mo + 1.5, 3 * mo + 1, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#ff8aa3";
      ctx.fill();
    }
  }

  _drawWhiskers(ctx, R, pose) {
    const droop = pose.whiskerDroop;
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    const baseY = R * 0.3;
    for (const sgn of [-1, 1]) {
      const ox = sgn * R * 0.28;
      for (let i = 0; i < 6; i++) {              // по 6 усов с каждой стороны
        const row = i % 3;
        const spread = (row - 1) * 7;
        const y0 = baseY + spread * 0.4;
        const len = 56 - row * 4;
        const droopY = (12 + row * 6) * droop + row * 4;
        const sway = Math.sin(this.t * 2 + i) * 1.5;
        ctx.beginPath();
        ctx.moveTo(ox, y0);
        ctx.quadraticCurveTo(
          ox + sgn * len * 0.6, y0 + spread * 0.5 + droopY * 0.5 + sway,
          ox + sgn * len, y0 + spread + droopY + sway
        );
        // лёгкая тень для глубины
        ctx.strokeStyle = i < 3 ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.5)";
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}
