import { Entity } from './entity.js';
import { worldToScreen, screenToWorld } from './iso.js';

export class GameEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = window.devicePixelRatio || 1;

    this.camera = { x: 0, y: 0, zoom: 1 };

    this.entities = [];
    this.selected = new Set();

    this.dragBox = null;
    this.mouse = { x: 0, y: 0 };
    this.panning = false;
    this.panStart = null;
    this.keys = new Set();

    this.lastTime = performance.now();
    this.running = true;

    this._resize = this._resize.bind(this);
    this._loop = this._loop.bind(this);
    window.addEventListener('resize', this._resize);
    this._resize();
  }

  spawnDemo() {
    const palette = ['#4a90e2', '#e2b04a', '#7ed321', '#e24a8a', '#9b6ee2'];
    const N = 12;
    for (let i = 0; i < N; i++) {
      this.entities.push(new Entity({
        x: (Math.random() - 0.5) * 20,
        y: (Math.random() - 0.5) * 20,
        speed: 1 + Math.random() * 3,
        color: palette[i % palette.length],
        radius: 4,
        selectedRadius: 7,
        name: `Dot ${i}`,
      }));
    }
  }

  _resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width * this.dpr;
    this.canvas.height = rect.height * this.dpr;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.viewW = rect.width;
    this.viewH = rect.height;
  }

  worldToView(wx, wy) {
    const camScreen = worldToScreen(this.camera.x, this.camera.y);
    const s = worldToScreen(wx, wy);
    return {
      x: (s.x - camScreen.x) * this.camera.zoom + this.viewW / 2,
      y: (s.y - camScreen.y) * this.camera.zoom + this.viewH / 2,
    };
  }

  viewToWorld(vx, vy) {
    const camScreen = worldToScreen(this.camera.x, this.camera.y);
    const sx = (vx - this.viewW / 2) / this.camera.zoom + camScreen.x;
    const sy = (vy - this.viewH / 2) / this.camera.zoom + camScreen.y;
    return screenToWorld(sx, sy);
  }

  // ---------- Ввод ----------
  attachInput() {
    const c = this.canvas;

    c.addEventListener('mousedown', (e) => {
      const rect = c.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // панорама
      if (e.button === 1 || (e.button === 0 && this.keys.has('Space'))) {
        this.panning = true;
        this.panStart = { mx, my, camX: this.camera.x, camY: this.camera.y };
        e.preventDefault();
        return;
      }

      if (e.button === 0) {
        this.dragBox = { x1: mx, y1: my, x2: mx, y2: my };
        return;
      }

      if (e.button === 2) {
        e.preventDefault();
        this._issueOrder(mx, my, this.keys.has('Shift'));
      }
    });

    window.addEventListener('mousemove', (e) => {
      const rect = c.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      this.mouse = { x: mx, y: my };

      if (this.panning && this.panStart) {
        const dx = mx - this.panStart.mx;
        const dy = my - this.panStart.my;
        const camStart = worldToScreen(this.panStart.camX, this.panStart.camY);
        const targetScreen = {
          x: camStart.x - dx / this.camera.zoom,
          y: camStart.y - dy / this.camera.zoom,
        };
        const w = screenToWorld(targetScreen.x, targetScreen.y);
        this.camera.x = w.x;
        this.camera.y = w.y;
      }

      if (this.dragBox) {
        this.dragBox.x2 = mx;
        this.dragBox.y2 = my;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 1) this.panning = false;
      if (e.button === 0 && this.dragBox) {
        this._finishSelection();
        this.dragBox = null;
      }
    });

    c.addEventListener('contextmenu', (e) => e.preventDefault());

    c.addEventListener('wheel', (e) => {
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      this.camera.zoom = Math.max(0.25, Math.min(3, this.camera.zoom * factor));
      e.preventDefault();
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space') e.preventDefault();

      if (e.code === 'Escape') {
        this.selected.forEach(s => s.selected = false);
        this.selected.clear();
      }
      if (e.code === 'KeyS' && !e.ctrlKey && !e.metaKey) {
        this.selected.forEach(s => s.stop());
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
  }

  // ---------- Приказ идти ----------
  _issueOrder(screenX, screenY, additive) {
    if (this.selected.size === 0) return;

    const w = this.viewToWorld(screenX, screenY);
    const list = [...this.selected];

    if (list.length === 1) {
      // Одной точке — точно в точку клика
      const ent = list[0];
      if (additive) ent.addWaypoint(w.x, w.y);
      else ent.moveTo(w.x, w.y);
    } else {
      // Нескольким — своя цель каждой, вокруг точки клика.
      // Радиус зависит от количества: чем больше точек, тем шире круг.
      const R = 0.8 + Math.sqrt(list.length) * 0.5;
      list.forEach((ent, i) => {
        const a = (i / list.length) * Math.PI * 2;
        const tx = w.x + Math.cos(a) * R;
        const ty = w.y + Math.sin(a) * R;
        if (additive) ent.addWaypoint(tx, ty);
        else ent.moveTo(tx, ty);
      });
    }

    // Пинг: если additive — другой цвет
    this._orderPing = { x: w.x, y: w.y, t: 0.6, additive };
  }

  _finishSelection() {
    const { x1, y1, x2, y2 } = this.dragBox;
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    const isClick = (maxX - minX) < 4 && (maxY - minY) < 4;

    if (!this.keys.has('Shift')) {
      this.selected.forEach(e => e.selected = false);
      this.selected.clear();
    }

    if (isClick) {
      let hit = null, bestDist = Infinity;
      for (const ent of this.entities) {
        const p = this.worldToView(ent.x, ent.y);
        const d = Math.hypot(p.x - x1, p.y - y1);
        const clickR = Math.max(10, ent.selectedRadius * this.camera.zoom * 2);
        if (d < clickR && d < bestDist) { bestDist = d; hit = ent; }
      }
      if (hit) {
        hit.selected = true;
        this.selected.add(hit);
      }
    } else {
      for (const ent of this.entities) {
        const p = this.worldToView(ent.x, ent.y);
        if (p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY) {
          ent.selected = true;
          this.selected.add(ent);
        }
      }
    }
  }

  _update(dt) {
    for (const ent of this.entities) ent.update(dt);
    if (this._orderPing) {
      this._orderPing.t -= dt;
      if (this._orderPing.t <= 0) this._orderPing = null;
    }
  }

  _draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.viewW, this.viewH);

    ctx.fillStyle = '#151a12';
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    this._drawGrid();

    const sorted = [...this.entities].sort((a, b) => (a.x + a.y) - (b.x + b.y));
    for (const ent of sorted) this._drawEntity(ent);

    if (this._orderPing) this._drawOrderPing();
    if (this.dragBox) this._drawDragBox();
  }

  _drawGrid() {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;

    const tl = this.viewToWorld(0, 0);
    const tr = this.viewToWorld(this.viewW, 0);
    const bl = this.viewToWorld(0, this.viewH);
    const br = this.viewToWorld(this.viewW, this.viewH);
    const minX = Math.floor(Math.min(tl.x, tr.x, bl.x, br.x)) - 2;
    const maxX = Math.ceil(Math.max(tl.x, tr.x, bl.x, br.x)) + 2;
    const minY = Math.floor(Math.min(tl.y, tr.y, bl.y, br.y)) - 2;
    const maxY = Math.ceil(Math.max(tl.y, tr.y, bl.y, br.y)) + 2;

    for (let x = minX; x <= maxX; x++) {
      const a = this.worldToView(x, minY);
      const b = this.worldToView(x, maxY);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    for (let y = minY; y <= maxY; y++) {
      const a = this.worldToView(minX, y);
      const b = this.worldToView(maxX, y);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }

  _drawEntity(ent) {
    const ctx = this.ctx;
    const p = this.worldToView(ent.x, ent.y);
    const r = Math.max(2, ent.radius * this.camera.zoom);

    // Путь: линия через все waypoint'ы
    if (ent.path.length > 0) {
      ctx.strokeStyle = 'rgba(110,231,255,0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      for (const wp of ent.path) {
        const q = this.worldToView(wp.x, wp.y);
        ctx.lineTo(q.x, q.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Маркеры каждой точки очереди
      const cr = Math.max(3, 3 * this.camera.zoom);
      ent.path.forEach((wp, idx) => {
        const q = this.worldToView(wp.x, wp.y);
        const isFinal = idx === ent.path.length - 1;
        ctx.strokeStyle = isFinal
          ? 'rgba(110,231,255,0.95)'
          : 'rgba(110,231,255,0.5)';
        ctx.lineWidth = isFinal ? 1.8 : 1;
        ctx.beginPath();
        ctx.arc(q.x, q.y, isFinal ? cr * 1.4 : cr, 0, Math.PI * 2);
        ctx.stroke();
      });
    }

    // тень
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + r * 0.6, r * 1.2, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    // точка
    ctx.fillStyle = ent.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#0a0a0a';
    ctx.stroke();

    // выделение
    if (ent.selected) {
      ctx.strokeStyle = '#6ee7ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 4 * this.camera.zoom, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  _drawOrderPing() {
    const { x, y, t, additive } = this._orderPing;
    const p = this.worldToView(x, y);
    const k = 1 - t / 0.6;
    const r = (6 + 24 * k) * this.camera.zoom;
    const ctx = this.ctx;
    // Зелёный пинг для Shift-очереди, голубой — для обычного приказа
    const base = additive ? '110,231,140' : '110,231,255';
    ctx.strokeStyle = `rgba(${base},${1 - k})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  _drawDragBox() {
    const { x1, y1, x2, y2 } = this.dragBox;
    const x = Math.min(x1, x2), y = Math.min(y1, y2);
    const w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
    if (w < 3 && h < 3) return;
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(110,231,255,0.12)';
    ctx.strokeStyle = 'rgba(110,231,255,0.9)';
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
  }

  _loop(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this._update(dt);
    this._draw();
    requestAnimationFrame(this._loop);
  }

  start() {
    this.attachInput();
    this.spawnDemo();
    requestAnimationFrame(this._loop);
  }

  stop() { this.running = false; }
}