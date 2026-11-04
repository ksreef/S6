// Discord Pings Clicker — a themed incremental game.
// Implements the recommended build steps: click input, visible state,
// passive growth, frame-rate independent updates, and data-driven upgrades.
import "./style.css";

import logoUrl from "./assets/discord-logo.svg?no-inline";
import ghostUrl from "./assets/ghost.png";
import { createAmbientBackground } from "./background.ts";
import { CorruptionLayer } from "./corruption.ts";
import { PingSoundPlayer, type SoundTheme } from "./audio.ts";

// --- Game State ------------------------------------------------------------
interface GameState {
  pings: number;
  clickPower: number;
  passiveRate: number; // pings per second
  lastFrameTime: number;
  lost: boolean; // true once the cracks take over the screen
}

interface UpgradeConfig {
  id: string;
  name: string;
  description: string;
  baseCost: number;
  costMultiplier: number;
  // Effects applied per level purchased
  effect: (state: GameState, level: number) => void;
  // Returns the new cost of the *next* upgrade based on the current level
  getCost: (level: number) => number;
}

// The state starts clean.
const state: GameState = {
  pings: 0,
  clickPower: 1,
  passiveRate: 0,
  lastFrameTime: performance.now(),
  lost: false,
};

// --- Data-Driven Upgrades -------------------------------------------------
// Difference between upgrades is expressed as data, not code branches.
const UPGRADES: UpgradeConfig[] = [
  {
    id: "holiday-ping",
    name: "Holiday Ping Upgrade",
    description:
      "More pings per click. Each level cycles your notification tone " +
      "through five distinct moods.",
    baseCost: 25,
    costMultiplier: 2.2,
    effect: (s, level) => {
      s.clickPower = 1 + level;
    },
    getCost: (level) => Math.ceil(25 * Math.pow(2.2, level)),
  },
  {
    id: "server-ping",
    name: "Server Ping",
    description: "Passively ping yourself on a server channel.",
    baseCost: 50,
    costMultiplier: 1.8,
    effect: (s, level) => {
      s.passiveRate = 0.5 * level;
    },
    getCost: (level) => Math.ceil(50 * Math.pow(1.8, level)),
  },
  {
    id: "server-spam",
    name: "Server Ping Spam",
    description: "Makes your server pings arrive even faster.",
    baseCost: 120,
    costMultiplier: 2.0,
    effect: (s, level) => {
      // Every level adds +50% efficiency to passive income.
      s.passiveRate = 0.5 * level * (1 + 0.5 * level);
    },
    getCost: (level) => Math.ceil(120 * Math.pow(2.0, level)),
  },
  {
    id: "group-chat",
    name: "Group Chat Ping",
    description: "A second generator. Everyone pings everyone.",
    baseCost: 200,
    costMultiplier: 2.5,
    effect: (s, level) => {
      // Adds a separate stream of pings that compound with Server Ping.
      const serverBoost = state.passiveRate > 0 ? 1.5 : 1;
      s.passiveRate += 1.0 * level * serverBoost;
    },
    getCost: (level) => Math.ceil(200 * Math.pow(2.5, level)),
  },
];

const upgradeLevels: Record<string, number> = {};
UPGRADES.forEach((u) => (upgradeLevels[u.id] = 0));

/** Sum of every owned level; drives how much the backdrop has decayed. */
function totalUpgradeLevels(): number {
  return Object.values(upgradeLevels).reduce((sum, level) => sum + level, 0);
}

// --- UI Layout -------------------------------------------------------------
const app = document.querySelector<HTMLElement>("#app")!;

const heading = document.createElement("h1");
heading.textContent = "Discord Pings Clicker";

const counterLine = document.createElement("p");
counterLine.className = "counter";

const avatarButton = document.createElement("button");
avatarButton.type = "button";
avatarButton.className = "avatar-button";
avatarButton.setAttribute("aria-label", "Discord avatar: click to get pinged");

const avatarImage = document.createElement("img");
avatarImage.src = logoUrl;
avatarImage.alt = "";
avatarImage.width = 224;
avatarImage.height = 224;
avatarImage.draggable = false;
avatarButton.append(avatarImage);

const rateLine = document.createElement("p");
rateLine.className = "status";

const toneLine = document.createElement("p");
toneLine.className = "status tone";

const damageLine = document.createElement("p");
damageLine.className = "status damage";

const shopTitle = document.createElement("h2");
shopTitle.textContent = "Upgrades";

const shopList = document.createElement("div");
shopList.className = "shop-list";

const statusLine = document.createElement("p");
statusLine.className = "status";
statusLine.textContent = "Click the avatar to get pinged.";

app.append(
  heading,
  counterLine,
  avatarButton,
  toneLine,
  rateLine,
  damageLine,
  shopTitle,
  shopList,
  statusLine,
);

// Ambient backdrop plus the creeping corruption overlay. Both sit behind
// the game panel; the vignette and tint float above everything.
createAmbientBackground(document.body, logoUrl);
const corruption = new CorruptionLayer(document.body);
corruption.onDoom = () => loseGame();
corruption.onRepairRequest = (point) => attemptRepair(point);

// --- Rendering -------------------------------------------------------------
interface UpgradeUI {
  root: HTMLButtonElement;
  title: HTMLElement;
  desc: HTMLElement;
  cost: HTMLElement;
}

const upgradeUIs = new Map<string, UpgradeUI>();

UPGRADES.forEach((upgrade) => {
  const root = document.createElement("button");
  root.type = "button";
  root.className = "upgrade-button";

  const title = document.createElement("span");
  title.className = "upgrade-title";
  title.textContent = upgrade.name;

  const desc = document.createElement("span");
  desc.className = "upgrade-desc";
  desc.textContent = upgrade.description;

  const cost = document.createElement("span");
  cost.className = "upgrade-cost";

  root.append(title, desc, cost);
  shopList.append(root);

  upgradeUIs.set(upgrade.id, { root, title, desc, cost });

  root.addEventListener("click", () => {
    if (state.lost) {
      return;
    }
    const level = upgradeLevels[upgrade.id];
    const cost = upgrade.getCost(level);
    if (state.pings >= cost) {
      state.pings -= cost;
      upgradeLevels[upgrade.id] = level + 1;
      upgrade.effect(state, level + 1);
      if (upgrade.id === "holiday-ping") {
        updateHolidayTone(level + 1);
      }
      corruption.setAmbience(totalUpgradeLevels());
      corruption.spawnCrack();
      render();
      statusLine.textContent = `Bought ${upgrade.name}! Level ${
        level + 1
      } unlocked.`;
    } else {
      statusLine.textContent = `Not enough pings for ${upgrade.name}.`;
    }
  });
});

let lastDamageText = "";

function render(): void {
  counterLine.textContent = `${Math.floor(state.pings)} pings`;
  rateLine.textContent = `+${
    state.passiveRate.toFixed(2)
  } pings/sec from your generators`;

  const coverage = corruption.getCoverage();
  const damageText =
    `Screen damage: ${(coverage * 100).toFixed(0)}% — cracks take over at 50%` +
    ` · seal one for ${crackSealCost()} pings`;
  if (damageText !== lastDamageText) {
    damageLine.textContent = damageText;
    lastDamageText = damageText;
  }
  damageLine.classList.toggle("damage-warn", coverage >= 0.35);

  for (const upgrade of UPGRADES) {
    const ui = upgradeUIs.get(upgrade.id);
    if (!ui) continue;
    const level = upgradeLevels[upgrade.id];
    const cost = upgrade.getCost(level);
    ui.cost.textContent = `Cost: ${cost} pings (Lv. ${level})`;
    ui.root.disabled = state.lost || state.pings < cost;
    ui.root.classList.toggle("affordable", !state.lost && state.pings >= cost);
  }
}

// --- Audio -----------------------------------------------------------------
const pingSound = new PingSoundPlayer();

// Every Holiday Ping Upgrade advances the tone; five distinct moods loop.
const HOLIDAY_THEMES: SoundTheme[] = [
  "classic",
  "halloween",
  "christmas",
  "glitch",
  "void",
];

const TONE_LABELS: Record<SoundTheme, string> = {
  classic: "Classic ding",
  halloween: "Halloween howl",
  christmas: "Christmas chimes",
  glitch: "Glitch burst",
  void: "Void whisper",
};

function updateHolidayTone(holidayLevel: number): void {
  const theme = HOLIDAY_THEMES[holidayLevel % HOLIDAY_THEMES.length]!;
  pingSound.setTheme(theme);
  toneLine.textContent = `Notification tone: ${TONE_LABELS[theme]}`;
}

// --- Game over --------------------------------------------------------------
// If cracks ever cover half the screen, the ghost wins. Sealing a crack
// costs pings and depends on how many cracks are already out there.
const SEED_COST = 20;
const SEED_COST_PER_CRACK = 10;

function crackSealCost(): number {
  return SEED_COST + SEED_COST_PER_CRACK * corruption.crackCount;
}

function attemptRepair(point: { x: number; y: number }): void {
  if (state.lost) {
    return;
  }
  const cost = crackSealCost();
  if (state.pings < cost) {
    statusLine.textContent =
      `Not enough pings to seal a crack (${cost} needed).`;
    return;
  }
  if (corruption.repairNearestCrack(point.x, point.y)) {
    state.pings -= cost;
    statusLine.textContent = `Crack sealed for ${cost} pings.`;
    render();
  } else {
    statusLine.textContent = "No crack close enough to seal there.";
  }
}

function loseGame(): void {
  if (state.lost) {
    return;
  }
  state.lost = true;
  pingSound.playLossSting();
  gameOverOverlay.hidden = false;
  statusLine.textContent = "The cracks swallowed the screen.";
  render();
}

function restartGame(): void {
  state.pings = 0;
  state.clickPower = 1;
  state.passiveRate = 0;
  state.lost = false;
  for (const upgrade of UPGRADES) {
    upgradeLevels[upgrade.id] = 0;
  }
  updateHolidayTone(0);
  corruption.reset();
  corruption.setAmbience(0);
  gameOverOverlay.hidden = true;
  statusLine.textContent = "Back to zero. The walls are clean... for now.";
  render();
}

const gameOverOverlay = document.createElement("div");
gameOverOverlay.className = "game-over";
gameOverOverlay.hidden = true;

const gameOverGhost = document.createElement("div");
gameOverGhost.className = "game-over-ghost-wrap";
const ghostImage = document.createElement("img");
ghostImage.src = ghostUrl;
ghostImage.alt = "";
ghostImage.className = "game-over-ghost";
gameOverGhost.append(ghostImage);

const gameOverTitle = document.createElement("h2");
gameOverTitle.textContent = "The cracks won.";

const gameOverText = document.createElement("p");
gameOverText.textContent =
  "You let half the screen fill with cracks. The pings claimed another one.";

const restartButton = document.createElement("button");
restartButton.type = "button";
restartButton.className = "restart-button";
restartButton.textContent = "Restart";
restartButton.addEventListener("click", () => restartGame());

gameOverOverlay.append(
  gameOverGhost,
  gameOverTitle,
  gameOverText,
  restartButton,
);
document.body.append(gameOverOverlay);

// --- Click input -----------------------------------------------------------
avatarButton.addEventListener("click", () => {
  if (state.lost) {
    return;
  }
  state.pings += state.clickPower;
  pingSound.play();
  render();
});

// --- Timed growth (requestAnimationFrame) ----------------------------------
function gameLoop(now: number): void {
  const elapsed = (now - state.lastFrameTime) / 1000;
  state.lastFrameTime = now;

  if (!state.lost && state.passiveRate > 0) {
    state.pings += state.passiveRate * elapsed;
    render();
  }
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
render();
updateHolidayTone(0);
corruption.setAmbience(totalUpgradeLevels());
