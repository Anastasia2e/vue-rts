<template>
  <div class="game-wrap" ref="wrap">
    <canvas ref="canvas"></canvas>

    <div class="hud-top">
      <div class="panel">
        <b>Управление</b><br>
        ЛКМ — выделить точку / рамкой<br>
        Shift+ЛКМ — добавить к выделению<br>
        ПКМ — приказ идти в точку<br>
        Shift+ПКМ — добавить точку в очередь пути<br>
        S — стоп выделенным<br>
        Esc — снять выделение<br>
        СКМ или Space+ЛКМ — панорама<br>
        Колесо — зум
      </div>
    </div>

    <div class="hud-bottom">
      <div class="panel selection">
        <div v-if="selection.length === 0">Ничего не выбрано</div>
        <div v-else>
          <b>Выбрано: {{ selection.length }}</b>
          <ul>
            <li v-for="s in selection" :key="s.id">
              <span class="dot" :style="{ background: s.color }"></span>
              <span class="name">{{ s.name }}</span>
              <span class="meta">spd {{ s.speed.toFixed(2) }}</span>
              <span v-if="s.queue > 0" class="moving">
                → идёт ({{ s.queue }})
              </span>
              <span v-else class="idle">стоп</span>
            </li>
          </ul>
        </div>
      </div>
      <div class="panel">FPS: {{ fps }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { GameEngine } from '../engine.js';

const wrap = ref(null);
const canvas = ref(null);
const selection = ref([]);
const fps = ref(0);

let engine = null;
let statTimer = null;
let frames = 0;
let lastFpsT = 0;

onMounted(() => {
  engine = new GameEngine(canvas.value);

  const origLoop = engine._loop.bind(engine);
  engine._loop = (t) => { frames++; origLoop(t); };

  engine.start();

  lastFpsT = performance.now();
  statTimer = setInterval(() => {
    selection.value = [...engine.selected].map(e => ({
      id: e.id,
      name: e.name,
      color: e.color,
      speed: e.speed,
      queue: e.path.length,
    }));
    const now = performance.now();
    fps.value = Math.round(frames * 1000 / (now - lastFpsT));
    frames = 0;
    lastFpsT = now;
  }, 250);
});

onBeforeUnmount(() => {
  clearInterval(statTimer);
  if (engine) engine.stop();
});
</script>

<style scoped>
.game-wrap {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #111;
}
canvas { display: block; cursor: crosshair; }

.panel {
  background: rgba(0,0,0,0.6);
  border: 1px solid rgba(255,255,255,0.1);
  padding: 8px 10px;
  border-radius: 6px;
  color: #e6e6e6;
  font: 12px/1.5 system-ui, sans-serif;
  pointer-events: none;
  user-select: none;
}
.hud-top { position: absolute; top: 12px; left: 12px; }
.hud-bottom {
  position: absolute; bottom: 12px; left: 12px; right: 12px;
  display: flex; justify-content: space-between; align-items: flex-end;
  gap: 12px;
}
.selection { min-width: 260px; max-width: 420px; }
.selection ul {
  list-style: none; margin: 6px 0 0 0; padding: 0;
  max-height: 30vh; overflow: auto;
}
.selection li {
  display: flex; align-items: center; gap: 6px;
  padding: 2px 0;
}
.dot {
  width: 10px; height: 10px; border-radius: 50%;
  display: inline-block; flex: 0 0 auto;
}
.name { flex: 1 1 auto; }
.meta { color: #aaa; }
.moving { color: #6ee7ff; }
.idle { color: #888; }
</style>