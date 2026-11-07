// Mailab segment preview: draws the notes Mailab's own parser produced on a maimai-style ring.
// No audio. Tap / Hold / Touch positions follow the 8-button and sensor layout; curved Slide
// paths (< > ^ p q pp qq s z w V) are drawn as approximate geometry, not judged trajectories.

const TAU = Math.PI * 2;
const laneAngle = k => (-90 + 22.5 + 45 * k) * Math.PI / 180;
const edgeAngle = k => (-90 + 45 * k) * Math.PI / 180;
const polar = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];
const sensor = pos => {
 if (/^[1-8]$/.test(pos)) return polar(1, laneAngle(+pos - 1));
 if (pos[0] === 'C') return [0, 0];
 const k = +pos[1] - 1;
 return {A: polar(.84, laneAngle(k)), B: polar(.46, laneAngle(k)), D: polar(.84, edgeAngle(k)), E: polar(.62, edgeAngle(k))}[pos[0]];
};
const colors = {tap: '#f0468f', hold: '#f0468f', break: '#f07a12', each: '#e2b100', slide: '#1f8fff', touch: '#13a59a', crossing: '#7a5cf0', context: '#9aa5c2'};

function arc(points, a0, a1, r, dir) {
 let delta = a1 - a0;
 if (dir > 0) while (delta <= 0) delta += TAU;
 else while (delta >= 0) delta -= TAU;
 const steps = Math.max(4, Math.ceil(Math.abs(delta) / .12));
 for (let i = 1; i <= steps; i++) points.push(polar(r, a0 + delta * i / steps));
}
// Returns the polyline (unit radius) of one parsed slide note.
export function slidePoints(note) {
 let from = +note.pos - 1;
 const points = [polar(1, laneAngle(from))];
 for (const step of note.path) {
  const to = +step.end - 1, a0 = laneAngle(from), a1 = laneAngle(to);
  const upper = [0, 1, 6, 7].includes(from);
  switch (step.shape) {
   case '-': points.push(polar(1, a1)); break;
   case '>': arc(points, a0, a1, 1, upper ? 1 : -1); break;
   case '<': arc(points, a0, a1, 1, upper ? -1 : 1); break;
   case '^': { const d = ((to - from) % 8 + 8) % 8; arc(points, a0, a1, 1, d <= 4 ? 1 : -1); break; }
   case 'v': points.push([0, 0], polar(1, a1)); break;
   case 'V': points.push(polar(1, laneAngle(+step.turn - 1)), polar(1, a1)); break;
   case 'p': case 'q': case 'pp': case 'qq': {
    const dir = step.shape[0] === 'q' ? 1 : -1, r = step.shape.length > 1 ? .55 : .4;
    points.push(polar(r, a0 + dir * Math.PI / 2));
    arc(points, a0 + dir * Math.PI / 2, a1 - dir * Math.PI / 2, r, dir);
    points.push(polar(1, a1));
    break;
   }
   case 's': case 'z': {
    const turn = step.shape === 's' ? -1 : 1;
    points.push(polar(.42, a0 + Math.PI + turn * Math.PI / 2), polar(.42, a0 + turn * Math.PI / 2), polar(1, a1));
    break;
   }
   case 'w': points.push(polar(1, a1)); break;
   default: points.push(polar(1, a1));
  }
  from = to;
 }
 return points;
}
const pathLength = pts => pts.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
function pointAt(pts, fraction) {
 let left = pathLength(pts) * Math.min(1, Math.max(0, fraction));
 for (let i = 1; i < pts.length; i++) {
  const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  if (left <= d) {
   const k = d ? left / d : 0;
   return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
  }
  left -= d;
 }
 return pts.at(-1);
}

export function createPreview({canvas, scrub, playButton, speed, clock, phase, onTime}) {
 const ctx = canvas.getContext('2d');
 let view = null, now = 0, playing = false, last = 0, frame = 0;
 const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

 function size() {
  const css = canvas.clientWidth || 320, dpr = Math.min(3, devicePixelRatio || 1);
  if (canvas.width !== Math.round(css * dpr)) { canvas.width = canvas.height = Math.round(css * dpr); }
  return {px: canvas.width, dpr};
 }
 function draw() {
  const {px} = size();
  const c = px / 2, R = px * .41, r0 = R * .22, unit = px / 320;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, px, px);
  ctx.fillStyle = '#10163a';
  ctx.beginPath(); ctx.arc(c, c, px * .49, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#e8ecff'; ctx.lineWidth = 2 * unit;
  ctx.beginPath(); ctx.arc(c, c, R, 0, TAU); ctx.stroke();
  ctx.strokeStyle = '#34407a'; ctx.beginPath(); ctx.arc(c, c, r0, 0, TAU); ctx.stroke();
  ctx.font = `${11 * unit}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let k = 0; k < 8; k++) {
   const [x, y] = polar(R, laneAngle(k)), [lx, ly] = polar(R + 15 * unit, laneAngle(k));
   ctx.fillStyle = '#c9d2f5'; ctx.beginPath(); ctx.arc(c + x, c + y, 5 * unit, 0, TAU); ctx.fill();
   ctx.fillText(String(k + 1), c + lx, c + ly);
  }
  if (!view) return;
  const T = view.approach;
  const slots = new Map();
  for (const {note} of view.notes) slots.set(note.slot, (slots.get(note.slot) ?? 0) + (note.sharedHead ? 0 : 1));
  const colorOf = ({note, role}) => role === 'target' ? (note.break ? colors.break : note.kind === 'touch' ? colors.touch : note.kind === 'slide' ? colors.slide : slots.get(note.slot) > 1 ? colors.each : colors[note.kind])
   : role === 'crossing' ? colors.crossing : colors.context;
  const radiusAt = hit => r0 + (R - r0) * Math.min(1, Math.max(0, 1 - (hit - now) / T));
  const order = [...view.notes].sort((a, b) => (a.role === 'target') - (b.role === 'target'));
  for (const item of order) {
   const {note, role} = item, color = colorOf(item);
   const end = note.t + note.wait + note.duration;
   if (now < note.t - T || now > end + .15) continue;
   ctx.globalAlpha = role === 'context' || role === 'inside' ? .6 : 1;
   ctx.strokeStyle = ctx.fillStyle = color;
   const outline = () => { if (role === 'target') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * unit; ctx.stroke(); ctx.strokeStyle = color; } };
   if (note.kind === 'touch' || (note.kind === 'hold' && !/^[1-8]$/.test(note.pos))) {
    const [ux, uy] = sensor(note.pos), x = c + ux * R, y = c + uy * R;
    const k = Math.min(1, Math.max(0, (note.t - now) / T)), s = (6 + 14 * k) * unit;
    ctx.lineWidth = 3 * unit;
    ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath(); ctx.stroke(); outline();
    if (note.kind === 'hold' && now >= note.t) { ctx.beginPath(); ctx.arc(x, y, 14 * unit, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, (now - note.t) / note.duration)); ctx.stroke(); }
    continue;
   }
   const a = laneAngle(+note.pos - 1);
   if (note.kind === 'slide') {
    const pts = slidePoints(note).map(([x, y]) => [c + x * R, c + y * R]);
    ctx.save(); ctx.setLineDash([7 * unit, 6 * unit]); ctx.lineWidth = 4 * unit; ctx.globalAlpha *= .55;
    const lines = note.shape === 'w' ? [-1, 0, 1].map(o => slidePoints({...note, path: [{shape: '-', end: String(((+note.end - 1 + o) % 8 + 8) % 8 + 1)}]}).map(([x, y]) => [c + x * R, c + y * R])) : [pts];
    for (const line of lines) { ctx.beginPath(); line.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); }
    ctx.restore();
    const go = note.t + note.wait;
    if (now >= go && now <= end) {
     const [x, y] = pointAt(pts, (now - go) / note.duration);
     star(x, y, 9 * unit); outline();
    }
   }
   if (note.kind === 'slide' && (note.headless || now > note.t + .12)) continue;
   const head = radiusAt(note.t), [hx, hy] = polar(head, a);
   if (note.kind === 'hold') {
    const tail = radiusAt(note.t + note.duration), [tx, ty] = polar(tail, a);
    ctx.lineCap = 'round'; ctx.lineWidth = 12 * unit;
    ctx.beginPath(); ctx.moveTo(c + tx, c + ty); ctx.lineTo(c + hx, c + hy); ctx.stroke();
    ctx.lineCap = 'butt';
    if (role === 'target') { ctx.lineWidth = 2 * unit; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(c + tx, c + ty); ctx.lineTo(c + hx, c + hy); ctx.stroke(); }
    continue;
   }
   if (now > note.t + .12) continue;
   ctx.globalAlpha *= now > note.t ? 1 - (now - note.t) / .12 : 1;
   if (note.kind === 'slide') star(c + hx, c + hy, 10 * unit);
   else { ctx.lineWidth = 5 * unit; ctx.beginPath(); ctx.arc(c + hx, c + hy, 10 * unit, 0, TAU); ctx.stroke(); }
   outline();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff'; ctx.font = `700 ${15 * unit}px system-ui, sans-serif`;
  ctx.fillText(now.toFixed(2) + ' s', c, c - 6 * unit);
  ctx.font = `${11 * unit}px system-ui, sans-serif`; ctx.fillStyle = '#c9d2f5';
  ctx.fillText(label(), c, c + 12 * unit);
 }
 function star(x, y, s) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? s * .45 : s, a = -Math.PI / 2 + i * Math.PI / 5; ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); }
  ctx.closePath(); ctx.fill();
 }
 const label = () => !view ? '' : now < view.targetStart ? '前文' : now <= view.targetEnd ? '目标范围' : '后文';
 function sync() {
  if (!view) return;
  scrub.value = String(now);
  clock.textContent = now.toFixed(2) + ' / ' + view.playEnd.toFixed(2) + ' 秒';
  phase.textContent = label();
  playButton.textContent = playing ? '暂停' : '播放';
  playButton.setAttribute('aria-pressed', String(playing));
  draw();
  onTime?.(now);
 }
 function tick(time) {
  if (!playing) return;
  const dt = Math.min(.1, (time - last) / 1000); last = time;
  now = Math.min(view.playEnd, now + dt * +speed.value);
  if (now >= view.playEnd) playing = false;
  sync();
  if (playing) frame = requestAnimationFrame(tick);
 }
 function play(on) {
  if (!view) return;
  playing = on;
  cancelAnimationFrame(frame);
  if (on) { if (now >= view.playEnd) now = view.playStart; last = performance.now(); frame = requestAnimationFrame(tick); }
  sync();
 }
 scrub.oninput = () => { const t = +scrub.value; play(false); now = t; sync(); };
 playButton.onclick = () => play(!playing);
 addEventListener('resize', () => draw());
 return {
  show(next) {
   view = next;
   scrub.min = String(next.playStart); scrub.max = String(next.playEnd); scrub.step = '0.01';
   const span = next.playEnd - next.playStart, a = (next.targetStart - next.playStart) / span * 100, b = (next.targetEnd - next.playStart) / span * 100;
   scrub.style.setProperty('--target-a', a + '%'); scrub.style.setProperty('--target-b', b + '%');
   now = reduced ? next.targetStart : next.playStart;
   play(!reduced);
  },
  seek(t) { if (!view) return; play(false); now = Math.min(view.playEnd, Math.max(view.playStart, t)); sync(); },
  step(dt) { this.seek(now + dt); },
  replay() { if (!view) return; now = view.playStart; play(true); },
  toggle() { play(!playing); },
  stop() { play(false); },
  get time() { return now; },
 };
}
