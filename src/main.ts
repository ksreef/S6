// Vite turns this import into a production-safe URL. Keep it as a file so
// even this tiny example demonstrates a separately deployed asset.
// @deno-types="./asset-url.d.ts"
import logoUrl from "./assets/discord-logo.svg?no-inline";
import { PingSoundPlayer } from "./audio.ts";
import "./style.css";

const app = document.querySelector<HTMLElement>("#app")!;

const heading = document.createElement("h1");
heading.textContent = "Discord Pings Clicker";

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

const statusLine = document.createElement("p");
statusLine.className = "status";
statusLine.textContent = "Click the avatar to get pinged.";

let pings = 0;

const counterLine = document.createElement("p");
counterLine.className = "counter";

function renderCounter(): void {
  counterLine.textContent = `${pings} pings`;
}

renderCounter();

const pingSound = new PingSoundPlayer();

avatarButton.addEventListener("click", () => {
  pings += 1;
  renderCounter();
  pingSound.play();
});

app.append(heading, counterLine, avatarButton, statusLine);
