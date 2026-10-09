import { lastPointer } from './interactionClock';

/** The eyes keep following a still pointer this long, then drift back over the fade. */
const LOOK_HOLD_MS = 3000;
const LOOK_FADE_MS = 1500;
const MEASURE_EVERY_MS = 400;

const clock = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

export interface GazeTarget {
  setLook(x: number, y: number): void;
}

/**
 * Turns the last pointer position into a gaze direction for one character. Direction
 * is preserved and the magnitude saturates with distance, so a cursor across the page
 * reads as "looking over there" without the eyes pinning to the edge.
 */
export class RendaGaze {
  private cx = 0;
  private cy = 0;
  private h = 1;
  private measuredAt = -Infinity;

  constructor(private readonly el: Element) {}

  update(target: GazeTarget): void {
    const now = clock();
    const p = lastPointer();
    const age = now - p.at;
    if (age > LOOK_HOLD_MS + LOOK_FADE_MS) {
      target.setLook(0, 0);
      return;
    }
    if (now - this.measuredAt > MEASURE_EVERY_MS) this.measure(now);
    const dx = p.x - this.cx;
    const dy = p.y - this.cy;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) {
      target.setLook(0, 0);
      return;
    }
    const fade = age < LOOK_HOLD_MS ? 1 : 1 - (age - LOOK_HOLD_MS) / LOOK_FADE_MS;
    const k = (dist / (dist + Math.max(130, this.h * 2))) * fade;
    target.setLook((dx / dist) * k, (dy / dist) * k);
  }

  private measure(now: number): void {
    const r = this.el.getBoundingClientRect();
    this.cx = r.left + r.width / 2;
    this.cy = r.top + r.height / 2;
    this.h = r.height || 1;
    this.measuredAt = now;
  }
}
