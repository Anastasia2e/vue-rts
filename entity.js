export class Entity {
  constructor({
    x = 0, y = 0,
    speed = 2,
    color = '#4a90e2',
    radius = 4,
    selectedRadius = 7,
    name = '',
    type = 'dot',
  } = {}) {
    this.id = Entity.nextId++;
    this.type = type;
    this.name = name;

    this.x = x;
    this.y = y;

    // Очередь целей: [{x, y}, ...]. Пусто = стоит.
    this.path = [];

    this.speed = speed;

    this.color = color;
    this.radius = radius;
    this.selectedRadius = selectedRadius;

    this.selected = false;
  }

  /** Есть ли активный приказ */
  get isMoving() {
    return this.path.length > 0;
  }

  /** Текущая цель (первая в очереди) */
  get target() {
    return this.path[0] || null;
  }

  /** Заменить весь путь одной точкой */
  moveTo(wx, wy) {
    this.path = [{ x: wx, y: wy }];
  }

  /** Добавить точку в конец очереди */
  addWaypoint(wx, wy) {
    this.path.push({ x: wx, y: wy });
  }

  /** Полная остановка */
  stop() {
    this.path.length = 0;
  }

  update(dt) {
    if (this.path.length === 0) return;

    const t = this.path[0];
    const dx = t.x - this.x;
    const dy = t.y - this.y;
    const dist = Math.hypot(dx, dy);

    // Дошли до текущей цели — переключаемся на следующую
    if (dist < 0.02) {
      this.x = t.x;
      this.y = t.y;
      this.path.shift();
      return;
    }

    const step = this.speed * dt;
    if (step >= dist) {
      this.x = t.x;
      this.y = t.y;
      this.path.shift();
    } else {
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
    }
  }
}
Entity.nextId = 1;