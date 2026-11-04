// Creeping decay layer: hairline cracks and claw scratches appear on the
// backdrop as more upgrades are bought. Presentation only; holds no game
// state, so it can be driven from a single total-levels number.

const MAX_CRACKS = 12;
const MAX_SCRATCHES = 24;
const CRACK_LEVELS_PER_CRACK = 2;
const SCRATCH_LEVELS_PER_SCRATCH = 0.5;

export class CorruptionLayer {
  private svg: SVGSVGElement;
  private cracksGroup: SVGGElement;
  private scratchesGroup: SVGGElement;
  private vignette: HTMLDivElement;
  private tint: HTMLDivElement;
  private crackCount = 0;
  private scratchCount = 0;

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
    while (this.crackCount < crackTarget) {
      this.addCrack(stagger);
      this.crackCount += 1;
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
    const cracks = this.crackCount;
    const scratches = this.scratchCount;
    this.cracksGroup.replaceChildren();
    this.scratchesGroup.replaceChildren();
    this.crackCount = 0;
    this.scratchCount = 0;
    for (let i = 0; i < scratches; i++) {
      this.addScratch(0);
    }
    for (let i = 0; i < cracks; i++) {
      this.addCrack(0);
    }
    this.crackCount = cracks;
    this.scratchCount = scratches;
  }

  /** A jagged hairline crack that draws itself inward from a screen edge. */
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

    const segments = 7 + Math.floor(Math.random() * 5);
    const branchAt = 2 + Math.floor(Math.random() * (segments - 3));
    const points: string[] = [`${x.toFixed(1)},${y.toFixed(1)}`];
    let branchPoints: string[] = [];

    for (let i = 0; i < segments; i++) {
      const step = 18 + Math.random() * 30;
      angle += (Math.random() - 0.5) * 1.0;
      // Keep wobbling, but keep drifting back toward the middle.
      angle = angle * 0.65 + inward * 0.35;
      x += Math.cos(angle) * step;
      y += Math.sin(angle) * step;
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      if (i === branchAt) {
        const branchDirection = angle +
          (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.5);
        let bx = x;
        let by = y;
        let ba = branchDirection;
        branchPoints = [`${bx.toFixed(1)},${by.toFixed(1)}`];
        for (let j = 0; j < 3; j++) {
          const branchStep = 10 + Math.random() * 16;
          ba = ba * 0.7 + branchDirection * 0.3 + (Math.random() - 0.5) * 0.7;
          bx += Math.cos(ba) * branchStep;
          by += Math.sin(ba) * branchStep;
          branchPoints.push(`${bx.toFixed(1)},${by.toFixed(1)}`);
        }
      }
    }

    const d = `M ${points.join(" L ")}`;
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
    group.append(shadow, main);
    this.cracksGroup.append(group);

    shadow.animate([{ opacity: 0 }, { opacity: 0.4 }], {
      duration: 600,
      delay: delayMs,
      easing: "ease-out",
      fill: "forwards",
    });
    this.drawIn(main, delayMs);

    if (branchPoints.length > 1) {
      const branch = svgEl("path", {
        d: `M ${branchPoints.join(" L ")}`,
        fill: "none",
        stroke: "#e3e7ff",
        "stroke-width": "1",
        "stroke-linecap": "round",
        opacity: "0.5",
      });
      group.append(branch);
      this.drawIn(branch, delayMs + 120);
    }
    randomizeFlicker(group);
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
