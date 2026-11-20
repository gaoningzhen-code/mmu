/* ===== MMU 美术：程序绘制的人物造型与场景（SVG） ===== */
var Art = (function () {
  'use strict';
  var PAL = [
    { m: '#9a6430', l: '#d89a58', d: '#5a3818' }, // 青铜
    { m: '#8d98a6', l: '#e2e8ef', d: '#4c5560' }, // 精钢
    { m: '#4fa8d8', l: '#d4f4ff', d: '#1f4e70' }, // 寒霜
    { m: '#b8301c', l: '#ff9a62', d: '#540f08' }, // 炎魔
    { m: '#e6bc4a', l: '#fff6c8', d: '#86621a' }  // 曜光
  ];
  var CLOTH = { m: '#5a4a3c', l: '#7d6b5a', d: '#33291f' };
  var CAPE = { sw: '#8a1f1f', mg: '#4b2a80', ar: '#2c5e2c' };
  var ELC = { fire: '#ff7a3a', ice: '#7ad8ff', thunder: '#ffe14a', dark: '#b07aff', holy: '#fff2a8' };
  function pal(it) { return it ? PAL[it.t] : CLOTH; }
  function glowF(p, col) {
    if (!p || p < 4) return '';
    var c = p >= 13 ? '#ff5a3a' : p >= 10 ? '#ffc23a' : p >= 7 ? '#5ab4ff' : '#ffffff';
    var r = p >= 13 ? 5 : p >= 10 ? 4 : p >= 7 ? 3 : 2;
    return ' style="filter:drop-shadow(0 0 ' + r + 'px ' + c + ')"';
  }
  function gem(x, y, it) { return it && it.el ? '<circle cx="' + x + '" cy="' + y + '" r="2.2" fill="' + ELC[it.el] + '" stroke="#0006" stroke-width=".6"/>' : ''; }
  function trim(it) { return it && it.r === 3 ? '#ffd24a' : it && it.r === 2 ? '#7affb0' : '#0005'; }

  // 人物：eq 为装备对象；cls 职业；opts.bond 主元素
  function hero(cls, eq, opts) {
    opts = opts || {};
    var w = eq.weapon, h = eq.helm, a = eq.armor, g = eq.gloves, b = eq.boots;
    var A = pal(a), H = pal(h), G = pal(g), B = pal(b), W = w ? PAL[w.t] : CLOTH;
    var skin = '#e9c6a2', cape = CAPE[cls];
    var s = '<svg class="hsvg cls-' + cls + '" viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">';
    s += '<ellipse cx="60" cy="152" rx="26" ry="5" fill="#0008"/>';
    if (opts.bond) s += '<ellipse class="aur" cx="60" cy="150" rx="34" ry="8" fill="none" stroke="' + ELC[opts.bond] + '" stroke-width="2" opacity=".7"/>';
    s += '<g class="fig">';
    // 披风
    s += '<path d="M50 54 Q38 100 32 132 Q52 138 70 130 Q66 92 68 54Z" fill="' + cape + '" stroke="#0006"/>';
    // 后手
    s += '<rect x="44" y="58" width="8" height="26" rx="4" fill="' + A.d + '"/><rect x="43" y="80" width="10" height="9" rx="3" fill="' + G.m + '" stroke="' + G.d + '"/>';
    // 腿
    s += '<rect x="50" y="96" width="9" height="32" rx="3" fill="' + A.d + '"/><rect x="61" y="96" width="9" height="32" rx="3" fill="' + A.d + '"/>';
    // 靴子
    s += '<g' + glowF(b && b.p) + '><path d="M48 122 h12 v10 h4 v6 h-17Z" fill="' + B.m + '" stroke="' + B.d + '"/><path d="M60 122 h12 v10 h5 v6 h-18Z" fill="' + B.m + '" stroke="' + B.d + '"/>';
    if (b && b.t >= 2) s += '<path d="M48 124 l-5 -4 l5 0Z M60 124 l-4 -5 l5 1Z" fill="' + B.l + '"/>';
    s += gem(66, 134, b) + '</g>';
    // 躯干铠甲
    s += '<g' + glowF(a && a.p) + '><path d="M45 54 L75 54 L73 98 L47 98Z" fill="' + A.m + '" stroke="' + trim(a) + '" stroke-width="1.2"/>';
    s += '<path d="M52 58 L68 58 L66 78 L54 78Z" fill="' + A.l + '" opacity=".55"/>';
    if (a) s += '<path d="M60 56 L60 96" stroke="' + A.d + '" stroke-width="1.2"/>';
    s += '<rect x="46" y="92" width="28" height="7" rx="2" fill="#3a2a1a"/><rect x="57" y="92" width="6" height="7" fill="' + (a ? A.l : '#a08050') + '"/>';
    if (a && a.t >= 1) { var pr = 7 + a.t * 1.6; s += '<ellipse cx="46" cy="58" rx="' + pr + '" ry="' + (pr * 0.7) + '" fill="' + A.m + '" stroke="' + A.d + '"/><ellipse cx="74" cy="58" rx="' + pr + '" ry="' + (pr * 0.7) + '" fill="' + A.m + '" stroke="' + A.d + '"/>'; }
    if (a && a.t >= 3) s += '<path d="M40 54 l-6 -8 l10 4Z M80 54 l6 -8 l-10 4Z" fill="' + A.l + '"/>';
    s += gem(60, 70, a) + '</g>';
    // 头
    s += '<rect x="56" y="46" width="8" height="8" fill="' + skin + '"/><circle cx="61" cy="38" r="10" fill="' + skin + '"/><circle cx="66" cy="37" r="1.4" fill="#222"/>';
    if (!h) s += '<path d="M51 36 Q52 25 62 26 Q71 27 71 34 Q64 30 56 33 Q53 36 51 40Z" fill="#3a2414"/>';
    else {
      s += '<g' + glowF(h.p) + '><path d="M49 40 Q49 24 61 24 Q73 24 73 38 L73 42 L66 42 L66 36 L54 36 L52 46 L49 46Z" fill="' + H.m + '" stroke="' + trim(h) + '" stroke-width="1"/>';
      if (h.t >= 1) s += '<path d="M66 37 L73 37" stroke="#111" stroke-width="2"/>';
      if (h.t === 2) s += '<path d="M55 25 l2 -9 l3 8Z M61 24 l2 -11 l3 10Z M67 25 l2 -8 l2 8Z" fill="' + H.l + '"/>';
      if (h.t === 3) s += '<path d="M52 28 Q40 20 44 8 Q48 20 56 25Z M70 28 Q82 20 78 8 Q74 20 66 25Z" fill="' + H.l + '" stroke="' + H.d + '"/>';
      if (h.t === 4) s += '<ellipse cx="61" cy="17" rx="13" ry="3.5" fill="none" stroke="#fff3a0" stroke-width="2"/><path d="M53 26 l3 -8 l3 7 l2 -9 l3 9 l3 -7 l3 8Z" fill="' + H.l + '"/>';
      s += gem(61, 29, h) + '</g>';
    }
    // 前手 + 武器
    s += '<g class="arm"><rect x="68" y="58" width="8" height="26" rx="4" fill="' + A.d + '"/>';
    var wg = '<g class="wpn"' + glowF(w && w.p) + '>';
    var wc = w && w.el ? ELC[w.el] : W.l;
    if (cls === 'sw') wg += '<path d="M74 86 L104 30 L108 33 L80 90Z" fill="' + (w ? W.l : '#c8c8c8') + '" stroke="' + W.d + '"/><path d="M70 82 L84 92" stroke="' + W.d + '" stroke-width="4"/>' + (w && w.el ? '<path d="M80 80 L102 36" stroke="' + wc + '" stroke-width="1.6" opacity=".8"/>' : '');
    else if (cls === 'mg') wg += '<path d="M78 20 L80 136" stroke="' + (w ? W.d : '#6a4a2a') + '" stroke-width="3.5"/><circle class="orb" cx="78" cy="18" r="6" fill="' + wc + '" stroke="' + W.l + '"/>' + (w && w.t >= 2 ? '<path d="M72 22 l-4 -8 M84 22 l4 -8" stroke="' + W.l + '" stroke-width="2"/>' : '');
    else wg += '<path d="M86 40 Q104 86 86 132" fill="none" stroke="' + (w ? W.m : '#7a5a2a') + '" stroke-width="4"/><path d="M86 40 L80 86 L86 132" fill="none" stroke="#eee" stroke-width=".8"/>' + (w && w.el ? '<circle cx="96" cy="86" r="2.5" fill="' + wc + '"/>' : '');
    wg += '</g>';
    s += wg + '<rect x="67" y="80" width="10" height="9" rx="3" fill="' + G.m + '" stroke="' + G.d + '"' + glowF(g && g.p) + '/>' + gem(72, 84, g) + '</g>';
    s += '</g></svg>';
    return s;
  }

  // 场景背景
  function scene(zi) {
    var v = '<svg class="bg" viewBox="0 0 560 230" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg"><defs>';
    var sky = [['#3d5a8a', '#c89a6a'], ['#0f2a2a', '#2a4a3a'], ['#8ab4d8', '#e4f2ff'], ['#2a0806', '#8a2a10'], ['#2a2a6a', '#b48ad8']][zi];
    v += '<linearGradient id="sk' + zi + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + sky[0] + '"/><stop offset="1" stop-color="' + sky[1] + '"/></linearGradient></defs>';
    v += '<rect width="560" height="230" fill="url(#sk' + zi + ')"/>';
    if (zi === 0) {
      v += '<circle cx="460" cy="60" r="24" fill="#ffd89a" opacity=".8"/>';
      v += '<path d="M0 150 Q80 110 160 140 T330 130 T560 140 V230 H0Z" fill="#4a6a3a"/><path d="M0 170 Q120 150 240 168 T560 160 V230 H0Z" fill="#3a5a2a"/>';
      for (var i = 0; i < 9; i++) v += '<circle cx="' + (20 + i * 64) + '" cy="' + (162 + (i % 2) * 6) + '" r="' + (10 + i % 3 * 4) + '" fill="#2e4a22"/>';
      v += '<rect y="192" width="560" height="38" fill="#5a4a2a"/><path d="M0 192 H560" stroke="#7a8a3a" stroke-width="4"/>';
    } else if (zi === 1) {
      for (var j = 0; j < 14; j++) { var x = j * 42 - 10, hh = 90 + (j * 37 % 50); v += '<path d="M' + x + ' 196 L' + (x + 22) + ' ' + (196 - hh) + ' L' + (x + 44) + ' 196Z" fill="' + (j % 2 ? '#0a1a14' : '#12261c') + '"/>'; }
      v += '<rect y="150" width="560" height="40" fill="#9ad8c0" opacity=".08"/><rect y="192" width="560" height="38" fill="#1a2a1a"/><path d="M0 192 H560" stroke="#2a4a2a" stroke-width="4"/>';
      for (var k = 0; k < 6; k++) v += '<circle cx="' + (40 + k * 90) + '" cy="' + (120 + k % 3 * 20) + '" r="1.6" fill="#b4ff9a" opacity=".8"/>';
    } else if (zi === 2) {
      v += '<path d="M0 160 L70 70 L120 120 L190 50 L260 130 L330 60 L420 140 L490 80 L560 130 V230 H0Z" fill="#b8d4ec"/><path d="M190 50 L170 76 L200 70 L212 82Z M330 60 L314 82 L340 76Z M70 70 L56 88 L80 84Z" fill="#fff"/>';
      for (var q = 0; q < 8; q++) { var xq = 30 + q * 72; v += '<path d="M' + xq + ' 194 L' + (xq + 8) + ' ' + (160 - q % 3 * 10) + ' L' + (xq + 16) + ' 194Z" fill="#9adcff" opacity=".8"/>'; }
      v += '<rect y="192" width="560" height="38" fill="#e8f4ff"/><path d="M0 192 H560" stroke="#fff" stroke-width="4"/>';
    } else if (zi === 3) {
      v += '<path d="M0 150 L60 100 L110 140 L180 90 L240 150 L320 100 L390 145 L460 95 L560 140 V230 H0Z" fill="#1a0806"/>';
      v += '<path d="M180 90 L176 120 L186 118Z M460 95 L456 126 L466 120Z" fill="#ff6a1a" opacity=".8"/>';
      v += '<rect y="192" width="560" height="38" fill="#2a0e08"/><path d="M0 206 Q140 198 280 208 T560 204" stroke="#ff7a1a" stroke-width="6" fill="none" opacity=".9"/><path d="M0 192 H560" stroke="#4a1a0a" stroke-width="4"/>';
      for (var e = 0; e < 8; e++) v += '<circle class="ember" cx="' + (30 + e * 70) + '" cy="' + (180 - e % 3 * 30) + '" r="1.6" fill="#ffb04a"/>';
    } else {
      v += '<ellipse cx="120" cy="120" rx="70" ry="14" fill="#d8c8ff" opacity=".5"/><ellipse cx="430" cy="90" rx="90" ry="16" fill="#e8d8ff" opacity=".45"/>';
      v += '<path d="M380 96 h100 l-20 40 h-60Z" fill="#6a5a9a"/><rect x="400" y="50" width="10" height="46" fill="#e8e0ff"/><rect x="450" y="56" width="10" height="40" fill="#e8e0ff"/><path d="M396 50 h66 l-6 -8 h-54Z" fill="#fff4c0"/>';
      for (var p = 0; p < 6; p++) v += '<rect x="' + (20 + p * 96) + '" y="' + (150 - p % 2 * 14) + '" width="12" height="44" fill="#d8d0f4" opacity=".7"/>';
      v += '<rect y="192" width="560" height="38" fill="#4a4a7a"/><path d="M0 192 H560" stroke="#c8b8ff" stroke-width="4"/>';
    }
    return v + '</svg>';
  }
  return { hero: hero, scene: scene, ELC: ELC, PAL: PAL };
})();
