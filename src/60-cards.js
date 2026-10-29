
  /* ================================================================== */
  /* Button card                                                         */
  /* ================================================================== */
  class TabletSheetButton extends Base {
    static get properties() { return { hass: { attribute: false }, _config: { state: true }, _snap: { state: true } }; }
    setConfig(config) {
      configure(config || {});
      this._config = { title: "Tablet Controls", icon: "mdi:tablet-dashboard", ...(config || {}) };
    }
    getCardSize() { return 1; }
    getGridOptions() { return { columns: 6, rows: 1, min_columns: 3, min_rows: 1 }; }
    static getStubConfig() { return { title: "Tablet Controls", icon: "mdi:tablet-dashboard" }; }

    connectedCallback() {
      super.connectedCallback();
      if (!local.ok) return;
      this._snap = local.snap(0);
      this._poll = setInterval(() => { if (!document.hidden) this._snap = local.snap(0); }, 5000);
    }
    disconnectedCallback() { clearInterval(this._poll); super.disconnectedCallback(); }
    shouldUpdate(changed) {
      if (changed.size === 1 && changed.has("hass")) {
        const sig = sigOf(this.hass, this._tablet());
        if (sig === this._sig) return false;
        this._sig = sig;
      }
      return true;
    }
    firstUpdated() {
      gestures(this.renderRoot.querySelector("ha-card"), {
        onTap: () => { if (!allowedHere(this.hass)) return; haptic("light"); if (!runAction(this, this.hass, this._config.tap_action, this._tablet())) this._open(); },
        onHold: () => { if (!allowedHere(this.hass)) return false; return runAction(this, this.hass, this._config.hold_action, this._tablet()) || (this._open("history"), true); },
      });
    }
    _tablet() { return tabletFor(this.hass, this._config); }
    _open(page) { window.openTabletSheet({ from: this, tablet: this._config.tablet, page: page || this._config.page }); }

    render() {
      if (!this._config) return html``;
      const allowed = allowedHere(this.hass);
      const t = this._tablet();
      const s = this._snap;
      let sub = this._config.subtitle || "Screens, brightness and restarts";
      let icon = this._config.icon;
      let charging = false;
      if (s) {
        sub = Number.isFinite(Number(s.battery)) ? `${Math.round(s.battery)}%, ${s.plugged ? "charging" : "on battery"}` : sub;
        charging = !!s.plugged;
      } else if (t && this.hass && this._config.show_state !== false) {
        const st = stateOf(this.hass, t);
        if (!st.online) sub = `${t.name} offline`;
        else sub = [st.level != null ? `${Math.round(st.level)}%` : null, st.charging ? "charging" : null, st.on ? "screen on" : "screen off"].filter(Boolean).join(", ");
        charging = st.charging;
      }
      if (charging && !this._config.icon) icon = "mdi:tablet-cellphone";
      return html`
        <ha-card class=${allowed ? "tap" : ""} tabindex=${allowed ? "0" : "-1"} role=${allowed ? "button" : "presentation"}>
          <div class="ic ${charging ? "charging" : ""}"><ha-icon .icon=${icon}></ha-icon></div>
          <div class="tx">
            <span class="p">${this._config.title}</span>
            ${sub ? html`<span class="s">${sub}</span>` : ""}
          </div>
        </ha-card>`;
    }

    static get styles() {
      return css`
        :host { display: block; height: 100%; }
        ha-card { height: 100%; box-sizing: border-box; display: flex; align-items: center; gap: 12px; padding: 12px;
          -webkit-tap-highlight-color: transparent; transition: transform .1s ease, background-color .2s ease; user-select: none; }
        ha-card.tap { cursor: pointer; }
        ha-card.tap:active { transform: scale(.98); }
        ha-card:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
        .ic { width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
          color: var(--primary-color); background: color-mix(in srgb, var(--primary-color) 18%, transparent); }
        .ic.charging { color: var(--success-color, #43a047); background: color-mix(in srgb, var(--success-color, #43a047) 18%, transparent); }
        .tx { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .p { font-weight: 600; font-size: 14px; color: var(--primary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .s { font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      `;
    }
  }
  if (!customElements.get("fully-tablet-sheet-button")) customElements.define("fully-tablet-sheet-button", TabletSheetButton);

  /* ================================================================== */
  /* Chip (Mushroom-style)                                               */
  /* ================================================================== */
  const COLORS = {
    red: "244, 67, 54", pink: "233, 30, 99", purple: "156, 39, 176", "deep-purple": "103, 58, 183", indigo: "63, 81, 181",
    blue: "33, 150, 243", "light-blue": "3, 169, 244", cyan: "0, 188, 212", teal: "0, 150, 136", green: "76, 175, 80",
    "light-green": "139, 195, 74", lime: "205, 220, 57", yellow: "255, 235, 59", amber: "255, 193, 7", orange: "255, 152, 0",
    "deep-orange": "255, 87, 34", brown: "121, 85, 72", grey: "158, 158, 158", "blue-grey": "96, 125, 139", black: "0, 0, 0", white: "255, 255, 255",
  };
  const rgbOf = (c) => {
    if (!c) return null;
    if (COLORS[c]) return COLORS[c];
    if (/^\d+\s*,\s*\d+\s*,\s*\d+$/.test(c)) return c;
    const m = String(c).match(/^#?([0-9a-f]{6})$/i);
    if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).join(", ");
    return null;
  };

  const CHIP_KINDS = ["status", "screen", "battery", "history", "app", "open", "charger"];
  class TabletChip extends Base {
    static get properties() { return { hass: { attribute: false }, _config: { state: true }, _tick: { state: true }, _busy: { state: true }, _dbg: { state: true } }; }
    setConfig(config) {
      const cfg = { chip: "status", ...(config || {}) };
      if (cfg.type && !config?.chip) { // type: custom:fully-tablet-chip-app / fully-tablet-app style aliases
        const m = String(cfg.type).match(/fully-tablet(?:-chip)?-(\w+)$/);
        if (m && CHIP_KINDS.includes(m[1])) cfg.chip = m[1];
      }
      if (cfg.app_package && !config?.chip) cfg.chip = "app";
      if (!CHIP_KINDS.includes(cfg.chip)) throw new Error(`fully-tablet-chip: unknown chip "${cfg.chip}" (use ${CHIP_KINDS.join(", ")})`);
      if (cfg.chip === "app" && !cfg.app_package) throw new Error("fully-tablet-chip: an app chip needs app_package (e.g. com.spotify.music)");
      configure(cfg);
      this._config = cfg;
    }
    getCardSize() { return 1; }
    getGridOptions() { return { columns: 3, rows: 1, min_columns: 2, min_rows: 1 }; }
    static getStubConfig() { return { chip: "status" }; }

    connectedCallback() {
      super.connectedCallback();
      if (local.ok) this._poll = setInterval(() => { if (!document.hidden) this._tick = Date.now(); }, 5000);
    }
    disconnectedCallback() { clearInterval(this._poll); super.disconnectedCallback(); }
    /* HA hands every card a new hass on every state change anywhere in the house; only re-render
       when something this chip shows has changed. */
    shouldUpdate(changed) {
      if (changed.size === 1 && changed.has("hass")) {
        const sig = sigOf(this.hass, this._tablet());
        if (sig === this._sig) return false;
        this._sig = sig;
      }
      return true;
    }
    firstUpdated() {
      const host = this.renderRoot.querySelector(".chip");
      debugLog(this.hass, `chip ${this._config?.chip} ready host=${!!host} tag=${this.localName} ua=${navigator.userAgent.slice(0, 60)}`);
      gestures(host, {
        onTap: () => this._tap(),
        onHold: () => this._hold(),
        onEvent: (m) => { this._dbg = m.replace(/pointerdown type=/, "down:").replace(/ button=\d/, "").replace("click held=", "click:"); debugLog(this.hass, `chip ${this._config?.chip}: ${m}`); },
      });
    }

    _tablet() { return tabletFor(this.hass, this._config); }
    _tap() {
      const t = this._tablet();
      const c = this._config;
      debugLog(this.hass, `chip ${c.chip} tap: tablet=${t?.key || "-"} allowed=${allowedHere(this.hass)} opener=${typeof window.openTabletSheet}`);
      if (c.debug) { this._dbg = `tap ${t ? t.key : "no tablet"}`; setTimeout(() => { const n = document.querySelectorAll("fully-tablet-sheet").length; this._dbg = n ? `sheet ×${n}` : "no sheet"; }, 400); }
      if (runAction(this, this.hass, c.tap_action, t)) return;
      if (!allowedHere(this.hass) && c.chip !== "app" && c.chip !== "screen") { haptic("failure"); return; }
      haptic("light");
      switch (c.chip) {
        case "screen": {
          if (!t) return;
          const st = stateOf(this.hass, t);
          if (!st.online) { haptic("failure"); return; }
          this._busy = true;
          setScreen(this.hass, t, !st.on).then((ok) => { this._busy = false; haptic(ok ? "success" : "failure"); });
          return;
        }
        case "app": {
          if (!t) { haptic("failure"); return; }
          this._busy = true;
          launchApp(this.hass, t, c.app_package).then((ok) => { this._busy = false; haptic(ok ? "success" : "failure"); });
          return;
        }
        case "charger": {
          if (!t?.plug) { haptic("failure"); return; }
          window.openTabletSheet({ from: this, tablet: t.key, page: "controls" });
          return;
        }
        case "history": window.openTabletSheet({ from: this, tablet: t?.key, page: "history" }); return;
        case "battery": window.openTabletSheet({ from: this, tablet: t?.key, page: "history" }); return;
        case "open": window.openTabletSheet({ from: this, tablet: c.tablet, page: c.page }); return;
        default: window.openTabletSheet({ from: this, tablet: t?.key, page: c.page || "controls" });
      }
    }
    _hold() {
      const t = this._tablet();
      if (runAction(this, this.hass, this._config.hold_action, t)) return true;
      if (!allowedHere(this.hass)) return false;
      if (this._config.chip === "app" && t) { // hold on an app chip brings Fully back to the front
        const I = ids(t.prefix);
        if (t.key === resolveLocal(this.hass) && local.has("bringToForeground")) local.call("bringToForeground");
        else if (this.hass.states?.[I.btn("bring_to_foreground")]) this.hass.callService("button", "press", { entity_id: I.btn("bring_to_foreground") });
        return true;
      }
      window.openTabletSheet({ from: this, tablet: t?.key, page: this._config.chip === "history" ? "controls" : "history" });
      return true;
    }

    render() {
      if (!this._config) return html``;
      const c = this._config;
      const t = this._tablet();
      const st = t && this.hass ? stateOf(this.hass, t) : null;
      let icon = c.icon, color = c.icon_color, text = c.content, tone = "";
      const low = st && st.level != null && st.level < 20 && !st.charging;
      const want = Array.isArray(c.show) ? c.show : ["battery", "screen"];
      switch (c.chip) {
        case "status": {
          icon = icon || (st?.charging ? "mdi:tablet-cellphone" : "mdi:tablet");
          if (!t) { text = text ?? "No tablet"; color = color || "grey"; break; }
          if (!st.online) { text = text ?? `${c.name || t.short} offline`; color = color || "red"; break; }
          const bits = [];
          if (c.name) bits.push(c.name);
          if (want.includes("battery") && st.level != null) bits.push(`${Math.round(st.level)}%`);
          if (want.includes("screen")) bits.push(st.on ? "On" : "Off");
          if (want.includes("app") && st.app && !st.app.fully) bits.push(st.app.name);
          text = text ?? bits.join(" · ");
          color = color || (low ? "red" : st.charging ? "green" : st.on ? "blue" : "grey");
          break;
        }
        case "screen": {
          icon = icon || (st?.on ? "mdi:monitor" : "mdi:monitor-off");
          text = text ?? (!st ? "" : !st.online ? "Offline" : st.on ? (c.name || "Screen on") : (c.name || "Screen off"));
          color = color || (!st?.online ? "red" : st.on ? "blue" : "grey");
          break;
        }
        case "battery": {
          icon = icon || batteryIcon(st?.level, st?.charging);
          text = text ?? (st?.level != null ? `${Math.round(st.level)}%` : "—");
          color = color || (low ? "red" : st?.charging ? "green" : "grey");
          break;
        }
        case "charger": {
          const plug = t?.plug ? this.hass?.states?.[t.plug] : null;
          icon = icon || (plug?.state === "on" ? "mdi:power-plug" : "mdi:power-plug-off");
          text = text ?? (!plug ? "No plug" : plug.state === "on" ? (c.name || "Charger on") : (c.name || "Charger off"));
          color = color || (plug?.state === "on" ? "green" : "amber");
          break;
        }
        case "history": icon = icon || "mdi:chart-timeline-variant"; text = text ?? (c.name || "History"); color = color || "grey"; break;
        case "app": {
          const info = appInfo(c.app_package);
          icon = icon || info?.icon || "mdi:application-outline";
          text = text ?? (c.name || info?.name || c.app_package);
          const inFront = st?.app?.pkg === c.app_package;
          color = color || (inFront ? "green" : "blue");
          if (inFront && c.show_state !== false) tone = "front";
          break;
        }
        default: icon = icon || "mdi:tablet-dashboard"; text = text ?? (c.name || "Tablets"); color = color || "blue";
      }
      if (c.icon_only) text = "";
      if (c.debug) text = `v${VERSION} ${this._dbg || "ready"}`;
      const rgb = rgbOf(color);
      const style = rgb ? `--chip-icon-rgb:${rgb};` : "";
      return html`
        <div class="chip ${tone} ${this._busy ? "busy" : ""} ${text ? "" : "icon-only"}" style=${style} role="button" tabindex="0" aria-label=${text || c.name || c.chip}>
          <span class="ic"><ha-icon .icon=${this._busy ? "mdi:loading" : icon} class=${this._busy ? "spin" : ""}></ha-icon></span>
          ${text ? html`<span class="tx">${text}</span>` : ""}
        </div>`;
    }

    /* Sized exactly like Mushroom's own chip: the chip's font-size is its height, icon and text
       are em fractions of it, so the --chip-* variables a mushroom-chips-card provides apply as-is. */
    static get styles() {
      return css`
        :host { display: inline-flex; vertical-align: middle; }
        .chip { box-sizing: content-box; height: var(--chip-height, 36px); min-width: var(--chip-height, 36px); font-size: var(--chip-height, 36px);
          display: inline-flex; align-items: center; justify-content: center; gap: 0.15em; padding: var(--chip-padding, 0 0.25em);
          border-radius: var(--chip-border-radius, 19px);
          background: var(--chip-background, var(--ha-card-background, var(--card-background-color, #fff)));
          border: var(--chip-border-width, var(--ha-card-border-width, 1px)) solid var(--chip-border-color, var(--ha-card-border-color, var(--divider-color, rgba(0,0,0,.12))));
          box-shadow: var(--chip-box-shadow, var(--ha-card-box-shadow, none)); color: var(--primary-text-color); line-height: 0;
          cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent; transition: transform .1s ease; }
        .chip.icon-only { padding: 0; }
        .chip:active { transform: scale(.96); }
        .chip:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
        .ic { display: flex; align-items: center; justify-content: center; color: rgb(var(--chip-icon-rgb, var(--rgb-primary-text-color, 33, 33, 33))); }
        .ic ha-icon { display: flex; --mdc-icon-size: var(--chip-icon-size, 0.5em); }
        .tx { font-size: var(--chip-font-size, 0.3em); font-weight: var(--chip-font-weight, bold); line-height: 1; white-space: nowrap;
          max-width: 14em; overflow: hidden; text-overflow: ellipsis; padding-right: 0.1em; }
        .chip.front .tx { color: rgb(var(--chip-icon-rgb)); }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `;
    }
  }
  if (!customElements.get("fully-tablet-chip")) customElements.define("fully-tablet-chip", TabletChip);
  /* Mushroom's chips card turns `type: X` into the element <mushroom-X-chip> (no custom: prefix
     support), so the chip is also registered under that scheme: inside a mushroom-chips-card use
     `type: fully-tablet` (+ `chip: app` etc.) or the per-kind shorthand `type: fully-tablet-app`. */
  const aliases = ["mushroom-fully-tablet-chip", ...CHIP_KINDS.map((k) => `mushroom-fully-tablet-${k}-chip`), ...CHIP_KINDS.map((k) => `fully-tablet-chip-${k}`)];
  for (const tag of aliases) {
    if (customElements.get(tag)) continue;
    const kind = CHIP_KINDS.find((k) => tag.endsWith(`-${k}-chip`) || tag.endsWith(`-chip-${k}`));
    customElements.define(tag, class extends TabletChip {
      setConfig(c) { super.setConfig(kind ? { ...(c || {}), chip: kind } : c); }
    });
  }

  /* ---------- card picker ---------- */
  window.customCards = window.customCards || [];
  const add = (type, name, description) => { if (!window.customCards.some((c) => c.type === type)) window.customCards.push({ type, name, description, preview: false }); };
  add("fully-tablet-sheet-button", "Fully tablet sheet button", "Tile that opens the Fully Kiosk tablet sheet: screens, brightness, restarts, history.");
  add("fully-tablet-chip", "Fully tablet chip", "A chip for a Fully Kiosk tablet: status, screen, battery, history, app launcher, charger or opener. Inside a mushroom-chips-card use type: fully-tablet.");

  /* Warm HA's icon cache while the dashboard is idle, so the first open of the sheet doesn't
     wait on a dozen icon-chunk fetches (noticeable on tablets whose web storage gets cleared). */
  const ICONS = ["mdi:tablet", "mdi:tablet-dashboard", "mdi:tablet-cellphone", "mdi:tablet-off", "mdi:monitor", "mdi:monitor-off",
    "mdi:battery", "mdi:battery-charging-100", "mdi:battery-charging-60", "mdi:battery-60", "mdi:battery-unknown", "mdi:battery-charging",
    "mdi:battery-medium", "mdi:battery-heart-variant", "mdi:lightning-bolt", "mdi:power-plug", "mdi:power-plug-off", "mdi:power-plug-outline",
    "mdi:power-cycle", "mdi:refresh", "mdi:restart", "mdi:broom", "mdi:flip-to-front", "mdi:flip-to-back", "mdi:wifi", "mdi:wifi-refresh",
    "mdi:cellphone-screenshot", "mdi:image-off-outline", "mdi:web", "mdi:brightness-5", "mdi:brightness-7", "mdi:volume-low", "mdi:volume-high",
    "mdi:chart-timeline-variant", "mdi:tune-variant", "mdi:format-list-bulleted", "mdi:gesture-tap", "mdi:lan-disconnect", "mdi:map-marker",
    "mdi:view-grid-outline", "mdi:close", "mdi:loading", "mdi:information-outline", "mdi:chevron-down", "mdi:alert", "mdi:alert-circle-outline",
    "mdi:spotify", "mdi:television-play", "mdi:application-outline", "mdi:home-outline", "mdi:cog-outline"];
  const warmIcons = () => {
    if (!customElements.get("ha-icon") || document.hidden) return;
    const box = document.createElement("div");
    box.setAttribute("aria-hidden", "true");
    box.style.cssText = "position:fixed;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none";
    for (const icon of ICONS) { const el = document.createElement("ha-icon"); el.icon = icon; box.appendChild(el); }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 15000);
  };
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1));
  setTimeout(() => idle(warmIcons, { timeout: 10000 }), 6000);

  console.info(`%c FULLY-TABLET-SHEET %c v${VERSION} `,
    "background:#3d6fb6;color:#fff;border-radius:4px 0 0 4px;padding:2px 6px",
    "background:#555;color:#fff;border-radius:0 4px 4px 0;padding:2px 6px");
})();
