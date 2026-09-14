// generate-icons.js — 用 Node.js Canvas 生成 PNG 图标
// 运行：node generate-icons.js
// 依赖：需要安装 canvas 包 (npm install canvas)
// 或者直接使用浏览器打开 icon_source.html 截图

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const sizes = [16, 32, 48, 128];
const outDir = __dirname;

function drawIcon(ctx, size) {
  const s = size;
  const cx = s / 2, cy = s / 2, r = s / 2 - 1;

  // Background circle
  const bgGrad = ctx.createRadialGradient(cx, cy * 0.6, 0, cx, cy, r);
  bgGrad.addColorStop(0, '#1e3a5f');
  bgGrad.addColorStop(1, '#0f172a');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = bgGrad;
  ctx.fill();

  // Water drop
  const dropGrad = ctx.createLinearGradient(s * 0.3, s * 0.1, s * 0.7, s * 0.9);
  dropGrad.addColorStop(0, '#38bdf8');
  dropGrad.addColorStop(0.5, '#3b82f6');
  dropGrad.addColorStop(1, '#6366f1');

  ctx.beginPath();
  const top = s * 0.15;
  const bottom = s * 0.82;
  const left = s * 0.28;
  const right = s * 0.72;
  const midY = s * 0.58;

  // Drop path: pointy top, round bottom
  ctx.moveTo(cx, top);
  ctx.bezierCurveTo(cx, top, left, midY, left, s * 0.62);
  ctx.arc(cx, s * 0.62, cx - left, Math.PI, 0);
  ctx.bezierCurveTo(right, midY, cx, top, cx, top);
  ctx.fillStyle = dropGrad;
  ctx.fill();

  // Shine highlight
  ctx.beginPath();
  ctx.ellipse(cx * 0.82, cy * 0.75, s * 0.07, s * 0.12, -0.35, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(cx * 0.78, cy * 0.68, s * 0.03, s * 0.05, -0.35, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fill();
}

sizes.forEach(size => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  drawIcon(ctx, size);
  const buf = canvas.toBuffer('image/png');
  const outPath = path.join(outDir, `icon${size}.png`);
  fs.writeFileSync(outPath, buf);
  console.log(`Generated: icon${size}.png`);
});

console.log('All icons generated!');
