/*
 * Step-scene engine for Reveal.js 6: Motion-Canvas-style timelines driven by the arrow keys.
 *
 * A slide becomes a "scene" with <section data-steps="N">. The engine appends N hidden
 * fragments, then on every fragment/slide change it writes the current step to the section:
 *   data-step="k"           exact step (0..N), for "only at step k" rules and captions
 *   classes s1..sk          cumulative, for "from step k onward" rules (.aN / .hN utilities)
 * Because state is derived from Reveal's own fragment state, going backward reverses every
 * animation for free.
 *
 * Optional per-element hooks (all declarative):
 *   data-track='{"0":{"left":"80px"},"3":{"left":"560px","--c":"var(--violet)"}}'
 *       Keyframe track: styles for step k are merged over every earlier key, applied inline,
 *       and animated by the element's CSS transition (the Motion Canvas "signal" idea).
 *   data-type-at="2" data-text="index=web status=500"
 *       Types the text in once the scene reaches that step; clears when stepping back.
 * Scenes also emit a "step" CustomEvent (detail = step) for bespoke behaviour.
 *
 * Usage (before Reveal.initialize):
 *   import { installStepScenes } from "./step-engine.js";
 *   installStepScenes(Reveal, { minimap: document.querySelector(".minimap") });
 */

export function installStepScenes(Reveal, { minimap = null, maxSteps = 9 } = {}) {
  document.querySelectorAll("section[data-steps]").forEach((s) => {
    const n = Number(s.dataset.steps);
    if (n > maxSteps) console.warn(`[step-scenes] #${s.id} has ${n} steps; utilities cover ${maxSteps}.`);
    for (let i = 0; i < n; i++) {
      const beat = document.createElement("span");
      beat.className = "fragment beat";
      beat.setAttribute("aria-hidden", "true");
      s.appendChild(beat);
    }
    s.dataset.step = "0";
  });

  // Packet dash spacing is in absolute px, so packet paths must not be normalised.
  document.querySelectorAll("path.packets").forEach((p) => p.removeAttribute("pathLength"));

  const typers = new WeakMap();

  function applyTracks(section, step) {
    section.querySelectorAll("[data-track]").forEach((el) => {
      let keys;
      try { keys = JSON.parse(el.dataset.track); } catch { console.warn("[step-scenes] bad data-track", el); return; }
      const merged = {};
      Object.keys(keys).map(Number).sort((a, b) => a - b)
        .filter((k) => k <= step)
        .forEach((k) => Object.assign(merged, keys[k]));
      const all = new Set(Object.values(keys).flatMap(Object.keys));
      all.forEach((prop) => (prop in merged ? el.style.setProperty(prop, merged[prop]) : el.style.removeProperty(prop)));
    });
  }

  function applyTyping(section, step) {
    section.querySelectorAll("[data-type-at]").forEach((el) => {
      const at = Number(el.dataset.typeAt);
      const full = el.dataset.text || "";
      clearInterval(typers.get(el));
      if (step < at) { el.textContent = ""; return; }
      if (el.textContent === full) return;
      let i = 0;
      typers.set(el, setInterval(() => {
        el.textContent = full.slice(0, ++i);
        if (i >= full.length) clearInterval(typers.get(el));
      }, 28));
    });
  }

  function applyStep(section) {
    if (!section || !section.hasAttribute("data-steps")) return;
    const step = section.querySelectorAll(".fragment.beat.visible").length;
    section.dataset.step = String(step);
    for (let i = 1; i <= maxSteps; i++) section.classList.toggle("s" + i, i <= step);
    applyTracks(section, step);
    applyTyping(section, step);
    section.dispatchEvent(new CustomEvent("step", { detail: step }));
  }

  function updateMinimap(section) {
    if (!minimap) return;
    const on = (section?.dataset.stage || "").split(",").map((x) => x.trim()).filter(Boolean);
    minimap.classList.toggle("hidden", on.length === 0);
    minimap.querySelectorAll("[data-k]").forEach((el) => el.toggleAttribute("data-on", on.includes(el.dataset.k)));
  }

  const sync = (slide) => { applyStep(slide); updateMinimap(slide); };
  Reveal.on("ready", (e) => sync(e.currentSlide));
  Reveal.on("slidechanged", (e) => sync(e.currentSlide));
  Reveal.on("fragmentshown", () => applyStep(Reveal.getCurrentSlide()));
  Reveal.on("fragmenthidden", () => applyStep(Reveal.getCurrentSlide()));
}
