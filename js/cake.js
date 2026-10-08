/**
 * cake.js — upgraded visuals, shifted up to leave lyric room
 * topTierTop = candleY + candleH (candle sits ON the cake)
 */

const CakeScene = (() => {

  const reveal = { value: 0 };

  function init() {}

  function getGeom(W, H, candleY, candleH) {
    const cx = W * 0.5;
    // Cake top = bottom of candle
    const topTierTop = candleY + candleH;

    // Tiers — moderate heights so stack fits above lyric area
    const tierHTop = clamp(H * 0.080, 34, 56);
    const tierHMid = clamp(H * 0.095, 42, 68);
    const tierHBot = clamp(H * 0.110, 50, 80);

    const hwTop = clamp(W * 0.118, 40, 72);
    const hwMid = clamp(W * 0.170, 58, 102);
    const hwBot = clamp(W * 0.222, 76, 135);

    const yTop  = topTierTop;
    const yMid  = yTop + tierHTop;
    const yBot  = yMid + tierHMid;
    const yBase = yBot + tierHBot;

    return {
      cx,
      tiers: [
        { y0: yTop, y1: yMid,  hw: hwTop, h: tierHTop, idx: 0 },
        { y0: yMid, y1: yBot,  hw: hwMid, h: tierHMid, idx: 1 },
        { y0: yBot, y1: yBase, hw: hwBot, h: tierHBot, idx: 2 },
      ],
      yBase,
      tableY: yBase,
    };
  }

  function draw(ctx, W, H, flicker, candleX, candleY) {
    const t = reveal.value;
    if (t <= 0) return;

    const candleH = clamp(H * 0.07, 32, 52);
    const geom    = getGeom(W, H, candleY, candleH);
    const bri     = 0.82 + flicker * 0.10;
    const ls      = flicker * 2.5;

    ctx.save();
    if (t > 0.05) drawTable(ctx, geom, ss(0.05, 0.26, t) * bri, flicker);
    drawSilhouette(ctx, geom, ss(0, 0.16, t));
    if (t > 0.14) drawFrosting(ctx, geom, ss(0.14, 0.50, t), bri, ls);
    if (t > 0.36) drawTierFaces(ctx, geom, ss(0.36, 0.62, t), bri);
    if (t > 0.38) drawTierDetails(ctx, geom, ss(0.38, 0.70, t), bri);
    if (t > 0.56) drawDecorations(ctx, geom, ss(0.56, 0.86, t), bri, ls);
    if (t > 0.48) drawCandleSheen(ctx, geom, ss(0.48, 1.0, t), bri, flicker, candleX, candleY);
    if (t > 0.76) drawReflection(ctx, geom, ss(0.76, 1.0, t), bri);
    ctx.restore();
  }

  // ── Silhouette ────────────────────────────────────────────────
  function drawSilhouette(ctx, geom, t) {
    if (t <= 0) return;
    ctx.save();
    ctx.globalAlpha = t * 0.95;
    for (const tier of geom.tiers) {
      rr(ctx, geom.cx - tier.hw, tier.y0, tier.hw * 2, tier.h, 7);
      ctx.fillStyle = '#090406';
      ctx.fill();
    }
    ctx.restore();
  }

  // ── Frosting ──────────────────────────────────────────────────
  function drawFrosting(ctx, geom, t, bri, ls) {
    if (t <= 0) return;
    // Warm blush-cream palette
    const BASE = '#f8eaee';
    const MID  = '#eedad e';
    const b = bri * t;

    for (const tier of geom.tiers) {
      const x = geom.cx - tier.hw;
      const y = tier.y0;
      const w = tier.hw * 2;
      const h = tier.h;

      // Left-right candlelight gradient
      const gx = ctx.createLinearGradient(x, y, x + w, y);
      gx.addColorStop(0,    dark(BASE, 0.28 - b*0.10));
      gx.addColorStop(0.25, blend('#f0d8de', BASE, b));
      gx.addColorStop(0.52, blend(BASE, '#fef4f6', b));
      gx.addColorStop(0.78, blend('#f0d8de', BASE, b));
      gx.addColorStop(1,    dark(BASE, 0.38 - b*0.12));
      ctx.save();
      ctx.globalAlpha = t;
      rr(ctx, x, y, w, h, 7);
      ctx.fillStyle = gx; ctx.fill();
      ctx.restore();

      // Top warmth / bottom shadow
      const gy = ctx.createLinearGradient(x, y, x, y + h);
      gy.addColorStop(0,    `rgba(255,225,210,${0.22*b})`);
      gy.addColorStop(0.32, 'rgba(0,0,0,0)');
      gy.addColorStop(1,    `rgba(0,0,0,${0.26*t})`);
      ctx.save();
      ctx.globalAlpha = 1;
      rr(ctx, x, y, w, h, 7);
      ctx.fillStyle = gy; ctx.fill();
      ctx.restore();
    }
  }

  // ── Tier top faces (perspective ledges) ───────────────────────
  function drawTierFaces(ctx, geom, t, bri) {
    if (t <= 0) return;
    const b = bri * t;

    // Only mid and bottom tiers have visible ledges
    [geom.tiers[1], geom.tiers[2]].forEach(tier => {
      const above = geom.tiers[tier.idx - 1];
      const innerHW = above ? above.hw : 0;
      const y = tier.y0;

      ctx.save();
      ctx.globalAlpha = t;

      // Outer ellipse — the fondant top surface of this tier
      const gs = ctx.createRadialGradient(geom.cx, y, 0, geom.cx, y, tier.hw);
      gs.addColorStop(0,   `rgba(255,248,242,${0.92*b})`);
      gs.addColorStop(0.6, `rgba(245,228,234,${0.72*b})`);
      gs.addColorStop(1,   `rgba(220,192,202,${0.52*b})`);
      ctx.beginPath();
      ctx.ellipse(geom.cx, y, tier.hw, tier.hw * 0.115, 0, 0, Math.PI*2);
      ctx.fillStyle = gs; ctx.fill();

      // Shadow ring where upper tier meets this surface
      if (above) {
        ctx.beginPath();
        ctx.ellipse(geom.cx, y, innerHW, innerHW * 0.115, 0, 0, Math.PI*2);
        ctx.fillStyle = `rgba(185,148,162,${0.38*b})`;
        ctx.fill();
      }

      ctx.restore();
    });
  }

  // ── Tier ribbons, pearls, drips ───────────────────────────────
  function drawTierDetails(ctx, geom, t, bri) {
    if (t <= 0) return;
    const b = bri * t;

    for (const tier of geom.tiers) {
      const x = geom.cx - tier.hw;
      const y = tier.y0;
      const w = tier.hw * 2;
      const h = tier.h;

      ctx.save();
      ctx.globalAlpha = t;

      const ribbonH = clamp(h * 0.105, 3.5, 6.5);

      // Top ribbon — blush rose, shaded
      const gr = ctx.createLinearGradient(x, y, x + w, y);
      gr.addColorStop(0,    `rgba(195,115,138,${0.62*b})`);
      gr.addColorStop(0.30, `rgba(228,158,175,${0.92*b})`);
      gr.addColorStop(0.50, `rgba(238,172,188,${0.96*b})`);
      gr.addColorStop(0.70, `rgba(228,158,175,${0.92*b})`);
      gr.addColorStop(1,    `rgba(195,115,138,${0.62*b})`);
      rr(ctx, x, y, w, ribbonH, [5,5,0,0]);
      ctx.fillStyle = gr; ctx.fill();

      // Ribbon highlight
      rr(ctx, x, y, w, ribbonH * 0.38, [5,5,0,0]);
      ctx.fillStyle = `rgba(255,235,242,${0.22*b})`;
      ctx.fill();

      // Bottom ribbon
      rr(ctx, x, y + h - ribbonH, w, ribbonH, [0,0,5,5]);
      ctx.fillStyle = gr; ctx.fill();

      // Pearl string
      const pearlR = clamp(tier.hw * 0.040, 2.0, 4.8);
      const spacing = pearlR * 2.9;
      const pearlY  = y + ribbonH * 0.52;
      const count   = Math.floor(w / spacing);
      const startX  = geom.cx - (count - 1) * spacing * 0.5;
      for (let i = 0; i < count; i++) {
        const px = startX + i * spacing;
        const pg = ctx.createRadialGradient(px-pearlR*0.28, pearlY-pearlR*0.32, 0, px, pearlY, pearlR);
        pg.addColorStop(0,   `rgba(255,253,250,${0.98*b})`);
        pg.addColorStop(0.45,`rgba(244,224,232,${0.84*b})`);
        pg.addColorStop(1,   `rgba(202,158,174,${0.65*b})`);
        ctx.beginPath();
        ctx.arc(px, pearlY, pearlR, 0, Math.PI*2);
        ctx.fillStyle = pg; ctx.fill();
      }

      // Drips — white chocolate, variable heights
      const dripCount  = Math.max(3, Math.floor(tier.hw / 9));
      const dripSpread = tier.hw * 1.65 / dripCount;
      for (let i = 0; i <= dripCount; i++) {
        const dx    = (geom.cx - tier.hw * 0.82) + i * dripSpread;
        const dH    = clamp(h * (0.10 + (Math.sin(i * 2.1 + tier.idx*1.3) * 0.5 + 0.5) * 0.24), 6, h*0.34);
        const dW    = clamp(tier.hw * 0.028, 2, 5);
        const dR    = dW * 0.5;
        ctx.save();
        ctx.globalAlpha = t * 0.68;
        ctx.beginPath();
        ctx.moveTo(dx-dW*0.5, y + ribbonH);
        ctx.lineTo(dx-dW*0.5, y + ribbonH + dH - dR);
        ctx.arc(dx, y + ribbonH + dH - dR, dR, Math.PI, 0, true);
        ctx.lineTo(dx+dW*0.5, y + ribbonH);
        ctx.closePath();
        ctx.fillStyle = `rgba(255,250,254,${0.62*b})`;
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
    }
  }

  // ── Rosettes, dots, bow ───────────────────────────────────────
  function drawDecorations(ctx, geom, t, bri, ls) {
    if (t <= 0) return;
    const b = bri * t;

    // Top tier — 2 flanking rosettes (center is occupied by candle)
    const top = geom.tiers[0];
    [-0.56, 0.56].forEach(xf => {
      drawRosette(ctx, geom.cx + top.hw * xf, top.y0 + 4, clamp(top.hw * 0.20, 7, 13), b, t);
    });

    // Mid tier — 4 rosettes
    const mid = geom.tiers[1];
    const mry = mid.y0 + mid.h * 0.46;
    [-0.65, -0.22, 0.22, 0.65].forEach(xf => {
      drawRosette(ctx, geom.cx + mid.hw * xf, mry, clamp(mid.hw * 0.14, 6, 11), b*0.92, t);
    });

    // Bottom tier — dot pattern 3×6
    const bot = geom.tiers[2];
    const dotR = clamp(bot.hw * 0.024, 2, 4.2);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 6; col++) {
        const dx = (geom.cx - bot.hw * 0.76) + col * (bot.hw * 1.52 / 5);
        const dy = bot.y0 + bot.h * (0.26 + row * 0.28);
        ctx.save();
        ctx.globalAlpha = t * 0.72;
        ctx.beginPath();
        ctx.arc(dx, dy, dotR, 0, Math.PI*2);
        ctx.fillStyle = `rgba(210,152,170,${0.88*b})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(dx-dotR*0.28, dy-dotR*0.30, dotR*0.36, 0, Math.PI*2);
        ctx.fillStyle = `rgba(255,242,248,${0.58*b})`;
        ctx.fill();
        ctx.restore();
      }
    }

    // Bow — top tier, offset right
    drawBow(ctx, geom.cx + top.hw * 0.64, top.y0 + top.h * 0.70, clamp(top.hw * 0.30, 11, 19), b, t);
  }

  // ── Rosette ───────────────────────────────────────────────────
  function drawRosette(ctx, x, y, r, bri, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let i = 0; i < 7; i++) {
      const a = (i/7)*Math.PI*2 - Math.PI*0.5;
      ctx.beginPath();
      ctx.ellipse(x+Math.cos(a)*r*0.50, y+Math.sin(a)*r*0.50, r*0.28, r*0.34, a, 0, Math.PI*2);
      ctx.fillStyle = `rgba(212,136,158,${0.84*bri})`;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(x, y, r*0.26, 0, Math.PI*2);
    ctx.fillStyle = `rgba(234,174,190,${0.94*bri})`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x-r*0.07, y-r*0.09, r*0.09, 0, Math.PI*2);
    ctx.fillStyle = `rgba(255,240,246,${0.80*bri})`;
    ctx.fill();
    ctx.restore();
  }

  // ── Bow ───────────────────────────────────────────────────────
  function drawBow(ctx, x, y, s, bri, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha * 0.92;
    const bc = `rgba(212,120,146,${0.92*bri})`;
    const hi = `rgba(244,190,206,${0.74*bri})`;
    ctx.beginPath();
    ctx.ellipse(x-s*0.52,y,s*0.43,s*0.29,-0.36,0,Math.PI*2);
    ctx.fillStyle=bc; ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x+s*0.52,y,s*0.43,s*0.29,0.36,0,Math.PI*2);
    ctx.fillStyle=bc; ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x,y,s*0.21,s*0.23,0,0,Math.PI*2);
    ctx.fillStyle=`rgba(196,104,130,${0.96*bri})`; ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x-s*0.55,y-s*0.07,s*0.14,s*0.08,-0.36,0,Math.PI*2);
    ctx.fillStyle=hi; ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x+s*0.55,y-s*0.07,s*0.14,s*0.08,0.36,0,Math.PI*2);
    ctx.fillStyle=hi; ctx.fill();
    ctx.restore();
  }

  // ── Candle sheen ──────────────────────────────────────────────
  function drawCandleSheen(ctx, geom, t, bri, flicker, cx, candleY) {
    if (t <= 0) return;
    const cakeTop = geom.tiers[0].y0;
    const cakeH   = geom.yBase - cakeTop;
    const sheenR  = cakeH * 1.5;
    const b       = (0.82 + flicker*0.12) * bri * t;
    const g = ctx.createRadialGradient(cx, candleY, 0, cx, candleY, sheenR);
    g.addColorStop(0,    `rgba(255,200,100,${0.26*b})`);
    g.addColorStop(0.28, `rgba(255,152,45,${0.14*b})`);
    g.addColorStop(0.58, `rgba(198,86,18,${0.06*b})`);
    g.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const tier of geom.tiers) {
      rr(ctx, geom.cx - tier.hw, tier.y0, tier.hw*2, tier.h, 7);
    }
    ctx.clip();
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, geom.cx*2, geom.yBase+40);
    ctx.restore();
  }

  // ── Table ─────────────────────────────────────────────────────
  function drawTable(ctx, geom, t, flicker) {
    if (t <= 0) return;
    const b  = t * (0.88 + flicker*0.06);
    const tw = geom.tiers[2].hw * 2.9;
    const th = clamp(geom.tiers[2].h * 0.15, 4, 11);
    const tx = geom.cx - tw*0.5;
    const ty = geom.yBase;
    const gt = ctx.createLinearGradient(tx, ty, tx+tw, ty);
    gt.addColorStop(0,    'rgba(26,10,7,0.0)');
    gt.addColorStop(0.22, `rgba(50,24,15,${0.90*b})`);
    gt.addColorStop(0.50, `rgba(66,32,20,${b})`);
    gt.addColorStop(0.78, `rgba(50,24,15,${0.90*b})`);
    gt.addColorStop(1,    'rgba(26,10,7,0.0)');
    ctx.save();
    ctx.fillStyle = gt;
    ctx.fillRect(tx, ty, tw, th);
    ctx.restore();
  }

  // ── Table reflection ──────────────────────────────────────────
  function drawReflection(ctx, geom, t, bri) {
    if (t <= 0) return;
    const bot   = geom.tiers[2];
    const reflH = bot.h * 0.30;
    ctx.save();
    ctx.globalAlpha = t * 0.18 * bri;
    const gr = ctx.createLinearGradient(0, geom.yBase, 0, geom.yBase+reflH);
    gr.addColorStop(0, 'rgba(202,142,158,0.55)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    rr(ctx, geom.cx-bot.hw, geom.yBase, bot.hw*2, reflH, [0,0,5,5]);
    ctx.fillStyle = gr; ctx.fill();
    ctx.restore();
  }

  // ── Helpers ───────────────────────────────────────────────────
  function ss(e0, e1, x) {
    const t = Math.max(0, Math.min(1,(x-e0)/(e1-e0)));
    return t*t*(3-2*t);
  }

  function dark(hex, amt) {
    const [r,g,b] = rgb(hex);
    const d = 1-Math.min(amt,0.9);
    return `rgb(${Math.round(r*d)},${Math.round(g*d)},${Math.round(b*d)})`;
  }

  function blend(hexA, hexB, t) {
    const [r1,g1,b1]=rgb(hexA), [r2,g2,b2]=rgb(hexB);
    return `rgb(${Math.round(r1+(r2-r1)*t)},${Math.round(g1+(g2-g1)*t)},${Math.round(b1+(b2-b1)*t)})`;
  }

  function rgb(hex) {
    const h=hex.replace('#','');
    return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];
  }

  function rr(ctx, x, y, w, h, radii) {
    const [tl,tr,br,bl] = typeof radii==='number'?[radii,radii,radii,radii]:radii;
    ctx.beginPath();
    ctx.moveTo(x+tl,y); ctx.lineTo(x+w-tr,y);
    ctx.arcTo(x+w,y,x+w,y+tr,tr); ctx.lineTo(x+w,y+h-br);
    ctx.arcTo(x+w,y+h,x+w-br,y+h,br); ctx.lineTo(x+bl,y+h);
    ctx.arcTo(x,y+h,x,y+h-bl,bl); ctx.lineTo(x,y+tl);
    ctx.arcTo(x,y,x+tl,y,tl); ctx.closePath();
  }

  function clamp(v,lo,hi) { return Math.max(lo,Math.min(hi,v)); }

  return { init, draw, reveal };

})();