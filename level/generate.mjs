// Builds the README level: the last year of GitHub contributions as a platformer.
// Writes dist/day.svg and dist/night.svg. Pure SVG + SMIL, no JavaScript in the output.
//
//   GITHUB_TOKEN=... node level/generate.mjs            fetch live data
//   node level/generate.mjs path/to/calendar.json       use a saved GraphQL response

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const USER = process.env.GH_USER || "aryansid";
const HERE = new URL(".", import.meta.url);

// ---------- data ----------
async function loadCalendar(){
  if (process.argv[2]) return JSON.parse(readFileSync(process.argv[2], "utf8"));
  const query = `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{date contributionCount}}}}}}`;
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {Authorization: `bearer ${process.env.GITHUB_TOKEN}`, "Content-Type": "application/json", "User-Agent": "commit-climb"},
    body: JSON.stringify({query, variables: {login: USER}})
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json;
}

const cal = (await loadCalendar()).data.user.contributionsCollection.contributionCalendar;
const weeks = cal.weeks.map(w => ({date: w.contributionDays[0].date, count: w.contributionDays.reduce((a, d) => a + d.contributionCount, 0)}));
console.log(`${USER}: ${cal.totalContributions} contributions over ${weeks.length} weeks, max week ${Math.max(...weeks.map(w => w.count))}`);

// ---------- themes ----------
const THEMES = {
  day: `--sky-1:#55b4ff;--sky-2:#a6dcff;--star-op:0;--moon-op:0;--cloud:#ffffff;--cloud-sh:#cde9ff;
    --hill-far:#8fd3b6;--hill:#45b452;--hill-hi:#7fd66a;--grass-hi:#b2f063;--grass:#5ec22e;--grass-dk:#2f8a1b;
    --dirt:#c47b3b;--dirt-dk:#8c4f22;--dirt-lt:#e09a57;--hud:#ffffff;--hud-sh:#1b1222;--pole:#e9edf2;--pole-dk:#9aa3b1;
    --band:#1d2433;--band-hi:#2f3b55;--band-fg:#e8ecf5;--band-tick:#8a95ad;`,
  night: `--sky-1:#0b1030;--sky-2:#273575;--star-op:1;--moon-op:1;--cloud:#46548c;--cloud-sh:#36437a;
    --hill-far:#1e3c5a;--hill:#1f5c3c;--hill-hi:#2f7a4c;--grass-hi:#7ccc48;--grass:#3f9a24;--grass-dk:#22621a;
    --dirt:#7f4c27;--dirt-dk:#53301a;--dirt-lt:#9a6232;--hud:#ffffff;--hud-sh:#05060f;--pole:#c9cfdb;--pole-dk:#7d8698;
    --band:#05070f;--band-hi:#1c2448;--band-fg:#cdd5ec;--band-tick:#56618a;`
};
const FONT = readFileSync(new URL("PressStart2P-latin.woff2", HERE)).toString("base64");

// ---------- tiny SVG builder ----------
class Node_ {
  constructor(tag, attrs){ this.tag = tag; this.attrs = attrs || {}; this.children = []; this.text = ""; }
  add(c){ if (c.parent) c.parent.children = c.parent.children.filter(x => x !== c); this.children.push(c); c.parent = this; return c; }
}
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const ser = n => `<${n.tag}${Object.entries(n.attrs).map(([k, v]) => ` ${k}="${esc(v)}"`).join("")}>${esc(n.text)}${n.children.map(ser).join("")}</${n.tag}>`;

function build(themeName){
  const W = 1200, H = 440, X0 = 72, P = 20, GROUND = 416, MAX_ROWS = 11;
  const PX = 2, HOLD0 = 0.8, HOLD1 = 3.4, HOP = 0.42;

  const counts = weeks.map(w => w.count);
  const maxWeek = Math.max(1, ...counts);
  const NICE = [1, 2, 3, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000];
  const PER_BLOCK = NICE.find(n => n >= maxWeek / MAX_ROWS) || Math.ceil(maxWeek / MAX_ROWS);
  const heights = counts.map(c => c ? Math.ceil(c / PER_BLOCK) : 0);
  const N = heights.length, LAST = N - 1;

  let seed = 4242;
  const rng = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const f5 = x => (+x).toFixed(5);
  const r1 = x => (+x).toFixed(1);
  const el = (tag, attrs, parent) => { const n = new Node_(tag, Object.fromEntries(Object.entries(attrs || {}).map(([k, v]) => [k, String(v)]))); if (parent) parent.add(n); return n; };
  const txt = (parent, x, y, s, attrs) => { const t = el("text", Object.assign({x, y}, attrs), parent); t.text = s; return t; };

  const xs = i => X0 + i * P;
  const cx = i => xs(i) + P / 2;
  const top = i => GROUND - heights[i] * P;

  function pix(rows, colors, parent, s, ox, oy, attrs){
    const g = el("g", Object.assign({class: "px", transform: `translate(${ox || 0} ${oy || 0}) scale(${s})`}, attrs || {}), parent);
    const paths = {};
    rows.forEach((row, r) => {
      let c = 0;
      while (c < row.length){
        const ch = row[c];
        if (ch === "."){ c++; continue; }
        let e = c; while (row[e + 1] === ch) e++;
        paths[ch] = (paths[ch] || "") + `M${c} ${r}h${e - c + 1}v1h${-(e - c + 1)}z`;
        c = e + 1;
      }
    });
    for (const ch in paths) el("path", {d: paths[ch], fill: colors[ch]}, g);
    return g;
  }
  function raster(test, x0, y0, x1, y1, cell){
    const out = {};
    for (let y = y0; y < y1; y += cell) for (let x = x0; x < x1; x += cell){
      const k = test(x + cell / 2, y + cell / 2);
      if (k) out[k] = (out[k] || "") + `M${r1(x)} ${r1(y)}h${cell}v${cell}h${-cell}z`;
    }
    return out;
  }

  // ---------- physics: one gravity for every arc, steady run speed, air control ----------
  // Units are SVG units (a tile is 20) and seconds.
  const GRAV = 3000;        // same gravity for hops, drops, pit jumps and the victory hop
  const VX = 100;           // run speed
  const ACC_T = .25;        // time to reach run speed from standing
  const STOP_D = 10;        // braking distance into the flag
  const APEX_MAX = 60;      // highest a pit jump may arc above its takeoff; longer pits sprint instead
  const HOP_MARGIN = 10;    // how far a step-up clears the step it lands on
  const MIN_POSE = .12;     // airtime below this keeps the run cycle (no flicker on tiny drops)
  const HALF = 7;           // half the hero's body width, for terrain collision

  const land = []; heights.forEach((h, i) => { if (h > 0) land.push(i); });
  const lastLand = land[land.length - 1];
  const stopX = cx(lastLand);                             // where the hero stands at the flag
  // landings keep the whole body on the block: [lo, hi] for the hero's center
  // (if the next column is taller, land at the near edge to leave run-up for the next hop)
  const lo = b => xs(b) + HALF;
  const hi = b => b === lastLand ? stopX : (heights[b + 1] > heights[b] ? lo(b) : xs(b) + P - HALF);
  const segs = [];                                        // {dur, at(t) -> [x, y], air}
  let x = cx(land[0]), y = top(land[0]);

  const runTo = x1 => {
    if (x1 <= x) return;
    const x0 = x, yy = y;
    segs.push({dur: (x1 - x0) / VX, at: t => [x0 + VX * t, yy], air: false});
    x = x1;
  };
  // ballistic arc from (x, y) to (x1, y1) taking dur seconds, under GRAV
  // body overlaps a column below its top?
  const clips = (px, py) => {
    for (let i = Math.floor((px - HALF + .01 - X0) / P); i <= Math.floor((px + HALF - .01 - X0) / P); i++)
      if (i >= 0 && i < N && heights[i] && py > top(i) + 1) return true;
    return false;
  };
  const arc = (x0, y0, x1, y1, dur) => {
    const vx = (x1 - x0) / dur, vy = (y0 - y1 + GRAV * dur * dur / 2) / dur;
    return t => [x0 + vx * t, y0 - vy * t + GRAV * t * t / 2];
  };
  // jump to (x1, y1); if the arc would clip a wall, hang a little longer (more height, same gravity)
  const jumpTo = (x1, y1, dur) => {
    let d = dur, at = arc(x, y, x1, y1, d);
    const blocked = f => { for (let t = 0; t <= d; t += 1 / 240){ const [px, py] = f(t); if (clips(px, py)) return true; } return false; };
    while (d < 1.2 && blocked(at)){ d += .01; at = arc(x, y, x1, y1, d); }
    segs.push({dur: d, at, air: true});
    x = x1; y = y1;
  };

  // ease from standing to run speed
  { const x0 = x, yy = y; segs.push({dur: ACC_T, at: t => [x0 + VX * t * t / (2 * ACC_T), yy], air: false}); x += VX * ACC_T / 2; }

  for (let j = 1; j < land.length; j++){
    const a = land[j - 1], b = land[j], ya = top(a), yb = top(b);
    if (b === a + 1 && ya === yb){ runTo(cx(b)); continue; }
    if (b === a + 1 && yb < ya){
      // hop up: rise to HOP_MARGIN above the step, come down onto it; take off early enough to land on it
      const dur = Math.sqrt(2 * (ya - yb + HOP_MARGIN) / GRAV) + Math.sqrt(2 * HOP_MARGIN / GRAV);
      const xt = Math.max(x, lo(b) - VX * dur);
      runTo(xt);
      jumpTo(Math.min(Math.max(xt + VX * dur, lo(b)), hi(b)), yb, dur);
    } else if (b === a + 1){
      // run off the ledge and fall; steer in the air so the landing stays on the block
      runTo(Math.max(x, xs(a) + P + HALF));               // step off once the body clears the edge
      const dur = Math.sqrt(2 * (yb - ya) / GRAV);
      jumpTo(Math.max(Math.min(x + VX * dur, hi(b)), x + 1), yb, dur);
    } else {
      // pit: jump from the edge; if the gap is too long to clear at run speed under APEX_MAX, sprint
      runTo(Math.max(x, xs(a) + P - HALF));
      const xl = Math.max(lo(b), x + 1);
      let dur = (xl - x) / VX;
      const vy = (y - yb + GRAV * dur * dur / 2) / dur;
      const apex = Math.max(APEX_MAX, y - yb + HOP_MARGIN);
      if (vy * vy / (2 * GRAV) > apex){
        const vyMax = Math.sqrt(2 * GRAV * apex);
        dur = vyMax / GRAV + Math.sqrt(2 * (yb - (y - apex)) / GRAV);
      }
      jumpTo(xl, yb, dur);
    }
  }
  // brake into the flag
  runTo(Math.max(x, stopX - STOP_D));
  if (stopX > x){
    const x0 = x, yy = y, dur = 2 * (stopX - x0) / VX;
    segs.push({dur, at: t => [x0 + VX * t - VX * t * t / (2 * dur), yy], air: false});
    x = stopX;
  }
  const XS = segs[0].at(0)[0], XE = x, YE = y;

  const RUN = segs.reduce((s, g) => s + g.dur, 0), T = HOLD0 + RUN + HOLD1;
  const tS = HOLD0 / T, tE = (HOLD0 + RUN) / T, tH = tE + HOP / T;

  // sample at 60 fps
  const samples = [], landings = [];
  let clock = 0;
  for (const sg of segs){
    const pose = sg.air && sg.dur >= MIN_POSE;
    for (let t = 0; t < sg.dur; t += 1 / 60){ const [sx, sy] = sg.at(t); samples.push({t: (HOLD0 + clock + t) / T, x: sx, y: sy, air: pose}); }
    clock += sg.dur;
    if (sg.air && sg.dur > .2){ const [lx, ly] = sg.at(sg.dur); landings.push({x: lx, y: ly, t: (HOLD0 + clock) / T}); }
  }
  samples.push({t: tE, x: XE, y: YE, air: false});
  const tAt = X => { const s = samples.find(s => s.x >= X); return s ? s.t : tE; };

  // self-check: feet never sink into a column under the hero's body
  const sunk = samples.filter(s => clips(s.x, s.y - 1));
  if (sunk.length) console.warn(`physics: ${sunk.length} samples clip into terrain`, process.env.DEBUG ? sunk.map(s => `${Math.floor((s.x - X0) / P)}:${s.air ? "air" : "gnd"}:${(s.y).toFixed(0)}`).join(" ") : "");
  const loop = {dur: T.toFixed(3) + "s", repeatCount: "indefinite"};
  const anim = (parent, attr, values, times, mode) => el("animate", Object.assign({attributeName: attr, values: values.join(";"), keyTimes: times.map(f5).join(";"), calcMode: mode || "linear"}, loop), parent);
  const animT = (parent, values, times) => el("animateTransform", Object.assign({attributeName: "transform", type: "translate", values: values.join(";"), keyTimes: times.map(f5).join(";")}, loop), parent);

  // ---------- document ----------
  const svg = el("svg", {xmlns: "http://www.w3.org/2000/svg", viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": "A year of Aryan Siddiqui's GitHub contributions as a platformer level"});
  const style = el("style", {}, svg);
  style.text = `@font-face{font-family:"PS2P";src:url(data:font/woff2;base64,${FONT}) format("woff2")}
svg{${THEMES[themeName]}--pixel:"PS2P",monospace}
.px{shape-rendering:crispEdges}
.tw{animation:tw 2.6s steps(2,end) infinite}
@keyframes tw{0%,100%{opacity:1}50%{opacity:.25}}`;
  const defs = el("defs", {}, svg);
  const sky = el("linearGradient", {id: "sky", x1: 0, y1: 0, x2: 0, y2: 1}, defs);
  el("stop", {offset: 0, style: "stop-color:var(--sky-1)"}, sky);
  el("stop", {offset: 1, style: "stop-color:var(--sky-2)"}, sky);
  el("rect", {x: 0, y: 0, width: W, height: H, rx: 10}, el("clipPath", {id: "scene"}, defs));

  const TILE_C = {h: "var(--grass-hi)", G: "var(--grass)", g: "var(--grass-dk)", D: "var(--dirt)", d: "var(--dirt-dk)", l: "var(--dirt-lt)"};
  pix(["hhhhhhhhhh", "GGhGGGGhGG", "GGGGGGGGGG", "gGGgGGgGGg", "DgDDgDDgDd", "DDDDDDDDDd", "DdDDDlDDDd", "DDDDDDDDDd", "DDlDDDdDDd", "dddddddddd"], TILE_C, defs, 2, 0, 0, {id: "t-grass"});
  pix(["DDDDDDDDDd", "DlDDDDdDDd", "DDDDDDDDDd", "DDDdDDDDDd", "DDDDDDDlDd", "DdDDDDDDDd", "DDDDlDDDDd", "DDDDDDDdDd", "DlDDDDDDDd", "dddddddddd"], TILE_C, defs, 2, 0, 0, {id: "t-dirt"});

  const root = el("g", {"clip-path": "url(#scene)"}, svg);
  el("rect", {width: W, height: H, fill: "url(#sky)"}, root);

  // night sky
  const stars = el("g", {style: "opacity:var(--star-op)", class: "px"}, root);
  for (let i = 0; i < 70; i++){
    const attrs = {x: Math.round(rng() * W / 2) * 2, y: Math.round(rng() * 150) * 2, width: 2, height: 2, fill: "#ffffff", opacity: (.4 + rng() * .6).toFixed(2)};
    if (rng() < .4){ attrs.class = "tw"; attrs.style = `animation-delay:${(-rng() * 2.6).toFixed(2)}s`; }
    el("rect", attrs, stars);
  }
  const moon = raster((X, Y) => ((X - 640) ** 2 + (Y - 64) ** 2 < 18 ** 2 && (X - 650) ** 2 + (Y - 58) ** 2 > 15 ** 2) ? "m" : null, 616, 40, 664, 88, 3);
  el("path", {d: moon.m, fill: "#fff3c4", style: "opacity:var(--moon-op)", class: "px"}, root);

  // clouds
  const drift = el("g", {}, root);
  el("animateTransform", {attributeName: "transform", type: "translate", values: "0 0;-1200 0", dur: "120s", repeatCount: "indefinite"}, drift);
  [[140, 172, 1], [430, 158, .8], [760, 186, 1.15], [1010, 162, .85]].forEach(([cxp, cyp, s]) => {
    const circles = [[0, 0, 12], [15, -9, 16], [32, -3, 13], [46, 2, 10]].map(([dx, dy, r]) => [cxp + dx * s, cyp + dy * s, r * s]);
    const bottom = cyp + 9 * s;
    const test = (X, Y) => (Y <= bottom && circles.some(([a, b, r]) => (X - a) ** 2 + (Y - b) ** 2 < r * r)) ? (Y > bottom - 7 ? "s" : "c") : null;
    const cells = raster(test, cxp - 20 * s, cyp - 30 * s, cxp + 60 * s, bottom + 4, 4);
    [0, 1200].forEach(off => {
      const g = el("g", {transform: `translate(${off} 0)`, class: "px"}, drift);
      if (cells.c) el("path", {d: cells.c, fill: "var(--cloud)"}, g);
      if (cells.s) el("path", {d: cells.s, fill: "var(--cloud-sh)"}, g);
    });
  });

  // hills
  function hill(cxp, r, color, rim){
    const test = (X, Y) => {
      const d2 = (X - cxp) ** 2 + (Y - H) ** 2;
      if (d2 >= r * r) return null;
      if (rim && d2 > (r - 6) ** 2 && X < cxp + r * .2) return "r";
      return "b";
    };
    const cells = raster(test, cxp - r, H - r, cxp + r, H, 4);
    const g = el("g", {class: "px"}, root);
    if (cells.b) el("path", {d: cells.b, fill: color}, g);
    if (cells.r) el("path", {d: cells.r, fill: "var(--hill-hi)"}, g);
  }
  [[120, 150], [470, 175], [860, 160], [1180, 140]].forEach(([c, r]) => hill(c, r, "var(--hill-far)", false));
  [[300, 96], [640, 112], [1000, 84]].forEach(([c, r]) => hill(c, r, "var(--hill)", true));

  // terrain
  const terrain = el("g", {}, root);
  for (let i = 0; i < N; i++) for (let k = 0; k < heights[i]; k++)
    el("use", {href: k === heights[i] - 1 ? "#t-grass" : "#t-dirt", x: xs(i), y: GROUND - (k + 1) * P}, terrain);

  // timeline strip
  const MON = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const monthOf = i => new Date(weeks[i].date + "T00:00:00Z").getUTCMonth();
  const band = el("g", {}, root);
  el("rect", {x: 0, y: GROUND, width: W, height: H - GROUND, fill: "var(--band)"}, band);
  el("rect", {x: 0, y: GROUND, width: W, height: 2, fill: "var(--band-hi)"}, band);
  let spanStart = 0;
  for (let i = 1; i <= N; i++){
    if (i < N && monthOf(i) === monthOf(spanStart)) continue;
    const mid = (xs(spanStart) + xs(i - 1) + P) / 2;
    if (i - spanStart >= 2) txt(band, mid, GROUND + 16, MON[monthOf(spanStart)], {"text-anchor": "middle", fill: "var(--band-fg)", style: "font:8px var(--pixel)"});
    if (spanStart > 0) el("rect", {x: xs(spanStart) - 1, y: GROUND + 2, width: 2, height: 6, fill: "var(--band-tick)", class: "px"}, band);
    spanStart = i;
  }

  // coins over the best week of each month
  const COIN = {
    wide: [".oooo.", "oYYYyo", "oYWYyo", "oYWYyo", "oYWYyo", "oYWYyo", "oYYyyo", ".oooo."],
    mid:  [".oo.", "oYyo", "oWyo", "oWyo", "oWyo", "oWyo", "oYyo", ".oo."],
    thin: ["oo", "oy", "oy", "oy", "oy", "oy", "oy", "oo"]
  };
  const COIN_C = {o: "#3a2408", Y: "#ffcf3f", y: "#e08d1a", W: "#fff6cc"};
  const STAR = ["..W..", "..W..", "WWWWW", "..W..", "..W.."];
  const best = {};
  for (let i = 0; i < lastLand; i++){
    const m = monthOf(i);
    if (counts[i] > 0 && (best[m] === undefined || counts[i] > counts[best[m]])) best[m] = i;
  }
  const coinLayer = el("g", {}, root);
  Object.values(best).sort((a, b) => a - b).forEach(i => {
    const tc = tAt(Math.max(cx(i) - 10, XS));
    const g = el("g", {transform: `translate(${cx(i)} ${top(i) - 26})`}, coinLayer);
    const pop = el("g", {}, g);
    animT(pop, ["0 0", "0 0", "0 -22", "0 -22", "0 0"], [0, tc, tc + .025, .995, 1]);
    anim(pop, "opacity", [1, 1, 0, 0, 1], [0, tc, tc + .025, .995, 1]);
    [["wide", "1;0;0;0"], ["mid", "0;1;0;1"], ["thin", "0;0;1;0"]].forEach(([name, vals]) => {
      const w = COIN[name][0].length;
      const fg = pix(COIN[name], COIN_C, pop, PX, -w * PX / 2, -8, {opacity: vals[0]});
      el("animate", {attributeName: "opacity", values: vals, calcMode: "discrete", dur: ".8s", repeatCount: "indefinite"}, fg);
    });
    const star = pix(STAR, {W: "#ffffff"}, g, 2, -5, -26, {opacity: 0});
    anim(star, "opacity", [0, 0, 1, 0, 0], [0, tc + .012, tc + .018, tc + .035, 1]);
    const num = el("g", {opacity: 0}, g);
    txt(num, 1, -21, "+" + counts[i], {"text-anchor": "middle", fill: "var(--hud-sh)", style: "font:9px var(--pixel)"});
    txt(num, 0, -22, "+" + counts[i], {"text-anchor": "middle", fill: "#ffd23f", style: "font:9px var(--pixel)"});
    animT(num, ["0 0", "0 0", "0 -14", "0 -14"], [0, tc, tc + .07, 1]);
    anim(num, "opacity", [0, 0, 1, 1, 0, 0], [0, tc, tc + .006, tc + .06, tc + .08, 1]);
  });

  // goal flag at the latest week
  // the pole stands on the ground just past the latest column, so the hero lands clear of it
  const poleX = xs(lastLand) + P + 6, poleTop = YE - 66;
  const goal = el("g", {class: "px"}, root);
  el("rect", {x: poleX - 1.5, y: poleTop, width: 3, height: GROUND - poleTop, fill: "var(--pole)"}, goal);
  el("rect", {x: poleX + .5, y: poleTop, width: 1, height: GROUND - poleTop, fill: "var(--pole-dk)"}, goal);
  pix([".oo.", "oWWo", "oWwo", ".oo."], {o: "#1b1222", W: "#ffffff", w: "#c9cfdb"}, goal, 2, poleX - 4, poleTop - 8);
  const flagG = el("g", {}, goal);
  pix(["RRRR........", "RRRRRRR.....", "RRWWRRRRRR..", "RWWWWRRRRRRR", "rWWWWrrrrrrr", "rrWWrrrrrr..", "rrrrrrr.....", "rrrr........"],
      {R: "#e0303f", r: "#a8172a", W: "#ffffff"}, flagG, 2, poleX + 1.5, YE - 26);
  animT(flagG, ["0 0", "0 0", "0 -36", "0 -36", "0 0"], [0, tE, tE + .05, .995, 1]);
  txt(root, poleX + 1, poleTop - 15, "TODAY", {"text-anchor": "middle", fill: "var(--hud-sh)", style: "font:7px var(--pixel)"});
  txt(root, poleX, poleTop - 16, "TODAY", {"text-anchor": "middle", fill: "var(--hud)", style: "font:7px var(--pixel)"});

  // landing puffs
  const puffs = el("g", {}, root);
  landings.forEach(l => {
    const tl = l.t;
    [[-1, -14], [1, 4]].forEach(([dir, ox]) => {
      const w = el("g", {}, puffs);
      const p = pix([".WW.", "WWWW", ".WW."], {W: "#ffffff"}, w, 1.5, l.x + ox, l.y - 5, {opacity: 0});
      animT(w, ["0 0", "0 0", `${dir * 9} -4`, `${dir * 9} -4`], [0, tl, tl + .03, 1]);
      anim(p, "opacity", [0, 0, .9, 0, 0], [0, tl, tl + .004, tl + .03, 1]);
    });
  });

  // hero
  const HERO_C = {o: "#1b1222", N: "#2a3f8f", n: "#18275e", H: "#2a1a14", S: "#c98b5e", s: "#9a6440", E: "#1b1222",
                  R: "#d42a3c", r: "#8f1426", P: "#3b3f4c", p: "#272a33", W: "#f5f5f5"};
  const HEAD = [".....oooooo.....", "....oNNNNNNo....", "...oNNNNNNNNooo.", "...onnnnnnnnnnno", "...oHHSSSSESo...", "...oHSSSSSSSSo..", "....osSSSSSSo..."];
  const TORSO = ["....orRRRRRo....", "...orRRRRRRRo..."];
  const FRAMES = {
    idle: HEAD.concat(TORSO, ["...orrRRRRRSo...", "...orrRRRRRRo...", "....oPPPPPPo....", "....oPPpPPPo....", "....oPPooPPo....", "...oWWWooWWWo...", "...oooo..oooo..."]),
    run1: HEAD.concat(TORSO, ["...orrRRRRRRoSo.", "...orrRRRRRRo...", "...oPPPPPPPo....", "..oPPPo.oPPPo...", ".oPPo....oPPo...", "oWWo......oWWWo.", "ooo.......oooo.."]),
    run2: HEAD.concat(TORSO, ["...orrRRRSRRo...", "...orrRRRRRRo...", "....oPPPPPPo....", ".....oPPPPo.....", ".....oPPoPo.....", "....oWWWWWo.....", "....ooooooo....."]),
    run3: HEAD.concat(TORSO, ["..oSorRRRRRRo...", "...orrRRRRRRo...", "....oPPPPPPPo...", "...oPPPo.oPPo...", "..oWWWo...oPPo..", "..oooo....oWWWo.", "..........oooo.."]),
    jump: HEAD.concat(["....orRRRRRoSSo.", "...orRRRRRRRRo..", "..oSorrRRRRRo...", "...orrRRRRRRo...", "...oPPPPPPPo....", "..oPPPPoPPPo....", ".oWWWoo.oPPo....", ".oooo...oWWWo...", ".........oooo..."])
  };
  const hero = el("g", {}, root);
  const body = el("g", {transform: `translate(${-8 * PX} ${-16 * PX})`}, hero);
  const idleG = pix(FRAMES.idle, HERO_C, body, PX, 0, 0, {opacity: 1});
  const runG = el("g", {opacity: 0}, body);
  [["run1", "1;0;0;0"], ["run2", "0;1;0;1"], ["run3", "0;0;1;0"]].forEach(([name, vals]) => {
    const g = pix(FRAMES[name], HERO_C, runG, PX, 0, 0, {opacity: vals[0]});
    el("animate", {attributeName: "opacity", values: vals, calcMode: "discrete", dur: ".3s", repeatCount: "indefinite"}, g);
  });
  const jumpG = pix(FRAMES.jump, HERO_C, body, PX, 0, 0, {opacity: 0});

  const changes = [{t: 0, s: "idle"}];
  const push = (t, s) => { const last = changes[changes.length - 1]; if (last.s === s) return; if (Math.abs(last.t - t) < 1e-6) last.s = s; else changes.push({t, s}); };
  samples.forEach(sm => push(sm.t, sm.air ? "air" : "run"));
  push(tE, "air"); push(tH, "idle");
  [["idle", idleG], ["run", runG], ["air", jumpG]].forEach(([name, g]) => anim(g, "opacity", changes.map(c => c.s === name ? 1 : 0), changes.map(c => c.t), "discrete"));

  const mv = [[samples[0].x, samples[0].y]], mt = [0];
  samples.forEach(s => { if (s.t > mt[mt.length - 1]){ mv.push([s.x, s.y]); mt.push(s.t); } });
  // victory hop under the same gravity
  const hopVy = GRAV * HOP / 2;
  for (let k = 1; k <= 24; k++){ const tt = k / 24 * HOP; mv.push([XE, YE - hopVy * tt + GRAV * tt * tt / 2]); mt.push(tE + tt / T); }
  mv.push([XE, YE]); mt.push(1);
  hero.attrs.transform = `translate(${r1(mv[0][0])} ${r1(mv[0][1])})`;
  el("animateMotion", Object.assign({values: mv.map(p => r1(p[0] - mv[0][0]) + "," + r1(p[1] - mv[0][1])).join(";"), keyTimes: mt.map(f5).join(";"), calcMode: "linear"}, loop), hero);

  // HUD
  const hud = el("g", {}, root);
  const hudText = (x, y, s, size, attrs) => {
    const style = `font:${size}px var(--pixel)`;
    txt(hud, x + 2, y + 2, s, Object.assign({fill: "var(--hud-sh)", style}, attrs || {}));
    return txt(hud, x, y, s, Object.assign({fill: "var(--hud)", style}, attrs || {}));
  };
  hudText(48, 58, "ARYAN SIDDIQUI", 22);
  hudText(50, 84, "STANFORD AI LAB", 8);
  hudText(50, 112, "EACH COLUMN = 1 WEEK", 7);
  el("use", {href: "#t-grass", x: 0, y: 0, transform: "translate(208 103) scale(.6)"}, hud);
  hudText(224, 112, `= ${PER_BLOCK} CONTRIBUTION${PER_BLOCK === 1 ? "" : "S"}`, 7);

  const counterText = (x, size, steps) => steps.forEach((st, k) => {
    const end = k + 1 < steps.length ? steps[k + 1].t : .995;
    if (k > 0 && end <= st.t) return;
    const g = el("g", {opacity: k === 0 ? 1 : 0}, hud);
    txt(g, x + 2, 76, st.s, {fill: "var(--hud-sh)", style: `font:${size}px var(--pixel)`});
    txt(g, x, 74, st.s, {fill: "var(--hud)", style: `font:${size}px var(--pixel)`});
    if (k === 0) anim(g, "opacity", [1, 0, 1], [0, end, .995], "discrete");
    else anim(g, "opacity", [0, 1, 0], [0, st.t, end], "discrete");
  });
  const crossT = i => tAt(Math.min(Math.max(xs(i) + 4, XS), XE));
  hudText(800, 48, "WEEK", 9);
  counterText(800, 14, [{t: 0, s: "01"}].concat(heights.slice(1).map((_, k) => ({t: crossT(k + 1), s: String(k + 2).padStart(2, "0")}))));
  hudText(920, 48, "CONTRIBUTIONS", 9);
  const digits = Math.max(4, String(cal.totalContributions).length);
  let run = 0;
  const cSteps = [{t: 0, s: "0".repeat(digits)}];
  counts.forEach((c, i) => { if (!c) return; run += c; cSteps.push({t: crossT(i), s: String(run).padStart(digits, "0")}); });
  counterText(920, 14, cSteps);

  const banner = el("g", {opacity: 0}, hud);
  txt(banner, 603, 183, "YEAR CLEAR!", {"text-anchor": "middle", fill: "var(--hud-sh)", style: "font:26px var(--pixel)"});
  txt(banner, 600, 180, "YEAR CLEAR!", {"text-anchor": "middle", fill: "#ffd23f", style: "font:26px var(--pixel)"});
  anim(banner, "opacity", [0, 1, 0], [0, tH, .995], "discrete");

  return ser(svg);
}

// ---------- bio card: the README text, set in Space Mono (GitHub can't change README fonts) ----------
const MONO = ["Regular", "Bold"].map(w => readFileSync(new URL(`SpaceMono-${w}-latin.woff2`, HERE)).toString("base64"));
const BIO = [
  // each paragraph: lines of [text, bold?] runs
  [[["I research agents and reinforcement learning to build real-world"]],
   [["evaluations at the "], ["Stanford AI Lab", 1], [", under "], ["John Yang", 1], [" (SWE-bench)."]]],
  [[["I also love to build consumer products that feel like "], ["magic", 1], ["."]]]
];
function buildBio(theme){
  const fg = theme === "night" ? "#e6edf3" : "#1f2328";
  const COIN = [".oooo.", "oYYYyo", "oYWYyo", "oYWYyo", "oYWYyo", "oYWYyo", "oYYyyo", ".oooo."];
  const C = {o: "#3a2408", Y: "#ffcf3f", y: "#e08d1a", W: "#fff6cc"};
  const coin = (x, y) => COIN.flatMap((row, r) => [...row].map((ch, c) => ch === "." ? "" : `<rect x="${x + c * 2.5}" y="${y + r * 2.5}" width="2.5" height="2.5" fill="${C[ch]}"/>`)).join("");
  const PAD_TOP = 40, PAD_BOTTOM = 36;          // breathing room; GitHub strips <br> spacing
  let body = "", y = PAD_TOP + 24;
  BIO.forEach(par => {
    body += coin(2, y - 18);
    par.forEach(line => {
      body += `<text x="36" y="${y}">${line.map(([t, b]) => b ? `<tspan font-weight="700">${esc(t)}</tspan>` : esc(t)).join("")}</text>`;
      y += 36;
    });
    y += 18;
  });
  const h = y - 36 - 18 + 10 + PAD_BOTTOM;
  const alt = BIO.map(p => p.map(l => l.map(r => r[0]).join("")).join(" ")).join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 ${h}" width="1200" height="${h}" role="img" aria-label="${esc(alt)}">` +
    `<style>@font-face{font-family:"SM";src:url(data:font/woff2;base64,${MONO[0]}) format("woff2");font-weight:400}` +
    `@font-face{font-family:"SM";src:url(data:font/woff2;base64,${MONO[1]}) format("woff2");font-weight:700}` +
    `text{font:400 24px "SM",ui-monospace,monospace;fill:${fg}}rect{shape-rendering:crispEdges}</style>${body}</svg>`;
}

mkdirSync("dist", {recursive: true});
for (const theme of ["day", "night"]){
  const out = build(theme);
  writeFileSync(`dist/${theme}.svg`, out);
  console.log(`dist/${theme}.svg ${(out.length / 1024).toFixed(0)} KB`);
  writeFileSync(`dist/bio-${theme}.svg`, buildBio(theme));
}
