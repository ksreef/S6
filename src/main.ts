// Discord Pings Clicker — a themed incremental game.
// Implements the recommended build steps: click input, visible state,
// passive growth, frame-rate independent updates, and data-driven upgrades.
import "./style.css";

import logoUrl from "./assets/discord-logo.svg?no-inline";
import { PingSoundPlayer, type SoundTheme } from "./audio.ts";

// --- Game State ------------------------------------------------------------
interface GameState {
  pings: number;
  clickPower: number;
  passiveRate: number; // pings per second
  lastFrameTime: number;
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
};

// --- Data-Driven Upgrades -------------------------------------------------
// Difference between upgrades is expressed as data, not code branches.
const UPGRADES: UpgradeConfig[] = [
  {
    id: "holiday-ping",
    name: "Holiday Ping Upgrade",
    description: "More pings per click. Also changes your notification tone!",
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
  rateLine,
  shopTitle,
  shopList,
  statusLine,
);

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
    const level = upgradeLevels[upgrade.id];
    const cost = upgrade.getCost(level);
    if (state.pings >= cost) {
      state.pings -= cost;
      upgradeLevels[upgrade.id] = level + 1;
      upgrade.effect(state, level + 1);
      render();
      statusLine.textContent = `Bought ${upgrade.name}! Level ${
        level + 1
      } unlocked.`;
    } else {
      statusLine.textContent = `Not enough pings for ${upgrade.name}.`;
    }
  });
});

function render(): void {
  counterLine.textContent = `${Math.floor(state.pings)} pings`;
  rateLine.textContent = `+${
    state.passiveRate.toFixed(2)
  } pings/sec from your generators`;
  for (const upgrade of UPGRADES) {
    const ui = upgradeUIs.get(upgrade.id);
    if (!ui) continue;
    const level = upgradeLevels[upgrade.id];
    const cost = upgrade.getCost(level);
    ui.cost.textContent = `Cost: ${cost} pings (Lv. ${level})`;
    ui.root.disabled = state.pings < cost;
    ui.root.classList.toggle("affordable", state.pings >= cost);
  }
}

// --- Audio -----------------------------------------------------------------
const pingSound = new PingSoundPlayer();

// Holiday progression is tied to the "Holiday Ping Upgrade" level.
const HOLIDAY_THEMES: SoundTheme[] = [
  "default",
  "halloween",
  "christmas",
  "new-years",
];

function updateHolidayTone(holidayLevel: number): void {
  const theme =
    HOLIDAY_THEMES[Math.min(holidayLevel, HOLIDAY_THEMES.length - 1)]!;
  pingSound.setTheme(theme);
}

// --- Click input -----------------------------------------------------------
avatarButton.addEventListener("click", () => {
  state.pings += state.clickPower;
  pingSound.play();
  render();
});

// --- Timed growth (requestAnimationFrame) ----------------------------------
function gameLoop(now: number): void {
  const elapsed = (now - state.lastFrameTime) / 1000;
  state.lastFrameTime = now;

  if (state.passiveRate > 0) {
    state.pings += state.passiveRate * elapsed;
    render();
  }
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
render();
updateHolidayTone(0);
