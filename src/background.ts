// Ambient animated backdrop: drifting blurple glow, a slow-panning grid,
// giant faint emblems, and rising notification motes. Purely presentational.

const ORB_COLORS = ["#5865f2", "#eb459e", "#57f287", "#fee75c"];
const MOTE_COUNT = 36;
const EMBLEM_COUNT = 2;

export function createAmbientBackground(
  parent: HTMLElement,
  emblemUrl: string,
): void {
  const backdrop = document.createElement("div");
  backdrop.className = "bg";
  backdrop.setAttribute("aria-hidden", "true");

  const gradient = document.createElement("div");
  gradient.className = "bg-gradient";

  const grid = document.createElement("div");
  grid.className = "bg-grid";

  for (let i = 0; i < EMBLEM_COUNT; i++) {
    const emblem = document.createElement("img");
    emblem.src = emblemUrl;
    emblem.alt = "";
    emblem.className = i === 0
      ? "bg-emblem bg-emblem-a"
      : "bg-emblem bg-emblem-b";
    emblem.draggable = false;
    backdrop.append(emblem);
  }

  for (let i = 0; i < ORB_COLORS.length; i++) {
    const orb = document.createElement("div");
    orb.className = "bg-orb";
    orb.style.background = ORB_COLORS[i]!;
    orb.style.left = `${6 + i * 26}%`;
    orb.style.top = `${4 + (i % 2) * 56}%`;
    orb.style.animationDelay = `${-i * 6}s`;
    orb.style.animationDuration = `${20 + i * 5}s`;
    backdrop.append(orb);
  }

  const motes = document.createElement("div");
  motes.className = "bg-motes";
  for (let i = 0; i < MOTE_COUNT; i++) {
    motes.append(createMote());
  }

  backdrop.append(gradient, grid, motes);
  parent.append(backdrop);
}

/** One drifting mote; negative delay pre-populates the field mid-flight. */
function createMote(): HTMLSpanElement {
  const mote = document.createElement("span");
  const size = 2 + Math.random() * 3;
  const duration = 16 + Math.random() * 20;
  mote.className = "mote";
  mote.style.width = `${size.toFixed(1)}px`;
  mote.style.height = `${size.toFixed(1)}px`;
  mote.style.left = `${(Math.random() * 100).toFixed(1)}%`;
  mote.style.animationDuration = `${duration.toFixed(1)}s`;
  mote.style.animationDelay = `${(-Math.random() * duration).toFixed(1)}s`;
  mote.style.setProperty(
    "--mote-sway",
    `${(Math.random() * 48 - 24).toFixed(0)}px`,
  );
  mote.style.setProperty(
    "--mote-opacity",
    (0.12 + Math.random() * 0.3).toFixed(2),
  );
  if (Math.random() < 0.6) {
    mote.classList.add("mote-blurple");
  }
  return mote;
}
