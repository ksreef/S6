// Creeping decay layer: hairline cracks and claw scratches appear on the
// backdrop as more upgrades are bought. Cracks can be clicked (within a
// small radius) to seal them for pings, and if cracks ever cover half the
// screen the layer fires its doom callback. Presentation only; holds no
// game state, so it can be driven from a single total-levels number.

const MAX_CRACKS = 16;
const MAX_SCRATCHES = 24;
const CRACK_LEVELS_PER_CRACK = 2;
const SCRATCH_LEVELS_PER_SCRATCH = 0.5;
/** Width of the clickable band around every crack, in pixels. */
const HIT_BAND_WIDTH = 48;
/** Clicks this close to a crack (or closer) can seal it. */
const REPAIR_RADIUS = 40;
/** Fraction of the screen covered by cracks that triggers the doom. */
const DOOM_COVERAGE = 0.5;

interface Point {
  x: number;
  y: number;
}

interface CrackData {
  points: Point[];
  group: SVGGElement;
}

export class CorruptionLayer {
  /** Fired once when cracks cover half the screen. */
  onDoom: (() => void) | null = null;
  /** Fired with the click position whenever a crack band is clicked. */
  onRepairRequest: ((point: Point) => void) | null = null;

  private svg: SVGSVGElement;
  private cracksGroup: SVGGElement;
  private scratchesGroup: SVGGElement;
  private vignette: HTMLDivElement;
  private tint: HTMLDivElement;
  private cracks: CrackData[] = [];
  private scratchCount = 0;
  private coverage = 0;
  private doomFired = false;

  constructor(parent: HTMLElement) {
    this.svg = svgEl("svg", { class: "corruption-svg" });
    this.svg.setAttribute("aria-hidden", "true");
    this.scratchesGroup = svgEl("g", { class: "corruption-scratches" });
    this.cracksGroup = svgEl("g", { class: "corruption-cracks" });
    this.svg.append(this.scratchesGroup, this.cracksGroup);

    this.tint = document.createElement("div");
    this.tint.className = "corruption-tint";

    this.vignette = document.createElement("div");
    this.vignette.className = "corruption-vignette";

    parent.append(this.svg, this.tint, this.vignette);
    this.applyWindowSize();
    addEventListener("resize", () => this.rebuild());
    this.svg.addEventListener("click", (event) => {
      if (!(event instanceof MouseEvent)) {
        return;
      }
      this.onRepairRequest?.({ x: event.clientX, y: event.clientY });
    });
  }

  /** Grow the decay with the total number of upgrade levels owned. */
  setLevel(totalLevels: number): void {
    const crackTarget = Math.min(
      MAX_CRACKS,
      Math.floor(totalLevels / CRACK_LEVELS_PER_CRACK),
    );
    const scratchTarget = Math.min(
      MAX_SCRATCHES,
      Math.floor(totalLevels / SCRATCH_LEVELS_PER_SCRATCH),
    );

    // New damage fades in one after another, like the wall is still failing.
    let stagger = 0;
    while (this.scratchCount < scratchTarget) {
      this.addScratch(stagger);
      this.scratchCount += 1;
      stagger += 140;
    }
    while (this.cracks.length < crackTarget) {
      this.addCrack(stagger);
      stagger += 260;
    }

    this.vignette.style.opacity = `${
      Math.min(
        0.55,
        0.2 + totalLevels * 0.035,
      )
    }`;
    this.tint.style.opacity = `${Math.min(0.2, totalLevels * 0.018)}`;
    document.body.classList.toggle("corrupted", totalLevels >= 4);
  }

  /** Fraction of the screen currently covered by crack bands. */
  getCoverage(): number {
    return this.coverage;
  }

  get crackCount(): number {
    return this.cracks.length;
  }

  /** Seal the crack nearest to the point if it lies within the radius. */
  repairNearestCrack(x: number, y: number): boolean {
    let nearest: CrackData | null = null;
    let nearestDistance = Infinity;
    for (const crack of this.cracks) {
      const distance = distanceToPolyline(crack.points, x, y);
      if (distance < nearestDistance) {
        nearest = crack;
        nearestDistance = distance;
      }
    }
    if (!nearest || nearestDistance > REPAIR_RADIUS) {
      return false;
    }
    this.removeCrack(nearest);
    return true;
  }

  /** Clear every trace of decay, e.g. when the game restarts. */
  reset(): void {
    this.cracks = [];
    this.scratchCount = 0;
    this.coverage = 0;
    this.doomFired = false;
    this.cracksGroup.replaceChildren();
    this.scratchesGroup.replaceChildren();
    this.vignette.style.opacity = "0.2";
    this.tint.style.opacity = "0";
    document.body.classList.remove("corrupted");
  }

  private applyWindowSize(): void {
    const width = globalThis.innerWidth;
    const height = globalThis.innerHeight;
    this.svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    this.svg.setAttribute("width", `${width}`);
    this.svg.setAttribute("height", `${height}`);
  }

  /** Re-scatter existing damage after a resize. */
  private rebuild(): void {
    this.applyWindowSize();
    const cracks = this.cracks.length;
    const scratches = this.scratchCount;
    this.cracksGroup.replaceChildren();
    this.scratchesGroup.replaceChildren();
    this.cracks = [];
    this.scratchCount = 0;
    for (let i = 0; i < scratches; i++) {
      this.addScratch(0);
    }
    for (let i = 0; i < cracks; i++) {
      this.addCrack(0);
    }
    this.scratchCount = scratches;
  }

  private removeCrack(crack: CrackData): void {
    this.cracks = this.cracks.filter((candidate) => candidate !== crack);
    crack.group.style.animation = "none";
    const fade = crack.group.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 350,
      easing: "ease-out",
      fill: "forwards",
    });
    void fade.finished
      .then(() => crack.group.remove())
      .catch(() => crack.group.remove());
    this.recomputeCoverage();
  }

  /** A long jagged crack that draws itself inward from a screen edge. */
  private addCrack(delayMs: number): void {
    const width = globalThis.innerWidth;
    const height = globalThis.innerHeight;
    const edge = Math.floor(Math.random() * 4);
    let x = 0;
    let y = 0;
    let angle = 0;
    if (edge === 0) {
      x = Math.random() * width;
      y = -4;
      angle = Math.PI / 2;
    } else if (edge === 1) {
      x = width + 4;
      y = Math.random() * height;
      angle = Math.PI;
    } else if (edge === 2) {
      x = Math.random() * width;
      y = height + 4;
      angle = -Math.PI / 2;
    } else {
      x = -4;
      y = Math.random() * height;
      angle = 0;
    }
    angle += (Math.random() - 0.5) * 0.9;
    const inward = angle;

    const segments = 14 + Math.floor(Math.random() * 11);
    const branchAt = 4 + Math.floor(Math.random() * (segments - 7));
    const points: Point[] = [{ x, y }];
    let branchPoints: Point[] = [];

    for (let i = 0; i < segments; i++) {
      const step = 55 + Math.random() * 40;
      angle += (Math.random() - 0.5) * 1.0;
      // Keep wobbling, but keep drifting back toward the middle.
      angle = angle * 0.65 + inward * 0.35;
      x += Math.cos(angle) * step;
      y += Math.sin(angle) * step;
      points.push({ x, y });
      if (i === branchAt) {
        const branchDirection = angle +
          (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.5);
        let bx = x;
        let by = y;
        let ba = branchDirection;
        branchPoints = [{ x: bx, y: by }];
        for (let j = 0; j < 4; j++) {
          const branchStep = 22 + Math.random() * 20;
          ba = ba * 0.7 + branchDirection * 0.3 + (Math.random() - 0.5) * 0.7;
          bx += Math.cos(ba) * branchStep;
          by += Math.sin(ba) * branchStep;
          branchPoints.push({ x: bx, y: by });
        }
      }
    }

    const d = polylinePath(points);
    const group = svgEl("g", { class: "crack-flicker" });
    const shadow = svgEl("path", {
      d,
      fill: "none",
      stroke: "#04050c",
      "stroke-width": "3",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      opacity: "0.4",
    });
    const main = svgEl("path", {
      d,
      fill: "none",
      stroke: "#e3e7ff",
      "stroke-width": "1.4",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      opacity: "0.62",
    });
    const hit = svgEl("path", {
      d,
      fill: "none",
      stroke: "transparent",
      "stroke-width": `${HIT_BAND_WIDTH}`,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "pointer-events": "stroke",
      class: "crack-hit",
    });
    group.append(shadow, main);
    this.cracksGroup.append(group);
    if (branchPoints.length > 1) {
      const branch = svgEl("path", {
        d: polylinePath(branchPoints),
        fill: "none",
        stroke: "#e3e7ff",
        "stroke-width": "1",
        "stroke-linecap": "round",
        opacity: "0.5",
      });
      group.append(branch);
      this.drawIn(branch, delayMs + 120);
    }
    group.append(hit);

    shadow.animate([{ opacity: 0 }, { opacity: 0.4 }], {
      duration: 600,
      delay: delayMs,
      easing: "ease-out",
      fill: "forwards",
    });
    this.drawIn(main, delayMs);
    randomizeFlicker(group);
    this.cracks.push({ points, group });
    this.recomputeCoverage();
  }

  private recomputeCoverage(): void {
    const width = Math.max(1, globalThis.innerWidth);
    const height = Math.max(1, globalThis.innerHeight);
    let totalLength = 0;
    for (const crack of this.cracks) {
      totalLength += polylineLength(crack.points);
    }
    this.coverage = Math.min(
      1,
      (totalLength * HIT_BAND_WIDTH) / (width * height),
    );
    if (!this.doomFired && this.coverage >= DOOM_COVERAGE) {
      this.doomFired = true;
      this.onDoom?.();
    }
  }

  /** Thin scratches; two out of five are three-line claw marks. */
  private addScratch(delayMs: number): void {
    const width = globalThis.innerWidth;
    const height = globalThis.innerHeight;
    const angle = Math.random() * Math.PI;
    const length = 50 + Math.random() * 110;
    const cx = Math.random() * width;
    const cy = Math.random() * height;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const lineCount = Math.random() < 0.45 ? 3 : 1;

    const group = svgEl("g", { class: "scratch-flicker" });
    this.scratchesGroup.append(group);
    for (let i = 0; i < lineCount; i++) {
      const offset = (i - (lineCount - 1) / 2) * (5 + Math.random() * 3);
      const ox = -dy * offset;
      const oy = dx * offset;
      const lineLength = length * (0.7 + Math.random() * 0.5);
      const finalOpacity = 0.1 + Math.random() * 0.16;
      const line = svgEl("line", {
        x1: (cx + ox - dx * (lineLength / 2)).toFixed(1),
        y1: (cy + oy - dy * (lineLength / 2)).toFixed(1),
        x2: (cx + ox + dx * (lineLength / 2)).toFixed(1),
        y2: (cy + oy + dy * (lineLength / 2)).toFixed(1),
        stroke: "#cfd6ff",
        "stroke-width": (0.7 + Math.random() * 0.7).toFixed(2),
        "stroke-linecap": "round",
        opacity: finalOpacity.toFixed(2),
      });
      group.append(line);
      line.animate([{ opacity: 0 }, { opacity: finalOpacity }], {
        duration: 900,
        delay: delayMs + i * 140,
        easing: "ease-out",
        fill: "forwards",
      });
    }
    randomizeFlicker(group);
  }

  /** Reveal a stroke as if it is being torn into existence. */
  private drawIn(path: SVGPathElement, delayMs: number): void {
    const length = path.getTotalLength();
    path.style.strokeDasharray = `${length}`;
    path.style.strokeDashoffset = `${length}`;
    path.animate(
      [{ strokeDashoffset: length }, { strokeDashoffset: 0 }],
      {
        duration: 500 + Math.random() * 400,
        delay: delayMs,
        easing: "ease-out",
        fill: "forwards",
      },
    );
  }
}

function polylinePath(points: Point[]): string {
  return `M ${
    points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ")
  }`;
}

function polylineLength(points: Point[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += Math.hypot(
      points[i + 1]!.x - points[i]!.x,
      points[i + 1]!.y - points[i]!.y,
    );
  }
  return total;
}

function distanceToPolyline(points: Point[], x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    best = Math.min(best, distanceToSegment(points[i]!, points[i + 1]!, x, y));
  }
  return best;
}

function distanceToSegment(a: Point, b: Point, x: number, y: number): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  let t = lengthSq === 0 ? 0 : ((x - a.x) * dx + (y - a.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy));
}

function randomizeFlicker(element: SVGElement): void {
  element.style.animationDuration = `${6 + Math.random() * 9}s`;
  element.style.animationDelay = `${(-Math.random() * 8).toFixed(1)}s`;
}

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string>,
): SVGElementTagNameMap[K] {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs)) {
    element.setAttribute(key, value);
  }
  return element;
}
