/* ===== MMU 游戏引擎（纯逻辑，无界面；以后可移植到微信小游戏） ===== */
var MMU = (function () {
  'use strict';
  // ---------- 随机数（可设种子，试炼结果可复现） ----------
  var seed = (Date.now() ^ 0x5bd1e995) >>> 0;
  function rand() {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function rnd(a, b) { return a + Math.floor(rand() * (b - a + 1)); }
  function pick(a) { return a[Math.floor(rand() * a.length)]; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  var _id = 0;
  function uid() { _id++; return 'i' + Date.now().toString(36).slice(-4) + _id.toString(36) + Math.floor(rand() * 1296).toString(36); }

  // ---------- 基础数据 ----------
  var EL = {
    fire: { n: '火', i: '🔥', st: 'burn', c: '#ff7a3a' },
    ice: { n: '冰', i: '❄️', st: 'freeze', c: '#7ad8ff' },
    thunder: { n: '雷', i: '⚡', st: 'shock', c: '#ffe14a' },
    dark: { n: '暗', i: '🌑', st: 'erode', c: '#b07aff' },
    holy: { n: '圣', i: '✨', st: 'mark', c: '#fff2a8' },
    phys: { n: '物理', i: '⚔️', st: null, c: '#ddd' }
  };
  var EL_KEYS = ['fire', 'ice', 'thunder', 'dark', 'holy'];
  var ST = {
    burn: { n: '灼烧', i: '🔥', d: '持续伤害，可叠层' },
    freeze: { n: '冻结', i: '🧊', d: '怪物停止行动' },
    shock: { n: '感电', i: '⚡', d: '受到攻击时弹射到其他怪物' },
    erode: { n: '侵蚀', i: '🌑', d: '防御降低（破甲）' },
    mark: { n: '标记', i: '🎯', d: '受到伤害增加（易伤）' }
  };
  var REACT = {
    shatter: { n: '碎裂', i: '💥', d: '冰+雷：冻结中的怪受雷伤 ×2' },
    devour: { n: '炎噬', i: '🔥', d: '火+暗：对侵蚀目标施加灼烧时层数翻倍' },
    judge: { n: '审判', i: '⚖️', d: '圣+雷：雷伤命中「标记+感电」目标必定暴击' },
    steam: { n: '蒸腾', i: '♨️', d: '冰+火：引爆大伤害，清除冻结和灼烧' },
    void: { n: '湮灭', i: '🕳️', d: '暗+圣：3 秒内无视元素抗性' }
  };
  var BOND = { // 元素羁绊：2/4/6 件
    fire: { n: '灼烧伤害', v: [30, 70, 120], u: '%' },
    ice: { n: '冻结时间', v: [0.3, 0.6, 1.0], u: '秒' },
    thunder: { n: '感电弹射目标', v: [1, 2, 3], u: '个' },
    dark: { n: '侵蚀破甲', v: [10, 20, 30], u: '%' },
    holy: { n: '标记易伤', v: [10, 20, 35], u: '%' }
  };

  var CLS = {
    sw: { n: '剑士', i: '🗡️', body: '🤺', wpn: '剑', base: { str: 28, agi: 15, vit: 26, ene: 10 }, hpv: 9,
      d: '近战坦克型输出。【怒气】攻击和受伤积累怒气，满 100 自动释放「怒斩」；怒气越高吸血越强（最高 8%）。',
      start: ['sw_ice', 'sw_fire', 'sw_thu'] },
    mg: { n: '法师', i: '🔮', body: '🧙', wpn: '法杖', base: { str: 10, agi: 15, vit: 16, ene: 32 }, hpv: 6,
      d: '远程元素专家。【元素共鸣】施放与上一个不同元素的技能，共鸣 +1 层，每层伤害 +15%（最多 5 层），6 秒不换元素逐层衰减。',
      start: ['mg_nova', 'mg_fireball', 'mg_chain'] },
    ar: { n: '弓箭手', i: '🏹', body: '🧝', wpn: '弓', base: { str: 14, agi: 30, vit: 18, ene: 12 }, hpv: 7,
      d: '远程高攻速。【连射】攻速越高，普攻一次射出的箭越多（最多 4 支）；对「标记」目标暴击率 +20%。',
      start: ['ar_ice', 'ar_rain', 'ar_bolt'] }
  };

  // 技能：t = single 单体 / aoe 群体 / bounce 弹射 / pierce 穿透 / buff 增益 / heal 治疗 / shield 护盾 / ench 附魔(被动)
  var SK = {
    // 剑士
    sw_ice: { cls: 'sw', n: '冰霜重击', el: 'ice', t: 'single', m: 3.0, cd: 4, st: 'freeze', ch: 1, d: '单体 300% 冰伤，必定冻结。' },
    sw_fire: { cls: 'sw', n: '烈焰旋风', el: 'fire', t: 'aoe', m: 1.5, cd: 5, st: 'burn', ch: 1, sn: 2, d: '群体 150% 火伤，施加 2 层灼烧。' },
    sw_thu: { cls: 'sw', n: '雷霆冲锋', el: 'thunder', t: 'single', m: 2.2, cd: 5, st: 'shock', ch: 1, d: '单体 220% 雷伤，施加感电。' },
    sw_dark: { cls: 'sw', n: '暗影撕裂', el: 'dark', t: 'single', m: 2.0, cd: 6, st: 'erode', ch: 1, d: '单体 200% 暗伤，施加侵蚀。' },
    sw_holy: { cls: 'sw', n: '圣盾猛击', el: 'holy', t: 'single', m: 1.8, cd: 7, st: 'mark', ch: 1, shield: 0.12, d: '单体 180% 圣伤，施加标记，并获得 12% 生命护盾。' },
    sw_cry: { cls: 'sw', n: '战吼', el: 'phys', t: 'buff', cd: 16, buff: { atk: 30, dur: 6 }, rage: 30, d: '攻击 +30% 持续 6 秒，立即获得 30 怒气。' },
    // 法师
    mg_nova: { cls: 'mg', n: '冰霜新星', el: 'ice', t: 'aoe', m: 1.0, cd: 6, st: 'freeze', ch: 1, d: '群体 100% 冰伤，冻结所有敌人。' },
    mg_fireball: { cls: 'mg', n: '火球术', el: 'fire', t: 'single', m: 2.2, cd: 3, st: 'burn', ch: 1, sn: 3, d: '单体 220% 火伤，施加 3 层灼烧。' },
    mg_chain: { cls: 'mg', n: '连锁闪电', el: 'thunder', t: 'bounce', m: 1.4, cd: 4, tn: 3, st: 'shock', ch: 1, d: '弹射 3 个目标，各 140% 雷伤并感电。' },
    mg_rain: { cls: 'mg', n: '暗蚀之雨', el: 'dark', t: 'aoe', m: 0.8, cd: 6, st: 'erode', ch: 1, d: '群体 80% 暗伤，侵蚀所有敌人。' },
    mg_holy: { cls: 'mg', n: '圣光审判', el: 'holy', t: 'single', m: 2.0, cd: 5, st: 'mark', ch: 1, d: '单体 200% 圣伤，施加标记。' },
    mg_barrier: { cls: 'mg', n: '法力护盾', el: 'phys', t: 'shield', cd: 18, shield: 0.2, d: '获得 20% 生命的护盾。' },
    // 弓箭手
    ar_ice: { cls: 'ar', n: '寒冰箭', el: 'ice', t: 'pierce', m: 1.3, cd: 4, tn: 3, st: 'freeze', ch: 0.5, d: '穿透 3 个目标，各 130% 冰伤，50% 几率冻结。' },
    ar_rain: { cls: 'ar', n: '火焰箭雨', el: 'fire', t: 'aoe', m: 0.9, cd: 6, st: 'burn', ch: 1, sn: 1, d: '群体 90% 火伤，施加 1 层灼烧。' },
    ar_bolt: { cls: 'ar', n: '雷光弹射', el: 'thunder', t: 'bounce', m: 1.1, cd: 4, tn: 4, st: 'shock', ch: 1, d: '弹射 4 个目标，各 110% 雷伤并感电。' },
    ar_acid: { cls: 'ar', n: '腐蚀箭', el: 'dark', t: 'single', m: 1.5, cd: 5, st: 'erode', ch: 1, d: '单体 150% 暗伤，施加侵蚀。' },
    ar_mark: { cls: 'ar', n: '圣辉标记', el: 'holy', t: 'single', m: 1.0, cd: 6, st: 'mark', ch: 1, d: '单体 100% 圣伤，施加标记。' },
    ar_wind: { cls: 'ar', n: '疾风', el: 'phys', t: 'buff', cd: 18, buff: { aspd: 40, dur: 8 }, d: '攻速 +40% 持续 8 秒。' },
    // 通用
    al_heal: { cls: 'all', n: '治疗之光', el: 'holy', t: 'heal', cd: 15, heal: 0.25, d: '回复 25% 生命（生命低于 70% 时才使用）。' },
    al_frenzy: { cls: 'all', n: '狂热', el: 'phys', t: 'buff', cd: 20, buff: { dmg: 20, dur: 8 }, d: '伤害 +20% 持续 8 秒。' },
    al_ward: { cls: 'all', n: '元素护盾', el: 'phys', t: 'shield', cd: 20, shield: 0.25, cc: 4, d: '获得 25% 生命护盾，4 秒内免疫冻结。' },
    al_e_fire: { cls: 'all', n: '火焰附魔', el: 'fire', t: 'ench', d: '被动：普攻变为火元素，25% 几率灼烧。' },
    al_e_ice: { cls: 'all', n: '冰霜附魔', el: 'ice', t: 'ench', d: '被动：普攻变为冰元素，25% 几率冻结。' },
    al_e_thunder: { cls: 'all', n: '雷霆附魔', el: 'thunder', t: 'ench', d: '被动：普攻变为雷元素，25% 几率感电。' },
    al_e_dark: { cls: 'all', n: '暗影附魔', el: 'dark', t: 'ench', d: '被动：普攻变为暗元素，25% 几率侵蚀。' },
    al_e_holy: { cls: 'all', n: '圣光附魔', el: 'holy', t: 'ench', d: '被动：普攻变为圣元素，25% 几率标记。' }
  };
  var TAL = {
    sw: [
      { id: 'blood', n: '嗜血', d: '怒气吸血效果翻倍（最高 16%）。适合怒气坦克流。' },
      { id: 'frost', n: '寒铁', d: '攻击冻结目标时怒气获取 ×2，冻结时间 +0.5 秒。适合冰冻控场流。' },
      { id: 'flame', n: '狂焰', d: '怒斩变为群体火伤并施加 3 层灼烧；剑士技能灼烧 +1 层。适合火焰群攻流。' }
    ],
    mg: [
      { id: 'master', n: '元素大师', d: '共鸣上限 5 → 8 层。适合多元素轮转。' },
      { id: 'shatter', n: '冰雷交织', d: '碎裂反应倍率 ×2 → ×3。适合冰雷碎裂流。' },
      { id: 'inferno', n: '焚灭', d: '灼烧层数上限 +10，炎噬后灼烧伤害 +50%。适合火暗持续流。' }
    ],
    ar: [
      { id: 'hawk', n: '鹰眼', d: '对标记目标暴击伤害 +50%。适合圣标记暴击流。' },
      { id: 'multi', n: '多重射击', d: '连射上限 4 → 6 支。适合高攻速清怪流。' },
      { id: 'frostarrow', n: '冰封箭阵', d: '寒冰箭必定冻结；攻击冻结目标时额外 +1 支箭。适合寒冰穿透流。' }
    ]
  };

  var ZONES = [
    { n: '新手草原', min: 1, pack: 2, trait: '无特殊特性（新手教学）', mons: [['史莱姆', '🟢'], ['野狼', '🐺'], ['哥布林', '👺']],
      boss: { n: '哥布林首领', i: '👹', mech: 'enrage', md: '45 秒后狂暴：攻击 ×3、攻速 ×1.5。考验爆发输出。' } },
    { n: '幽暗森林', min: 15, pack: 5, trait: '怪物成群（5 只）；幽灵 35% 闪避单体攻击（群体、弹射不会被闪避）', dodge: { '幽灵': 0.35 }, mons: [['森林蜘蛛', '🕷️'], ['骷髅兵', '💀'], ['幽灵', '👻']],
      boss: { n: '骸骨巫师', i: '☠️', mech: 'summon', md: '每 7 秒召唤 2 个骷髅；有召唤物在场时巫师受到伤害 -70%。需要群攻或弹射清召唤物。' } },
    { n: '冰封峡谷', min: 35, pack: 3, trait: '怪物冰抗 70%；严寒使你攻速 -25%', res: { ice: 0.7 }, slow: 0.25, mons: [['雪怪', '☃️'], ['冰原狼', '🐺'], ['霜巨人', '🧊']],
      boss: { n: '冰霜巨龙', i: '🐉', mech: 'breath', md: '免疫冰元素，受火伤 +30%；血量低于 50% 后每 8 秒吐息冻结你 2.5 秒（冰抗可缩短，元素护盾可免疫）。' } },
    { n: '熔岩废墟', min: 60, pack: 3, trait: '环境灼烧：每秒损失 2% 生命（火抗可减免）；怪物火抗 70%', res: { fire: 0.7 }, lava: 0.02, mons: [['火蜥蜴', '🦎'], ['熔岩魔', '🌋'], ['地狱犬', '🐕']],
      boss: { n: '炎魔领主', i: '😈', mech: 'reflect', md: '免疫火元素；被暴击时反弹该次伤害的 35% 给你。纯暴击流会被反伤；持续伤害和反应伤害不会被反弹。' } },
    { n: '天空之城', min: 90, pack: 3, trait: '怪物带护盾（50% 生命）；护盾受普通伤害 -50%，暗、雷伤害对护盾 ×1.5', shield: 0.5, mons: [['天空守卫', '🗿'], ['狮鹫', '🦅'], ['堕落天使', '👼']],
      boss: { n: '曜光审判者', i: '⚡', mech: 'cleanse', md: '每 20 秒净化身上所有状态，并随机免疫一种元素。需要双元素和快速爆发。' } }
  ];
  var LEG = [ // 首领首杀掉落的传说装备特效
    { slot: 'neck', n: '狂战之心', fx: 'might', d: '战意上限 +50，每层伤害 +1.5%（原 1%）' },
    { slot: 'ring', n: '亡语指环', fx: 'aoe', d: '群体、弹射、穿透技能伤害 +40%' },
    { slot: 'gloves', n: '霜火之握', fx: 'frostfire', d: '冻结的敌人受到火焰伤害 ×2，蒸腾伤害 +50%' },
    { slot: 'helm', n: '雷霆王冠', fx: 'storm', d: '感电弹射目标 +2，雷伤 +20%' },
    { slot: 'boots', n: '虚空行者', fx: 'void', d: '无视敌人 30% 元素抗性（不能突破免疫）' }
  ];

  var RAR = [{ n: '普通', c: '#d0d0d0' }, { n: '精良', c: '#4aa3ff' }, { n: '卓越', c: '#3ddc84' }, { n: '传说', c: '#ffb020' }];
  var SLOTS = {
    weapon: { n: '武器', i: '⚔️' }, helm: { n: '头盔', i: '🪖' }, armor: { n: '铠甲', i: '🥋' }, gloves: { n: '护手', i: '🧤' },
    boots: { n: '靴子', i: '👢' }, ring: { n: '戒指', i: '💍' }, neck: { n: '项链', i: '📿' }
  };
  var SLOT_KEYS = ['weapon', 'helm', 'armor', 'gloves', 'boots', 'ring', 'neck'];
  var ARMOR = { helm: 1, armor: 1, gloves: 1, boots: 1 };
  var TIER = ['青铜', '精钢', '寒霜', '炎魔', '曜光'];
  var WPN_I = { sw: '🗡️', mg: '🪄', ar: '🏹' };
  var AFF = [
    { k: 'atkp', n: '攻击力', a: 3, b: 12, u: '%' }, { k: 'critc', n: '暴击率', a: 1, b: 5, u: '%' },
    { k: 'critd', n: '暴击伤害', a: 8, b: 25, u: '%' }, { k: 'aspd', n: '攻击速度', a: 3, b: 10, u: '%' },
    { k: 'hpp', n: '生命值', a: 4, b: 15, u: '%' }, { k: 'leech', n: '吸血', a: 1, b: 3, u: '%' },
    { k: 'cdr', n: '冷却缩减', a: 3, b: 8, u: '%' }, { k: 'react', n: '反应伤害', a: 8, b: 25, u: '%' },
    { k: 'fire', n: '火焰伤害', a: 6, b: 20, u: '%' }, { k: 'ice', n: '冰霜伤害', a: 6, b: 20, u: '%' },
    { k: 'thunder', n: '雷电伤害', a: 6, b: 20, u: '%' }, { k: 'dark', n: '暗影伤害', a: 6, b: 20, u: '%' },
    { k: 'holy', n: '神圣伤害', a: 6, b: 20, u: '%' }, { k: 'rfire', n: '火焰抗性', a: 8, b: 25, u: '%' },
    { k: 'rice', n: '冰霜抗性', a: 8, b: 25, u: '%' }, { k: 'gold', n: '金币获取', a: 5, b: 20, u: '%' }, { k: 'exp', n: '经验获取', a: 3, b: 12, u: '%' }
  ];
  var AFF_MAP = {}; AFF.forEach(function (a) { AFF_MAP[a.k] = a; });
  var RATE = [1, 1, 1, 1, 1, 1, 0.8, 0.7, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3];
  var GEMS = { b: { n: '强化石', i: '💎' }, s: { n: '灵魂石', i: '🔮' }, g: { n: '守护符', i: '🧿' } };
  var BAG_MAX = 60, MAX_LV = 300, BOSS_KILLS = 60;

  // ---------- 公式 ----------
  function expNeed(l) { return Math.round(30 * Math.pow(l, 2.15) + 60 * l); }
  function plusMul(p) { return 1 + p * 0.08 + Math.max(0, p - 9) * 0.06; }
  function mobHp(L) { return 30 + 7 * L + 0.9 * L * L; }
  function mobAtk(L) { return 5 + 2.2 * L + 0.012 * L * L; }
  function baseVal(it) {
    var t = it.t, L = it.ilvl;
    if (it.slot === 'weapon') return 10 * Math.pow(2.1, t) + 2 * L;
    if (ARMOR[it.slot]) return (3 * Math.pow(2, t) + 0.6 * L) * (it.slot === 'armor' ? 1.5 : 1);
    return 20 * Math.pow(2, t) + 3 * L;
  }
  function itemVal(it) { return Math.round(baseVal(it) * plusMul(it.p) * (it.r === 3 ? 1.2 : 1)); }
  function statName(slot) { return slot === 'weapon' ? '攻击力' : ARMOR[slot] ? '防御力' : '生命值'; }
  function sellPrice(it) { return Math.round((5 + it.ilvl * 2) * (1 + it.r * 1.5) * (1 + it.p * 0.5)); }
  function potionPrice(s) { return Math.round(8 + s.lvl * 1.5); }
  function upCost(it) { return Math.round((it.p + 1) * (it.p + 1) * 100 * (it.t + 1)); }
  function upNeed(p) { return p < 6 ? { b: 1, s: 0 } : p < 9 ? { b: 0, s: 1 } : { b: 1, s: 1 }; }
  function shopPrice(s, k) {
    var b = 200 + s.lvl * 30;
    return { pot: potionPrice(s), b: b, s: b * 4, g: b * 20, book: 1500 + s.lvl * 60, reset: 500 + s.lvl * 40 }[k] || 0;
  }
  function score(it) {
    var w = it.slot === 'weapon' ? 1 : ARMOR[it.slot] ? 2.5 : 0.4;
    return itemVal(it) * w * (1 + 0.12 * it.af.length) * (1 + 0.15 * it.r);
  }
  function itemLabel(it) { return (it.p ? '+' + it.p + ' ' : '') + it.name; }

  function rollR(bonus) {
    var x = rand(); bonus = bonus || 0;
    if (x < 0.002 + bonus * 0.01) return 3;
    if (x < 0.05 + bonus * 0.12) return 2;
    if (x < 0.25 + bonus * 0.25) return 1;
    return 0;
  }

  function makeItem(t, ilvl, r, slot, cls) {
    t = clamp(t, 0, 4);
    slot = slot || pick(SLOT_KEYS);
    var it = { id: uid(), slot: slot, t: t, ilvl: Math.max(1, ilvl), r: r, p: 0, af: [], lk: false, el: null };
    if (slot === 'weapon') { it.cls = cls || pick(['sw', 'mg', 'ar']); it.name = TIER[t] + { sw: '长剑', mg: '法杖', ar: '长弓' }[it.cls]; }
    else it.name = TIER[t] + SLOTS[slot].n;
    if (r >= 1) it.el = pick(EL_KEYS);
    var n = r === 0 ? 0 : r === 1 ? 1 : r === 2 ? rnd(2, 3) : 4;
    var pool = AFF.slice();
    for (var i = 0; i < n && pool.length; i++) {
      var a = pool.splice(Math.floor(rand() * pool.length), 1)[0];
      it.af.push({ k: a.k, v: Math.round(rnd(a.a, a.b) * (r === 3 ? 1.5 : 1)) });
    }
    var L = it.ilvl;
    it.req = { lvl: Math.max(1, L - 3) };
    return it;
  }
  function makeLegend(zi, cls) {
    var lg = LEG[zi], z = ZONES[zi];
    var it = makeItem(zi, z.min + 12, 3, lg.slot, cls);
    it.name = lg.n; it.leg = lg.fx;
    return it;
  }

  // ---------- 存档 ----------
  function newState(cls) {
    var c = CLS[cls];
    var s = {
      v: 2, cls: cls, lvl: 1, exp: 0, pts: 0,
      str: c.base.str, agi: c.base.agi, vit: c.base.vit, ene: c.base.ene,
      gold: 300, hp: 1e9, zone: 0, zk: 0, kills: 0,
      eq: {}, bag: [], gems: { b: 3, s: 0, g: 0 }, pot: 20,
      books: c.start.concat(['al_heal']),
      sk: { c: c.start.slice(), g: ['al_heal', null], t: TAL[cls][0].id },
      bossWin: [false, false, false, false, false],
      loads: [null, null, null],
      set: { sell: 1, autoEq: 'empty', potAt: 50, autoBuy: true },
      st: { upOk: 0, upFail: 0, broken: 0, maxPlus: 0, flee: 0, bossTry: 0 },
      last: Date.now(), lastRep: null, F: null
    };
    s.eq.weapon = makeItem(0, 1, 0, 'weapon', cls); s.eq.weapon.name = '新手' + c.wpn;
    s.eq.armor = makeItem(0, 1, 0, 'armor'); s.eq.armor.name = '新手皮甲';
    s.hp = calc(s).hp;
    return s;
  }
  function fixState(s) {
    if (!s || s.v !== 2 || !CLS[s.cls]) return null;
    var d = newState(s.cls);
    for (var k in d) if (s[k] === undefined) s[k] = d[k];
    ['set', 'st', 'gems'].forEach(function (k) { for (var j in d[k]) if (s[k][j] === undefined) s[k][j] = d[k][j]; });
    s.F = null;
    return s;
  }

  // ---------- 属性计算 ----------
  function bonds(s) {
    var cnt = { fire: 0, ice: 0, thunder: 0, dark: 0, holy: 0 }, out = {};
    for (var i = 0; i < SLOT_KEYS.length; i++) { var it = s.eq[SLOT_KEYS[i]]; if (it && it.el) cnt[it.el]++; }
    EL_KEYS.forEach(function (e) { var n = cnt[e]; out[e] = { n: n, lv: n >= 6 ? 3 : n >= 4 ? 2 : n >= 2 ? 1 : 0 }; });
    return out;
  }
  function bondVal(b, e) { return b[e].lv ? BOND[e].v[b[e].lv - 1] : 0; }

  function calc(s) {
    var cls = s.cls, main = cls === 'sw' ? s.str : cls === 'mg' ? s.ene : s.agi;
    var c = {
      atk: 5 + main * (cls === 'ar' ? 0.7 : cls === 'sw' ? 0.95 : 0.8) + s.str * 0.1, def: s.agi * 0.3,
      hp: 60 + s.vit * CLS[cls].hpv + s.lvl * 6,
      critc: 5 + s.agi * 0.03, critd: 150, aspd: 1 + s.agi * (cls === 'ar' ? 0.004 : 0.002),
      atkp: 0, aspdp: 0, hpp: 0, leech: 0, cdr: 0, react: 0, gold: 0, exp: 0, rfire: 0, rice: 0,
      fire: 0, ice: 0, thunder: 0, dark: 0, holy: 0, leg: {}
    };
    for (var i = 0; i < SLOT_KEYS.length; i++) {
      var it = s.eq[SLOT_KEYS[i]]; if (!it) continue;
      var v = itemVal(it);
      if (it.slot === 'weapon') c.atk += it.cls === cls ? v : v * 0.5; // 非本职业武器只有一半攻击
      else if (ARMOR[it.slot]) c.def += v; else c.hp += v;
      for (var j = 0; j < it.af.length; j++) {
        var a = it.af[j];
        if (a.k === 'aspd') c.aspdp += a.v; else c[a.k] += a.v;
      }
      if (it.leg) c.leg[it.leg] = true;
    }
    c.atk = Math.round(c.atk); c.def = Math.round(c.def);
    c.hp = Math.round(c.hp * (1 + c.hpp / 100));
    c.aspd = Math.min(4, c.aspd * (1 + c.aspdp / 100));
    c.critc = Math.min(75, c.critc); c.leech = Math.min(12, c.leech); c.cdr = Math.min(40, c.cdr);
    c.rfire = Math.min(75, c.rfire); c.rice = Math.min(75, c.rice);
    c.bonds = bonds(s);
    if (c.leg.storm) c.thunder += 20;
    return c;
  }

  // ---------- 战斗 ----------
  function newRep() {
    return { t: 0, dmg: {}, el: {}, react: {}, reactDmg: 0, taken: {}, kills: 0, flee: 0, pot: 0, wasted: 0, frozenT: 0,
      reflect: 0, cleanse: 0, enraged: false, addsT: 0, aoeDmg: 0, critDmg: 0, total: 0, hpMin: 1, result: '', exp: 0, gold: 0, statusApplied: 0, statusLost: 0 };
  }
  function addR(o, k, v) { o[k] = (o[k] || 0) + v; }
  function rx(F, k) { addR(F.rep.react, k, 1); if (F.ui) F.ui.push({ t: 'msg', m: REACT[k].i + ' ' + REACT[k].n + '！', r: 1 }); }

  function newFight(s, zi, boss) {
    return { zi: zi, boss: !!boss, mons: [], heroT: 0, cds: {}, buf: [], shield: 0, cc: 0, frozen: 0,
      rage: 0, reso: 0, resoEl: null, resoT: 0, might: 0, rest: 0, spawnT: 0, t: 0, potCd: 0,
      rep: newRep(), done: false, envT: 0, bossT: 0, breathT: 0, cleanseT: 0, summonT: 0 };
  }

  function mkMon(zi, L, nm, ico, opt) {
    var z = ZONES[zi]; opt = opt || {};
    var hpm = opt.hpm || 1, atkm = opt.atkm || 1;
    var m = { n: nm, i: ico, L: L, hp: Math.round(mobHp(L) * hpm), atk: Math.round(mobAtk(L) * atkm), def: Math.round(2 + 1.5 * L),
      res: {}, dodge: (z.dodge && z.dodge[nm]) || 0, shield: 0, at: rand() * 1.2, st: {}, boss: !!opt.boss, add: !!opt.add, mech: opt.mech || null };
    m.mhp = m.hp;
    if (z.res) for (var k in z.res) m.res[k] = z.res[k];
    if (z.shield && !opt.add) { m.shield = Math.round(m.mhp * z.shield * (opt.boss ? 0.3 : 1)); m.mshield = m.shield; }
    return m;
  }

  function spawnPack(s, F) {
    var z = ZONES[F.zi]; F.mons = [];
    for (var i = 0; i < z.pack; i++) {
      var mm = pick(z.mons), L = z.min + rnd(0, 6 + F.zi * 3);
      F.mons.push(mkMon(F.zi, L, mm[0], mm[1]));
    }
  }
  function spawnBoss(s, F) {
    var z = ZONES[F.zi], b = z.boss, L = z.min + 12;
    var m = mkMon(F.zi, L, b.n, b.i, { boss: true, hpm: 22, atkm: 2.4, mech: b.mech });
    if (b.mech === 'breath') { m.res.ice = 1; m.res.fire = -0.3; }
    if (b.mech === 'reflect') { m.res.fire = 1; }
    if (b.mech === 'cleanse') { m.immune = pick(EL_KEYS); m.res = {}; m.res[m.immune] = 1; }
    F.mons = [m];
  }

  function alive(F) { var a = []; for (var i = 0; i < F.mons.length; i++) if (F.mons[i].hp > 0) a.push(F.mons[i]); return a; }
  function buffSum(F, k) { var v = 0; for (var i = 0; i < F.buf.length; i++) if (F.buf[i][k]) v += F.buf[i][k]; return v; }

  function hasSt(m, k) { return m.st[k] && m.st[k].t > 0; }

  function applyStatus(s, c, F, m, k, ch, sn) {
    if (m.hp <= 0 || rand() > ch) return;
    var b = c.bonds; F.rep.statusApplied++;
    if (k === 'freeze') {
      if (m.fimm > 0) return;
      var dur = 1 + bondVal(b, 'ice') + (s.cls === 'sw' && s.sk.t === 'frost' ? 0.5 : 0);
      if (m.boss) dur *= 0.8;
      // 蒸腾：冰打在灼烧目标上
      if (hasSt(m, 'burn')) { steam(s, c, F, m); return; }
      m.st.freeze = { t: dur }; m.fimm = dur + 1;
    } else if (k === 'burn') {
      var n = sn || 1;
      if (s.cls === 'sw' && s.sk.t === 'flame') n += 1;
      if (hasSt(m, 'freeze')) { steam(s, c, F, m); return; }
      if (hasSt(m, 'erode')) { n *= 2; rx(F, 'devour'); m.devour = 4; }
      var cap = 10 + (s.cls === 'mg' && s.sk.t === 'inferno' ? 10 : 0);
      var cur = hasSt(m, 'burn') ? m.st.burn.n : 0;
      m.st.burn = { t: 4, n: Math.min(cap, cur + n), dps: c.atk * 0.12 * (1 + (c.fire) / 100) * (1 + bondVal(b, 'fire') / 100), tick: hasSt(m, 'burn') ? m.st.burn.tick : 1 };
    } else if (k === 'shock') {
      m.st.shock = { t: 3 };
    } else if (k === 'erode') {
      m.st.erode = { t: 4 };
    } else if (k === 'mark') {
      m.st.mark = { t: 5 };
    }
    if (hasSt(m, 'erode') && hasSt(m, 'mark') && !(m.voidT > 0)) { m.voidT = 3; rx(F, 'void'); }
  }

  function steam(s, c, F, m) {
    var n = hasSt(m, 'burn') ? m.st.burn.n : 1;
    delete m.st.burn; delete m.st.freeze;
    rx(F, 'steam');
    var mult = (1.5 + 0.4 * n) * (c.leg.frostfire ? 1.5 : 1);
    hit(s, c, F, m, mult, 'fire', 'react', { react: true, noProc: true });
  }

  // 造成一次伤害（核心乘区计算）
  function hit(s, c, F, m, mult, el, src, o) {
    o = o || {};
    if (m.hp <= 0) return 0;
    var rep = F.rep;
    if (o.single && m.dodge && rand() < m.dodge) { addR(rep.dmg, '闪避', 0); return 0; }
    var raw = c.atk * mult;
    var zAdd = 1 + (c.atkp + buffSum(F, 'atk') + buffSum(F, 'dmg')) / 100;
    var zEl = el !== 'phys' ? 1 + (c[el] || 0) / 100 : 1;
    var zReact = 1;
    if (el === 'thunder' && hasSt(m, 'freeze')) { zReact = (s.cls === 'mg' && s.sk.t === 'shatter') ? 3 : 2; rx(F, 'shatter'); o.react = true; }
    if (el === 'fire' && hasSt(m, 'freeze') && c.leg.frostfire) zReact *= 2;
    if (o.react) zReact *= 1 + c.react / 100;
    if (m.devour > 0 && src === 'burn' && s.cls === 'mg' && s.sk.t === 'inferno') zReact *= 1.5;
    var crit = false, zCrit = 1;
    if (!o.dot) {
      var cc = c.critc + (s.cls === 'ar' && hasSt(m, 'mark') ? 20 : 0);
      if (el === 'thunder' && hasSt(m, 'mark') && hasSt(m, 'shock')) { cc = 100; if (!o.judgeCounted) rx(F, 'judge'); }
      if (rand() * 100 < cc) { crit = true; zCrit = (c.critd + (s.cls === 'ar' && s.sk.t === 'hawk' && hasSt(m, 'mark') ? 50 : 0)) / 100; }
    }
    var zVuln = 1 + (hasSt(m, 'mark') ? (25 + bondVal(c.bonds, 'holy')) / 100 : 0);
    var mightCap = c.leg.might ? 150 : 100, mightPer = c.leg.might ? 1.5 : 1;
    var zMight = 1 + Math.min(F.might, mightCap) * mightPer / 100;
    var zReso = s.cls === 'mg' ? 1 + F.reso * 0.15 : 1;
    var zAoe = (o.multi && c.leg.aoe) ? 1.4 : 1;
    var r = el !== 'phys' ? (m.res[el] || 0) : 0;
    if (r < 1) { if (m.voidT > 0) r = Math.min(r, 0); else if (c.leg['void']) r = Math.max(r - 0.3, Math.min(r, 0)); }
    var zRes = 1 - r;
    var effDef = m.def * (hasSt(m, 'erode') ? 1 - (40 + bondVal(c.bonds, 'dark')) / 100 : 1);
    var K = 40 + s.lvl * 6, zDef = o.dot ? 1 : K / (K + effDef);
    var d = raw * zAdd * zEl * zReact * zCrit * zVuln * zMight * zReso * zAoe * zRes * zDef;
    if (m.boss && m.mech === 'summon' && F.mons.some(function (x) { return x.add && x.hp > 0; })) d *= 0.3;
    d = Math.max(0, d * (0.92 + rand() * 0.16));
    if (zRes <= 0) { rep.wasted++; d = 0; }
    // 护盾
    var sh = 0;
    if (m.shield > 0 && d > 0) {
      var sm = (el === 'dark' || el === 'thunder') ? 1.5 : 0.5, sd = d * sm;
      if (sd >= m.shield) { sh = m.shield; d = (sd - m.shield) / sm; m.shield = 0; } else { sh = sd; m.shield -= sd; d = 0; }
    }
    d = Math.round(d);
    m.hp -= d;
    var dd = d + Math.round(sh);
    addR(rep.dmg, src, dd); addR(rep.el, el, dd); rep.total += dd;
    if (o.react) rep.reactDmg += d;
    if (o.multi) rep.aoeDmg += d;
    if (crit) rep.critDmg += d;
    if (c.leech && !o.dot) healHero(s, c, F, d * c.leech / 100);
    if (s.cls === 'sw' && !o.dot) {
      var rl = c.leech + (F.rage / 100) * (s.sk.t === 'blood' ? 16 : 8);
      if (rl > c.leech) healHero(s, c, F, d * (rl - c.leech) / 100);
      F.rage = Math.min(100, F.rage + (hasSt(m, 'freeze') && s.sk.t === 'frost' ? 10 : 5));
    }
    if (crit && m.boss && m.mech === 'reflect' && d > 0) {
      var rf = d * 0.35; F.rep.reflect += rf; damageHero(s, c, F, rf, '反伤');
    }
    if (F.ui) F.ui.push({ t: 'd', m: m, d: dd, crit: crit, el: el, react: !!o.react, src: src, dot: !!o.dot });
    // 感电弹射
    if (!o.noProc && hasSt(m, 'shock') && d > 0) {
      var nb = 1 + bondVal(c.bonds, 'thunder') + (c.leg.storm ? 2 : 0);
      var others = alive(F).filter(function (x) { return x !== m; });
      for (var i = 0; i < nb && i < others.length; i++) hit(s, c, F, others[i], mult * 0.4, el, 'bounce', { noProc: true, multi: true });
    }
    if (m.hp <= 0) onDeath(s, c, F, m);
    return d;
  }

  function healHero(s, c, F, v) { if (v > 0) s.hp = Math.min(c.hp, s.hp + v); }
  function damageHero(s, c, F, v, src) {
    if (F.shield > 0) { var a = Math.min(F.shield, v); F.shield -= a; v -= a; }
    s.hp -= v; addR(F.rep.taken, src, v);
    F.rep.hpMin = Math.min(F.rep.hpMin, Math.max(0, s.hp) / c.hp);
    if (F.ui && v > 0) F.ui.push({ t: 'h', d: Math.round(v) });
  }

  function onDeath(s, c, F, m) {
    if (m.dead) return; m.dead = true;
    if (F.boss && !m.boss) return;
    if (m.boss) { F.done = true; F.rep.result = 'win'; return; }
    F.rep.kills++; F.might = Math.min(c.leg.might ? 150 : 100, F.might + 1);
    if (F.reward) reward(s, c, F, m);
  }

  function reward(s, c, F, m) {
    var L = m.L, E = F.reward;
    var xp = Math.round((6 + 3 * L + 0.05 * L * L) * (1 + c.exp / 100));
    var gd = Math.round((1 + 0.9 * L) * (1 + c.gold / 100) * (0.8 + rand() * 0.4));
    var dropBonus = 1 + Math.min(F.might, 150) * 0.005;
    s.gold += gd; s.kills++; s.zk++; E.gold += gd; E.kills++; F.rep.exp += xp; F.rep.gold += gd;
    gainExp(s, xp, E);
    if (rand() < 0.05 * dropBonus) addItem(s, makeItem(F.zi, L, rollR(0)), E);
    if (rand() < 0.004 * dropBonus) { s.gems.b++; E.gems++; }
    if (rand() < 0.0012 * dropBonus) { s.gems.s++; E.gems++; E.log('掉落 🔮灵魂石', 'r2'); }
    if (rand() < 0.0001 * dropBonus) { s.gems.g++; E.gems++; E.log('掉落 🧿守护符', 'r3'); }
    if (rand() < 0.0003 * dropBonus) dropBook(s, E);
  }

  function dropBook(s, E) {
    var pool = Object.keys(SK).filter(function (k) { return (SK[k].cls === s.cls || SK[k].cls === 'all') && s.books.indexOf(k) < 0; });
    if (!pool.length) { s.gold += 500; E.log('技能书已全部学会，转化为 500 金币'); return null; }
    var k = pick(pool); s.books.push(k); E.books++;
    E.log('📖 学会新技能：' + SK[k].n, 'r3'); E.dirty = true;
    return k;
  }

  function gainExp(s, xp, E) {
    if (s.lvl >= MAX_LV) return;
    s.exp += xp; E.exp += xp;
    while (s.lvl < MAX_LV && s.exp >= expNeed(s.lvl)) {
      s.exp -= expNeed(s.lvl); s.lvl++; s.pts += 5; E.lv++;
      E.log('★ 升级！Lv' + s.lvl + '（获得 5 属性点）', 'lv'); E.dirty = true;
    }
  }

  function addItem(s, it, E) {
    E.items++; E.dirty = true;
    if (s.set.autoEq !== 'off' && canEquip(s, it)) {
      var cur = s.eq[it.slot];
      if (!cur || (s.set.autoEq === 'better' && score(it) > score(cur) * 1.05)) {
        s.eq[it.slot] = it; E.log('自动穿上 ' + itemLabel(it), 'r' + it.r);
        if (!cur) return; it = cur;
      }
    }
    if (!it.lk && it.p === 0 && it.r < s.set.sell) { sell(s, it); E.sold++; return; }
    if (s.bag.length >= BAG_MAX) {
      var wi = -1, w = it;
      for (var i = 0; i < s.bag.length; i++) if (!s.bag[i].lk && score(s.bag[i]) < score(w)) { w = s.bag[i]; wi = i; }
      if (wi >= 0) { s.bag.splice(wi, 1); s.bag.push(it); }
      sell(s, w); E.sold++; return;
    }
    s.bag.push(it);
    if (it.r >= 2) E.log('获得 ' + itemLabel(it), 'r' + it.r);
  }
  function sell(s, it) { var g = sellPrice(it); s.gold += g; return g; }

  function canEquip(s, it) { return s.lvl >= it.req.lvl && (it.slot !== 'weapon' || it.cls === s.cls); }

  // ---------- 英雄行动 ----------
  function heroAct(s, c, F) {
    var tg = alive(F); if (!tg.length) return;
    var main = tg[0];
    // 剑士怒斩
    if (s.cls === 'sw' && F.rage >= 100) {
      F.rage = 0;
      if (s.sk.t === 'flame') { tg.forEach(function (m) { hit(s, c, F, m, 3, 'fire', '怒斩', { multi: true }); applyStatus(s, c, F, m, 'burn', 1, 3); }); }
      else hit(s, c, F, main, 8, 'phys', '怒斩', { single: true });
      return;
    }
    var slots = s.sk.c.concat(s.sk.g);
    var ench = null;
    for (var i = 0; i < slots.length; i++) {
      var id = slots[i]; if (!id) continue; var k = SK[id];
      if (k.t === 'ench') { ench = k; continue; }
      if ((F.cds[id] || 0) > 0) continue;
      if (k.t === 'heal' && s.hp > c.hp * 0.7) continue;
      castSkill(s, c, F, id, k, tg);
      F.cds[id] = k.cd * (1 - c.cdr / 100);
      return;
    }
    // 普攻
    var bel = ench ? ench.el : 'phys';
    if (s.cls === 'ar') {
      var cap = s.sk.t === 'multi' ? 6 : 4;
      var arrows = Math.min(cap, 1 + Math.floor(Math.max(0, c.aspd * (1 - (ZONES[F.zi].slow || 0)) + buffSum(F, 'aspd') / 100 - 1) / 0.4));
      if (s.sk.t === 'frostarrow' && hasSt(main, 'freeze')) arrows++;
      for (var a = 0; a < arrows; a++) {
        var t2 = alive(F)[0]; if (!t2) break;
        hit(s, c, F, t2, 0.5, bel, '普攻', { single: true });
        if (ench) applyStatus(s, c, F, t2, EL[bel].st, 0.25, 1);
      }
    } else {
      hit(s, c, F, main, 1, bel, '普攻', { single: true });
      if (ench) applyStatus(s, c, F, main, EL[bel].st, 0.25, 1);
    }
  }

  function castSkill(s, c, F, id, k, tg) {
    var src = k.n;
    if (s.cls === 'mg' && k.el !== 'phys') {
      var cap = s.sk.t === 'master' ? 8 : 5;
      if (F.resoEl && F.resoEl !== k.el) F.reso = Math.min(cap, F.reso + 1);
      F.resoEl = k.el; F.resoT = 6;
    }
    if (k.t === 'buff') { F.buf.push({ atk: k.buff.atk || 0, aspd: k.buff.aspd || 0, dmg: k.buff.dmg || 0, t: k.buff.dur }); if (k.rage) F.rage = Math.min(100, F.rage + k.rage); return; }
    if (k.t === 'heal') { healHero(s, c, F, c.hp * k.heal); return; }
    if (k.t === 'shield') { F.shield = Math.max(F.shield, c.hp * k.shield); if (k.cc) F.cc = k.cc; return; }
    var targets;
    if (k.t === 'single') targets = [tg[0]];
    else if (k.t === 'aoe') targets = tg;
    else targets = tg.slice(0, k.tn || 3);
    var multi = k.t !== 'single';
    for (var i = 0; i < targets.length; i++) {
      var m = targets[i]; if (m.hp <= 0) continue;
      hit(s, c, F, m, k.m, k.el, src, { single: k.t === 'single', multi: multi });
      if (k.st) applyStatus(s, c, F, m, k.st, (s.cls === 'ar' && id === 'ar_ice' && s.sk.t === 'frostarrow') ? 1 : k.ch, k.sn);
    }
    if (k.shield) F.shield = Math.max(F.shield, c.hp * k.shield);
  }

  // ---------- 推进一帧 ----------
  function step(s, c, F, dt) {
    var rep = F.rep, z = ZONES[F.zi];
    F.t += dt; rep.t += dt;
    F.potCd = Math.max(0, F.potCd - dt);
    for (var id in F.cds) F.cds[id] = Math.max(0, F.cds[id] - dt);
    F.buf = F.buf.filter(function (b) { b.t -= dt; return b.t > 0; });
    if (F.cc > 0) F.cc -= dt;
    if (s.cls === 'mg' && F.reso > 0) { F.resoT -= dt; if (F.resoT <= 0) { F.reso = Math.max(0, F.reso - 1); F.resoT = 2; } }

    if (F.rest > 0) { // 撤退休息
      F.rest -= dt; s.hp = Math.min(c.hp, s.hp + c.hp * 0.12 * dt);
      if (F.rest <= 0) F.rest = 0;
      return;
    }
    var al = alive(F);
    if (!al.length) {
      if (F.boss) { F.done = true; return; }
      F.spawnT += dt; if (F.spawnT < 0.5) return;
      F.spawnT = 0; spawnPack(s, F); al = F.mons;
    }
    // 环境
    if (z.lava) damageHero(s, c, F, c.hp * z.lava * (1 - c.rfire / 100) * dt, '环境灼烧');
    // 状态计时 & 灼烧
    for (var i = 0; i < F.mons.length; i++) {
      var m = F.mons[i]; if (m.hp <= 0) continue;
      if (m.fimm > 0) m.fimm -= dt;
      if (m.voidT > 0) m.voidT -= dt;
      if (m.devour > 0) m.devour -= dt;
      for (var k in m.st) {
        var o = m.st[k]; o.t -= dt;
        if (k === 'burn' && o.t > -dt) {
          o.tick -= dt;
          if (o.tick <= 0) { o.tick += 1; hit(s, c, F, m, (o.dps * o.n) / c.atk, 'fire', 'burn', { dot: true, noProc: true }); }
        }
        if (o.t <= 0) delete m.st[k];
      }
    }
    // 首领机制
    var bm = F.boss ? F.mons[0] : null;
    if (bm && bm.hp > 0) {
      F.bossT += dt;
      if (bm.mech === 'enrage' && F.bossT >= 45 && !bm.enr) { bm.enr = true; bm.atk *= 3; rep.enraged = true; }
      if (bm.mech === 'summon') {
        F.summonT += dt;
        if (F.summonT >= 7) {
          F.summonT = 0;
          for (var q = 0; q < 2; q++) F.mons.push(mkMon(F.zi, bm.L - 8, '骷髅', '💀', { add: true, hpm: 0.6 }));
        }
        if (F.mons.some(function (x) { return x.add && x.hp > 0; })) rep.addsT += dt;
      }
      if (bm.mech === 'breath' && bm.hp < bm.mhp * 0.5) {
        F.breathT += dt;
        if (F.breathT >= 8) {
          F.breathT = 0;
          if (F.cc > 0) addR(rep.taken, '吐息（已免疫）', 0);
          else { var fz = 2.5 * (1 - c.rice / 100); F.frozen = Math.max(F.frozen, fz); rep.frozenT += fz; }
          damageHero(s, c, F, bm.atk * 1.5 * (1 - c.rice / 100), '冰霜吐息');
        }
      }
      if (bm.mech === 'cleanse') {
        F.cleanseT += dt;
        if (F.cleanseT >= 20) {
          F.cleanseT = 0; var lost = Object.keys(bm.st).length; rep.statusLost += lost; bm.st = {}; rep.cleanse++;
          var ne = pick(EL_KEYS.filter(function (e) { return e !== bm.immune; })); bm.immune = ne; bm.res = {}; bm.res[ne] = 1;
          if (F.ui) F.ui.push({ t: 'msg', m: '审判者净化了所有状态，现在免疫' + EL[ne].n + '元素' });
        }
      }
    }
    // 英雄行动
    if (F.frozen > 0) F.frozen -= dt;
    else {
      var aspd = c.aspd * (1 - (z.slow || 0)) * (1 + buffSum(F, 'aspd') / 100);
      F.heroT += dt * aspd;
      while (F.heroT >= 1 && alive(F).length && !F.done) { F.heroT -= 1; heroAct(s, c, F); }
    }
    // 怪物攻击
    for (var j = 0; j < F.mons.length; j++) {
      var mo = F.mons[j]; if (mo.hp <= 0 || hasSt(mo, 'freeze')) continue;
      mo.at += dt;
      var iv = mo.boss ? (mo.enr ? 0.9 : 1.4) : 1.6;
      if (mo.at >= iv) {
        mo.at -= iv;
        var K = 40 + mo.L * 6;
        var dmg = mo.atk * (0.9 + rand() * 0.2) * K / (K + c.def);
        damageHero(s, c, F, dmg, mo.boss ? mo.n : '小怪');
        if (s.cls === 'sw') F.rage = Math.min(100, F.rage + 4);
      }
    }
    // 喝药 / 撤退 / 失败
    if (s.hp < c.hp * s.set.potAt / 100 && s.pot > 0 && F.potCd <= 0) {
      s.pot--; F.potCd = 2; rep.pot++; healHero(s, c, F, c.hp * 0.3 + 20); autoBuy(s);
    }
    if (F.boss) {
      if (s.hp <= 0) { s.hp = 1; F.done = true; rep.result = 'lose'; }
      else if (F.bossT >= 120) { F.done = true; rep.result = 'timeout'; }
    } else if (s.hp < c.hp * 0.15) {
      F.rest = 6; F.might = 0; F.mons = []; rep.flee++; s.st.flee++;
      if (s.hp < 1) s.hp = 1;
      if (F.reward) F.reward.log('生命过低，自动撤退休息（挂机不会死亡，战意清零）', 'warn');
    }
  }
  function autoBuy(s) {
    if (s.set.autoBuy && s.pot < 5) { var pr = potionPrice(s), n = Math.min(20, Math.floor(s.gold * 0.4 / pr)); if (n > 0) { s.pot += n; s.gold -= n * pr; } }
  }

  function mkE(quiet) {
    return { quiet: !!quiet, logs: [], exp: 0, gold: 0, kills: 0, items: 0, sold: 0, gems: 0, books: 0, lv: 0, dirty: false,
      log: function (t, cl) { if (!this.quiet) this.logs.push({ t: t, c: cl || '' }); } };
  }

  // 挂机推进（主循环、离线收益共用）
  function farm(s, sec, E, ui) {
    if (!s.F || s.F.boss || s.F.zi !== s.zone) s.F = newFight(s, s.zone, false);
    var F = s.F; F.reward = E; F.ui = ui || null;
    var c = calc(s), dt = E.quiet ? 0.5 : 0.1, acc = 0;
    if (s.hp > c.hp) s.hp = c.hp;
    while (sec > 0) {
      var d = Math.min(dt, sec); step(s, c, F, d); sec -= d; acc += d;
      if (acc >= 2) { acc = 0; c = calc(s); }
      if (F.rep.t > 600) F.rep = newRep();
    }
    F.reward = null; F.ui = null;
    return F;
  }

  // ---------- 首领挑战 ----------
  function startBoss(s) {
    var F = newFight(s, s.zone, true); spawnBoss(s, F); s.F = F; s.st.bossTry++;
    var c = calc(s); s.hp = c.hp;
    return F;
  }
  function bossStep(s, sec, ui) {
    var F = s.F; if (!F || !F.boss) return null;
    var c = calc(s); F.ui = ui || null;
    while (sec > 0 && !F.done) { var d = Math.min(0.1, sec); step(s, c, F, d); sec -= d; }
    F.ui = null;
    if (F.done) return finishBoss(s, c, F);
    return null;
  }
  function finishBoss(s, c, F) {
    var rep = F.rep, out = { rep: rep, rewards: [] };
    if (rep.result === 'win') {
      var zi = F.zi, first = !s.bossWin[zi];
      var z = ZONES[zi], L = z.min + 12, E = mkE(true);
      var g = Math.round((1 + 0.9 * L) * 40); s.gold += g; out.rewards.push('💰 ' + g + ' 金币');
      gainExp(s, Math.round((6 + 3 * L + 0.05 * L * L) * 30), E);
      s.gems.b += 2; s.gems.s += 1; out.rewards.push('💎 强化石 ×2', '🔮 灵魂石 ×1');
      if (rand() < 0.2) { s.gems.g++; out.rewards.push('🧿 守护符 ×1'); }
      var it = makeItem(zi, L, Math.max(2, rollR(1))); it.p = rnd(0, 3); addItem(s, it, E); out.rewards.push('装备：' + itemLabel(it));
      if (first) {
        s.bossWin[zi] = true;
        var lg = makeLegend(zi, s.cls); s.bag.push(lg); out.rewards.push('🌟 首杀传说：' + lg.name + '（' + LEG[zi].d + '）');
        var bk = dropBook(s, E); if (bk) out.rewards.push('📖 技能书：' + SK[bk].n);
        if (zi + 1 < ZONES.length) out.rewards.push('🗺️ 解锁新地图：' + ZONES[zi + 1].n + '（需 Lv' + ZONES[zi + 1].min + '）');
      } else if (rand() < 0.3) { var bk2 = dropBook(s, E); if (bk2) out.rewards.push('📖 技能书：' + SK[bk2].n); }
      s.zk = 0;
    }
    out.tips = tips(s, c, F);
    s.lastRep = { zi: F.zi, boss: true, rep: rep, tips: out.tips, rewards: out.rewards, at: Date.now() };
    s.F = null; s.hp = c.hp;
    return out;
  }

  // ---------- 木桩试炼（瞬间模拟，不影响存档） ----------
  function trial(s, zi, boss) {
    var keep = seed; seed = 12345 + zi * 97 + (boss ? 1 : 0);
    var t = JSON.parse(JSON.stringify(s)); t.F = null; t.pot = 999;
    var c = calc(t); t.hp = c.hp;
    var F = newFight(t, zi, boss);
    if (boss) spawnBoss(t, F);
    var limit = boss ? 120 : 60;
    while (F.t < limit && !F.done) {
      step(t, c, F, 0.1);
      if (!boss && F.rest > 0) { F.rest = 0; t.hp = c.hp; } // 试炼中撤退记次数，但不停
    }
    if (boss && !F.rep.result) F.rep.result = 'timeout';
    var rep = F.rep;
    var dps = rep.total / Math.max(1, rep.t);
    var out = { zi: zi, boss: boss, rep: rep, dps: Math.round(dps), tips: tips(t, c, F) };
    if (!boss) {
      var kpm = rep.kills / (rep.t / 60);
      var Lavg = ZONES[zi].min + 3 + zi * 1.5;
      out.kpm = Math.round(kpm * 10) / 10;
      out.expH = Math.round(kpm * 60 * (6 + 3 * Lavg + 0.05 * Lavg * Lavg) * (1 + c.exp / 100) * (rep.flee ? 0.7 : 1));
      out.goldH = Math.round(kpm * 60 * (1 + 0.9 * Lavg) * (1 + c.gold / 100) * (rep.flee ? 0.7 : 1));
      out.safe = rep.flee === 0 && rep.pot < 20;
    }
    seed = keep;
    return out;
  }

  // ---------- 战报提示 ----------
  function tips(s, c, F) {
    var r = F.rep, T = [], z = ZONES[F.zi], tot = Math.max(1, r.total);
    var bm = F.boss ? F.mons[0] : null;
    if (r.result === 'lose') T.push('你被击败了：先提升等级、生命和防御（体力、装备强化），或带护盾、治疗、冻结控场来减少受到的伤害。');
    if (r.result === 'timeout' || r.enraged) T.push('输出不够：' + (r.enraged ? '首领进入了狂暴。' : '120 秒内没打完。') + '提高单体爆发，或利用元素反应的翻倍效果。');
    if (r.reflect > c.hp * 0.3) T.push('炎魔反弹了 ' + Math.round(r.reflect) + ' 点伤害。降低暴击依赖，改用灼烧（持续伤害不反弹）或反应伤害。');
    if (r.wasted > 5) T.push('有 ' + r.wasted + ' 次攻击打在免疫的元素上，全部无效。换掉被免疫的元素技能。');
    if (r.addsT > 30 && r.aoeDmg / tot < 0.3) T.push('召唤物在场 ' + Math.round(r.addsT) + ' 秒，巫师受到的伤害大减。带群攻、弹射或穿透技能。');
    if (r.frozenT > 5) T.push('你被冻结了 ' + r.frozenT.toFixed(1) + ' 秒。堆冰霜抗性，或带「元素护盾」免疫冻结。');
    if (r.cleanse > 0 && r.statusLost > 3) T.push('审判者净化了 ' + r.statusLost + ' 个状态。依赖持续叠层的流派吃亏，试试快速打出反应的双元素搭配。');
    if (r.taken['环境灼烧'] > c.hp * 2) T.push('熔岩环境灼烧伤害很高。堆火焰抗性、吸血或带治疗。');
    if (r.flee > 0) T.push('生存不足，撤退了 ' + r.flee + ' 次（战意会清零）。提高生命、防御、吸血，或带控制（冻结）和护盾。');
    var dodge = r.dmg['闪避'] !== undefined;
    if (z.dodge && (r.aoeDmg / tot) < 0.25) T.push('幽暗森林的幽灵会闪避单体攻击，怪物也多，群攻和弹射更划算。');
    if (z.res) for (var e in z.res) if ((r.el[e] || 0) / tot > 0.3) T.push(z.n + '的怪物抗' + EL[e].n + '，你有 ' + Math.round(r.el[e] / tot * 100) + '% 伤害是' + EL[e].n + '元素，效率很低。');
    if (z.shield && ((r.el.dark || 0) + (r.el.thunder || 0)) / tot < 0.2) T.push('天空之城的怪带护盾，暗和雷伤害破盾 ×1.5，其他伤害只有一半。');
    var reacts = 0; for (var k in r.react) reacts += r.react[k];
    var els = 0; EL_KEYS.forEach(function (e) { if ((r.el[e] || 0) / tot > 0.08) els++; });
    if (reacts < 3 && els <= 1) T.push('几乎没打出元素反应。试试两种元素搭配：冰+雷（碎裂 ×2）、火+暗（炎噬）、冰+火（蒸腾）。');
    if (!T.length) T.push(r.result === 'win' ? '打得不错！这套搭配适合这里。' : '搭配基本合理，可以继续提升装备和强化。');
    return T;
  }

  // ---------- 操作 ----------
  function findItem(s, id) {
    for (var k in s.eq) if (s.eq[k] && s.eq[k].id === id) return { it: s.eq[k], eq: k };
    for (var i = 0; i < s.bag.length; i++) if (s.bag[i].id === id) return { it: s.bag[i], idx: i };
    return null;
  }
  function equip(s, id) {
    var f = findItem(s, id); if (!f || f.eq) return '';
    if (!canEquip(s, f.it)) return f.it.slot === 'weapon' && f.it.cls !== s.cls ? '这是' + CLS[f.it.cls].n + '的武器' : '等级不足';
    var cur = s.eq[f.it.slot]; s.bag.splice(f.idx, 1); s.eq[f.it.slot] = f.it; if (cur) s.bag.push(cur);
    return '';
  }
  function unequip(s, slot) { var it = s.eq[slot]; if (!it) return ''; if (s.bag.length >= BAG_MAX) return '背包已满'; delete s.eq[slot]; s.bag.push(it); return ''; }
  function sellById(s, id) { var f = findItem(s, id); if (!f || f.eq || f.it.lk) return 0; s.bag.splice(f.idx, 1); return sell(s, f.it); }
  function sellBulk(s, maxR) { var g = 0, n = 0; s.bag = s.bag.filter(function (it) { if (!it.lk && it.r <= maxR && it.r < 3) { g += sell(s, it); n++; return false; } return true; }); return { n: n, g: g }; }

  function upgrade(s, id, guard) {
    var f = findItem(s, id); if (!f) return { res: 'err', msg: '找不到装备' };
    var it = f.it; if (it.p >= 15) return { res: 'err', msg: '已到最高 +15' };
    var need = upNeed(it.p), cost = upCost(it);
    if (s.gems.b < need.b) return { res: 'err', msg: '强化石不足' };
    if (s.gems.s < need.s) return { res: 'err', msg: '灵魂石不足' };
    if (s.gold < cost) return { res: 'err', msg: '金币不足' };
    s.gems.b -= need.b; s.gems.s -= need.s; s.gold -= cost;
    var from = it.p;
    if (rand() < RATE[it.p]) { it.p++; s.st.upOk++; s.st.maxPlus = Math.max(s.st.maxPlus, it.p); return { res: 'ok', msg: '强化成功！' + it.name + ' +' + from + ' → +' + it.p }; }
    s.st.upFail++;
    if (it.p < 9) { it.p = Math.max(0, it.p - 1); return { res: 'down', msg: '强化失败… 降为 +' + it.p }; }
    if (guard && s.gems.g > 0) { s.gems.g--; it.p = 9; return { res: 'guard', msg: '强化失败！守护符生效，装备保住了（回到 +9）' }; }
    if (f.eq) delete s.eq[f.eq]; else s.bag.splice(f.idx, 1);
    s.st.broken++;
    return { res: 'break', msg: '强化失败… ' + itemLabel(it) + ' 碎掉了！' };
  }

  function buy(s, k, n) {
    n = n || 1; var p = shopPrice(s, k) * n;
    if (s.gold < p) return { err: '金币不足' };
    if (k === 'book') {
      var E = mkE(true); var before = s.books.length; s.gold -= p; var bk = dropBook(s, E);
      if (!bk) { s.gold += p; return { err: '本职业和通用技能书已全部学会' }; }
      return { msg: '学会新技能：' + SK[bk].n };
    }
    if (k === 'reset') {
      s.gold -= p; var b = CLS[s.cls].base, spent = (s.str - b.str) + (s.agi - b.agi) + (s.vit - b.vit) + (s.ene - b.ene);
      s.str = b.str; s.agi = b.agi; s.vit = b.vit; s.ene = b.ene; s.pts += spent; return { msg: '属性点已重置，返还 ' + spent + ' 点' };
    }
    s.gold -= p;
    if (k === 'pot') s.pot += n; else s.gems[k] += n;
    return { msg: '购买成功' };
  }
  function addPoint(s, k, n) { n = Math.min(n || 1, s.pts); if (n <= 0 || ['str', 'agi', 'vit', 'ene'].indexOf(k) < 0) return; s[k] += n; s.pts -= n; }

  function setSkill(s, group, idx, id) {
    var arr = s.sk[group];
    if (id) {
      var k = SK[id]; if (!k || s.books.indexOf(id) < 0) return '还没学会';
      if (group === 'c' && k.cls !== s.cls) return '职业技能栏只能放本职业技能';
      if (group === 'g' && k.cls !== 'all') return '通用技能栏只能放通用技能';
      var all = s.sk.c.concat(s.sk.g);
      if (all.indexOf(id) >= 0) { // 交换
        var gi = s.sk.c.indexOf(id) >= 0 ? 'c' : 'g', ii = s.sk[gi].indexOf(id);
        s.sk[gi][ii] = arr[idx];
      }
      if (group === 'g' && k.t === 'ench') { // 只能带一个附魔
        for (var j = 0; j < s.sk.g.length; j++) if (j !== idx && s.sk.g[j] && SK[s.sk.g[j]].t === 'ench') s.sk.g[j] = null;
      }
    }
    arr[idx] = id || null;
    if (s.F && !s.F.boss) s.F.cds = {};
    return '';
  }

  function saveLoad(s, i, name) {
    var eq = {}; for (var k in s.eq) eq[k] = s.eq[k].id;
    s.loads[i] = { name: name || ('方案' + (i + 1)), sk: JSON.parse(JSON.stringify(s.sk)), eq: eq };
  }
  function applyLoad(s, i) {
    var L = s.loads[i]; if (!L) return '空方案';
    var miss = 0;
    for (var slot in L.eq) {
      if (s.eq[slot] && s.eq[slot].id === L.eq[slot]) continue;
      var f = findItem(s, L.eq[slot]);
      if (f && !f.eq) equip(s, L.eq[slot]); else if (!f) miss++;
    }
    var sk = JSON.parse(JSON.stringify(L.sk));
    sk.c = sk.c.map(function (id) { return id && s.books.indexOf(id) >= 0 ? id : null; });
    sk.g = sk.g.map(function (id) { return id && s.books.indexOf(id) >= 0 ? id : null; });
    s.sk = sk;
    return miss ? ('有 ' + miss + ' 件装备已不在（卖掉或碎了）') : '';
  }
  function buildCode(s) {
    var o = { c: s.cls, lv: s.lvl, a: [s.str, s.agi, s.vit, s.ene], sk: s.sk, eq: {} };
    for (var k in s.eq) { var it = s.eq[k]; o.eq[k] = { n: itemLabel(it), r: it.r, e: it.el, a: it.af.map(function (x) { return x.k + ':' + x.v; }) }; }
    var json = JSON.stringify(o);
    try { return 'MMU1-' + btoa(unescape(encodeURIComponent(json))); } catch (e) { return ''; }
  }
  function readCode(code) {
    try { var j = decodeURIComponent(escape(atob(code.trim().replace(/^MMU1-/, '')))); var o = JSON.parse(j); if (!CLS[o.c]) return null; return o; } catch (e) { return null; }
  }

  return {
    EL: EL, EL_KEYS: EL_KEYS, ST: ST, REACT: REACT, BOND: BOND, CLS: CLS, SK: SK, TAL: TAL, ZONES: ZONES, LEG: LEG,
    RAR: RAR, SLOTS: SLOTS, SLOT_KEYS: SLOT_KEYS, AFF_MAP: AFF_MAP, RATE: RATE, GEMS: GEMS, BAG_MAX: BAG_MAX, WPN_I: WPN_I, BOSS_KILLS: BOSS_KILLS,
    newState: newState, fixState: fixState, calc: calc, bonds: bonds, bondVal: bondVal, farm: farm, mkE: mkE,
    startBoss: startBoss, bossStep: bossStep, trial: trial, alive: alive, hasSt: hasSt,
    itemVal: itemVal, statName: statName, sellPrice: sellPrice, shopPrice: shopPrice, upCost: upCost, upNeed: upNeed,
    expNeed: expNeed, canEquip: canEquip, itemLabel: itemLabel, findItem: findItem, equip: equip, unequip: unequip,
    sellById: sellById, sellBulk: sellBulk, upgrade: upgrade, buy: buy, addPoint: addPoint, setSkill: setSkill,
    saveLoad: saveLoad, applyLoad: applyLoad, buildCode: buildCode, readCode: readCode, score: score, makeItem: makeItem
  };
})();
if (typeof module !== 'undefined') module.exports = MMU;
