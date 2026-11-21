// Paper confetti on a canvas: gravity, air drag, wobble and a flip that shows each piece's
// back in a darker shade. No dependency; it stops by itself when the last piece is gone.

function shade(hex, factor) {
  const value = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#f56b20';
  return '#' + [1, 3, 5].map(i => Math.max(0, Math.min(255, Math.round(parseInt(value.slice(i, i + 2), 16) * factor))).toString(16).padStart(2, '0')).join('');
}

// Mixes a hex color with white: `amount` 0 keeps it, 1 is white.
export function tint(hex, amount) {
  const value = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#f56b20';
  return '#' + [1, 3, 5].map(i => Math.round(parseInt(value.slice(i, i + 2), 16) + (255 - parseInt(value.slice(i, i + 2), 16)) * amount).toString(16).padStart(2, '0')).join('');
}

export function createConfetti(canvas, colors) {
  const context = canvas.getContext('2d');
  const pieces = [];
  let frame = 0;
  let width = 0;
  let height = 0;
  let last = 0;

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth; height = canvas.clientHeight;
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function add({ x, y, angle, spread, speed, count }) {
    const scale = Math.min(1.25, Math.max(.75, width / 900));
    for (let index = 0; index < count; index += 1) {
      const direction = angle + (Math.random() - .5) * spread;
      const velocity = speed * scale * (.55 + Math.random() * .6);
      const color = colors[Math.floor(Math.random() * colors.length)];
      pieces.push({
        x: x * width, y: y * height,
        vx: Math.cos(direction) * velocity, vy: Math.sin(direction) * velocity,
        size: (7 + Math.random() * 7) * scale, ratio: Math.random() < .3 ? 2.6 : 1.5,
        round: Math.random() < .18,
        rotation: Math.random() * Math.PI * 2, spin: (Math.random() - .5) * .3,
        flip: Math.random() * Math.PI * 2, flipSpeed: .08 + Math.random() * .14,
        wobble: Math.random() * Math.PI * 2, wobbleSpeed: .05 + Math.random() * .08,
        color, back: shade(color, .72), life: 0,
      });
    }
    if (!frame) { last = performance.now(); frame = requestAnimationFrame(tick); }
  }

  function tick(now) {
    // Frame time in 60 fps steps, so slow devices fall at the same speed.
    const step = Math.min(3, (now - last) / 16.67);
    last = now;
    context.clearRect(0, 0, width, height);
    for (let index = pieces.length - 1; index >= 0; index -= 1) {
      const piece = pieces[index];
      piece.life += step;
      piece.vx *= .985 ** step; piece.vy = piece.vy * .985 ** step + .32 * step;
      piece.wobble += piece.wobbleSpeed * step;
      piece.x += (piece.vx + Math.cos(piece.wobble) * 1.1) * step; piece.y += piece.vy * step;
      piece.rotation += piece.spin * step; piece.flip += piece.flipSpeed * step;
      if (piece.y > height + 40 || piece.life > 420) { pieces.splice(index, 1); continue; }
      const flip = Math.cos(piece.flip);
      context.save();
      context.translate(piece.x, piece.y);
      context.rotate(piece.rotation);
      context.scale(1, flip);
      context.globalAlpha = Math.min(1, (420 - piece.life) / 60);
      context.fillStyle = flip > 0 ? piece.color : piece.back;
      if (piece.round) { context.beginPath(); context.arc(0, 0, piece.size / 2, 0, Math.PI * 2); context.fill(); }
      else context.fillRect(-piece.size / 2, -piece.size * piece.ratio / 2, piece.size, piece.size * piece.ratio);
      context.restore();
    }
    frame = pieces.length ? requestAnimationFrame(tick) : 0;
  }

  resize();
  window.addEventListener('resize', resize);
  return {
    // A burst from the center and two cannons from the bottom corners.
    burst(x = .5, y = .42) { add({ x, y, angle: -Math.PI / 2, spread: Math.PI * 2, speed: 17, count: 110 }); },
    cannons() {
      add({ x: -.02, y: 1, angle: -Math.PI / 3, spread: .55, speed: 30, count: 60 });
      add({ x: 1.02, y: 1, angle: -Math.PI * 2 / 3, spread: .55, speed: 30, count: 60 });
    },
    destroy() { cancelAnimationFrame(frame); frame = 0; pieces.length = 0; window.removeEventListener('resize', resize); },
  };
}
