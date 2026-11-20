(function () {
  'use strict';
  var M = MMU, KEY = 'mmu_save_v1';
  var S = null, tab = 'char', E = M.mkE(false), logs = [], lastTick = Date.now();
  var selItem = null, upSel = null, upRes = null, guard = false, trialRes = null, trialZone = 0, trialBoss = false;
  var skSel = null, panelDirty = true, lastPanel = 0, bannerT = 0;
  var $ = function (id) { return document.getElementById(id); };
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(n) { n = Math.round(n); if (n >= 1e8) return (n / 1e8).toFixed(2) + '亿'; if (n >= 1e4) return (n / 1e4).toFixed(1) + '万'; return '' + n; }
  function toast(t) { var e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(function () { e.classList.remove('on'); }, 2200); }
  function modal(html) { $('modal').innerHTML = html; $('mw').classList.remove('hidden'); }
  function closeModal() { $('mw').classList.add('hidden'); }
  $('mw').addEventListener('click', function (e) { if (e.target.id === 'mw') closeModal(); });

  // ---------- 存档 ----------
  var RKEY = 'mmu_roster_v1', CMAX = 5, R = null;
  function rosterLoad() {
    try { R = JSON.parse(localStorage.getItem(RKEY) || 'null'); } catch (e) { R = null; }
    if (!R || !R.list) {
      R = { cur: null, list: [] };
      try { var old = localStorage.getItem(KEY); if (old) { var o = JSON.parse(old); var id = 'c' + Date.now(); localStorage.setItem('mmu_char_' + id, old); R.list.push({ id: id, cls: o.cls, lvl: o.lvl }); R.cur = id; rosterSave(); } } catch (e) { }
    }
  }
  function rosterSave() { try { localStorage.setItem(RKEY, JSON.stringify(R)); } catch (e) { } }
  function save() {
    if (!S || !R || !R.cur) return; S.last = Date.now();
    try { var F = S.F; S.F = null; localStorage.setItem('mmu_char_' + R.cur, JSON.stringify(S)); S.F = F; } catch (e) { }
    var me = R.list.filter(function (c) { return c.id === R.cur; })[0]; if (me) { me.lvl = S.lvl; me.cls = S.cls; } rosterSave();
  }
  function loadChar(id) { try { var t = localStorage.getItem('mmu_char_' + id); if (t) return M.fixState(JSON.parse(t)); } catch (e) { } return null; }
  function load() { rosterLoad(); return R.cur ? loadChar(R.cur) : null; }
  function newChar(cls) {
    save(); var id = 'c' + Date.now(); S = M.newState(cls); R.cur = id; R.list.push({ id: id, cls: cls, lvl: 1 }); logs = []; E = M.mkE(false); save();
  }
  function switchChar(id) {
    if (id === R.cur) { closeModal(); return; }
    save(); var o = loadChar(id); if (!o) { toast('角色数据丢失'); return; }
    o.last = Date.now(); S = o; R.cur = id; logs = []; E = M.mkE(false); lastTick = Date.now(); save(); closeModal(); build(); toast('已切换到 ' + M.CLS[S.cls].n + ' Lv' + S.lvl);
  }
  function roster() {
    save();
    var h = '<h4>👥 我的角色</h4><div class="muted">每个角色的等级、装备、背包、金币都各自独立。只有当前角色在挂机，切走的角色会停在原地。</div><div class="rlist">';
    R.list.forEach(function (c) {
      var cur = c.id === R.cur;
      h += '<div class="rc' + (cur ? ' on' : '') + '" data-id="' + c.id + '"><img src="' + ART_IMG['cut_' + c.cls + '_t1'] + '"><div><b>' + M.CLS[c.cls].n + '</b> <span class="lv">Lv' + c.lvl + '</span>' + (cur ? ' <span class="muted">· 当前</span>' : '') + '</div></div>';
    });
    if (R.list.length < CMAX) h += '<div class="rc add" id="rAdd"><div class="plus">＋</div><div><b>新建角色</b><div class="muted">还可建 ' + (CMAX - R.list.length) + ' 个</div></div></div>';
    h += '</div><div class="btns"><button id="rX">关闭</button></div>';
    modal(h);
    document.querySelectorAll('.rlist .rc[data-id]').forEach(function (el) { el.onclick = function () { switchChar(el.dataset.id); }; });
    if ($('rAdd')) $('rAdd').onclick = function () { classSelect(true); };
    $('rX').onclick = closeModal;
  }


  // ---------- 云存档 ----------
  var CKEY = 'mmu_cloud_v1', C = null, cBusy = false, cLast = 0, API = '/api/save';
  try { C = JSON.parse(localStorage.getItem(CKEY) || 'null'); } catch (e) { C = null; }
  function cSave() { try { localStorage.setItem(CKEY, JSON.stringify(C)); } catch (e) { } }
  function sha256(t) { return crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)).then(function (b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }); }
  function api(o, keep) { return fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(o), keepalive: !!keep }).then(function (r) { return r.json().then(function (j) { j._s = r.status; return j; }); }); }
  function packAll() {
    save(); var chars = {};
    R.list.forEach(function (c) { var t = localStorage.getItem('mmu_char_' + c.id); if (t) chars[c.id] = t; });
    return { roster: R, chars: chars };
  }
  function applyAll(d) {
    if (!d || !d.roster || !d.roster.list) return false;
    Object.keys(d.chars || {}).forEach(function (id) { try { localStorage.setItem('mmu_char_' + id, d.chars[id]); } catch (e) { } });
    R = d.roster; rosterSave();
    var o = R.cur ? loadChar(R.cur) : null; if (!o) return false;
    o.last = Math.max(o.last || 0, Date.now() - 8 * 3600 * 1000);
    S = o; logs = []; E = M.mkE(false); return true;
  }
  // 拉取：云端比上次同步新 → 用云端；否则推送本地
  function cSync(why, cb) {
    if (!C || cBusy) { cb && cb(false); return; }
    cBusy = true;
    api({ op: 'login', name: C.name, key: C.key }).then(function (j) {
      if (!j.ok) { cBusy = false; if (j._s === 403) { toast('云存档：' + (j.err || '密码错误')); } cb && cb(false); return; }
      if (j.ts > (C.ts || 0) && j.data) {
        var hadS = !!S;
        if (applyAll(j.data)) { C.ts = j.ts; cSave(); cBusy = false; cLast = Date.now(); if (hadS) { build(); toast('☁️ 已同步云端最新进度'); } cb && cb(true); return; }
      }
      cBusy = false; cPush(false, cb);
    }).catch(function () { cBusy = false; cb && cb(false); });
  }
  function cPush(keep, cb) {
    if (!C || cBusy || !S) { cb && cb(false); return; }
    cBusy = true;
    api({ op: 'push', name: C.name, key: C.key, prev: C.ts || 0, data: packAll() }, keep).then(function (j) {
      cBusy = false;
      if (j.ok) { C.ts = j.ts; cSave(); cLast = Date.now(); cb && cb(true); }
      else if (j.conflict) { C.ts = 0; cSave(); cSync('conflict', cb); }
      else cb && cb(false);
    }).catch(function () { cBusy = false; cb && cb(false); });
  }
  function cloudPanel() {
    if (C) {
      modal('<h4>☁️ 云存档</h4><div>账号：<b>' + esc(C.name) + '</b></div><div class="muted">上次同步：' + (cLast ? new Date(cLast).toLocaleTimeString() : '—') + '。每分钟自动同步，切到后台或关闭页面时也会同步。手机、电脑登录同一个账号即可共用进度（全部角色）。</div>' +
        '<div class="btns"><button class="pri" id="csn">立即同步</button><button id="cout">退出账号</button><button id="cx">关闭</button></div>');
      $('csn').onclick = function () { cPush(false, function (ok) { toast(ok ? '☁️ 已同步' : '同步失败，稍后会自动重试'); cloudPanel(); }); };
      $('cout').onclick = function () { cPush(false, function () { C = null; try { localStorage.removeItem(CKEY); } catch (e) { } closeModal(); toast('已退出云存档，进度仍保存在本机'); }); };
      $('cx').onclick = closeModal; return;
    }
    modal('<h4>☁️ 云存档</h4><div class="muted">起一个账号名和密码。手机、电脑用同一个账号登录，进度自动同步。<br>第一次用就是注册；已有账号就是登录（会载入云端进度）。</div>' +
      '<div class="cform"><input id="cn" placeholder="账号名（2-20 字）" maxlength="20"><input id="cp" type="password" placeholder="密码（至少 4 位）"></div>' +
      '<div class="btns"><button class="pri" id="cin">登录 / 注册</button><button id="cx">取消</button></div><div class="muted" id="cmsg"></div>');
    $('cx').onclick = closeModal;
    $('cin').onclick = function () {
      var n = $('cn').value.trim(), p = $('cp').value;
      if (n.length < 2 || p.length < 4) { $('cmsg').textContent = '账号名至少 2 个字，密码至少 4 位'; return; }
      $('cmsg').textContent = '连接中…';
      sha256('mmu:' + n.toLowerCase() + ':' + p).then(function (key) {
        return api({ op: 'login', name: n, key: key, register: 1 }).then(function (j) {
          if (!j.ok) { $('cmsg').textContent = j.err || '连接失败'; return; }
          C = { name: n, key: key, ts: 0 }; cSave();
          if (j.data && j.ts) {
            modal('<h4>☁️ 发现云端进度</h4><div>云端存档：' + (j.data.roster.list || []).map(function (c) { return M.CLS[c.cls].n + ' Lv' + c.lvl; }).join('、') + '</div><div class="muted">本机进度：' + R.list.map(function (c) { return M.CLS[c.cls].n + ' Lv' + c.lvl; }).join('、') + '</div>' +
              '<div class="btns"><button class="pri" id="cuc">用云端进度</button><button id="cul">用本机进度覆盖云端</button></div>');
            $('cuc').onclick = function () { if (applyAll(j.data)) { C.ts = j.ts; cSave(); cLast = Date.now(); closeModal(); build(); toast('☁️ 已载入云端进度'); } };
            $('cul').onclick = function () { C.ts = j.ts; cSave(); cPush(false, function (ok) { closeModal(); toast(ok ? '☁️ 已用本机进度覆盖云端' : '同步失败'); }); };
          } else { cPush(false, function (ok) { closeModal(); toast(j.created ? '☁️ 注册成功，进度已上传' : '☁️ 已登录并同步'); }); }
        });
      }).catch(function () { $('cmsg').textContent = '连接失败（本地打开的文件不支持云存档，请用网址打开）'; });
    };
  }
  // ---------- 选职业 ----------
  function classSelect(again) {
    var h = '<h4>选择你的职业</h4><div class="muted">职业决定「怎么打」，元素决定「打出什么效果」。每个职业都能搭出好几种流派。</div><div class="clsel" style="margin-top:8px">';
    ['sw', 'mg', 'ar'].forEach(function (k) {
      var c = M.CLS[k];
      h += '<div class="c" data-c="' + k + '"><div class="h">' + c.body + ' ' + c.n + '</div><div class="muted" style="margin:4px 0">' + esc(c.d) + '</div><div class="muted">流派：' +
        M.TAL[k].map(function (t) { return t.n; }).join(' / ') + '</div></div>';
    });
    h += '</div>' + (again ? '<div class="btns"><button id="ccCancel">取消</button></div><div class="muted" style="margin-top:6px">新建一个角色，现有角色的进度都会保留。</div>' : '');
    modal(h);
    document.querySelectorAll('.clsel .c').forEach(function (el) {
      el.onclick = function () { newChar(el.dataset.c); closeModal(); build(); toast('欢迎，' + M.CLS[S.cls].n + '！先在新手草原挂机升级吧'); };
    });
    if (again) $('ccCancel').onclick = closeModal;
  }

  // ---------- 框架 ----------
  var TABS = [['char', '👤', '角色'], ['skill', '✨', '技能'], ['bag', '🎒', '背包'], ['up', '⚒️', '强化'], ['trial', '🎯', '试炼'], ['map', '🗺️', '地图'], ['shop', '🛒', '商店'], ['set', '⚙️', '设置']];
  function build() {
    $('app').innerHTML =
      '<header class="top"><div class="row"><span class="logo">MMU</span><span class="lv" id="lv"></span>' +
      '<div class="bar exp"><i id="expb"></i><span id="expt"></span></div><span class="gold" id="gold"></span>' +
      '<button class="sm" id="rosBtn" title="切换角色">👥</button><button class="sm" id="miniBtn" title="迷你模式">▭</button></div>' +
      '<div class="row"><select id="zoneSel"></select><button class="sm pri" id="bossBtn"></button><span class="sp"></span>' +
      '<span class="res hide-mini" id="potT"></span></div></header>' +
      '<section class="arena" id="arena"><div id="bg"></div><div class="hud"><div class="bar hp"><b id="hshield"></b><i id="hhp"></i><span id="hhpt"></span></div>' +
      '<div class="bar rs"><i id="hres"></i><span id="hrest"></span></div></div><div class="btimer" id="btimer"></div><div class="banner" id="banner"></div>' +
      '<div class="hero" id="hero"><div class="hwrap" id="hwrap"></div><div class="hst" id="hmight"></div></div>' +
      '<div id="mons"></div><div class="slog" id="log"></div></section>' +
      '<nav class="tabs" id="tabs"></nav><main class="panel" id="panel"></main>';
    $('tabs').innerHTML = TABS.map(function (t) { return '<button data-t="' + t[0] + '"><span class="ti">' + t[1] + '</span><span class="tt">' + t[2] + '</span></button>'; }).join('');
    $('tabs').onclick = function (e) { var b = e.target.closest('button'); if (!b) return; tab = b.dataset.t; panelDirty = true; renderPanel(true); };
    $('miniBtn').onclick = function () { document.body.classList.toggle('mini'); };
    $('rosBtn').onclick = roster;
    $('zoneSel').onchange = function () {
      var z = +this.value;
      if (S.F && S.F.boss) { toast('首领战中不能换地图'); this.value = S.zone; return; }
      S.zone = z; S.zk = 0; S.F = null; panelDirty = true; addLog('前往 ' + M.ZONES[z].n, 'boss');
    };
    $('bossBtn').onclick = bossClick;
    heroSig = ''; bgZone = -1;
    panelDirty = true; renderTop(); renderPanel(true);
  }
  function zoneOpen(i) { return i === 0 || (S.bossWin[i - 1] && S.lvl >= M.ZONES[i].min); }
  function zoneLockReason(i) { if (i === 0) return ''; if (!S.bossWin[i - 1]) return '需击败' + M.ZONES[i - 1].boss.n; if (S.lvl < M.ZONES[i].min) return '需 Lv' + M.ZONES[i].min; return ''; }

  function bossClick() {
    if (S.F && S.F.boss) { // 撤退
      S.F.rep.result = 'retreat'; S.F.done = true; var r = M.bossStep(S, 0); showBossResult(r); return;
    }
    if (S.zk < M.BOSS_KILLS) { toast('再击杀 ' + (M.BOSS_KILLS - S.zk) + ' 只怪才能挑战首领'); return; }
    var z = M.ZONES[S.zone];
    modal('<h4>挑战 ' + z.boss.i + ' ' + z.boss.n + '</h4><div class="muted">' + esc(z.boss.md) + '</div>' +
      '<div class="card">建议先到「试炼」页模拟一次，确认这套搭配能赢。<br>失败不会死亡，但会消耗挑战次数（需再刷 ' + M.BOSS_KILLS + ' 只怪）。</div>' +
      '<div class="btns"><button class="pri" id="goBoss">开始挑战</button><button id="goTrial">先去试炼</button><button id="nob">取消</button></div>');
    $('goBoss').onclick = function () { closeModal(); M.startBoss(S); S.zk = 0; addLog('⚔ 开始挑战首领 ' + z.boss.n + '！', 'boss'); };
    $('goTrial').onclick = function () { closeModal(); tab = 'trial'; trialZone = S.zone; trialBoss = true; panelDirty = true; renderPanel(true); };
    $('nob').onclick = closeModal;
  }

  // ---------- 主循环 ----------
  var uiEv = [];
  function tick() {
    var now = Date.now(), dt = (now - lastTick) / 1000; lastTick = now;
    if (!S) return;
    if (dt <= 0) return;
    if (S.F && S.F.boss) {
      var r = M.bossStep(S, Math.min(dt, 1), document.hidden ? null : uiEv);
      if (r) showBossResult(r);
    } else if (dt > 5) {
      var q = M.mkE(true); M.farm(S, Math.min(dt, 8 * 3600), q);
      if (dt > 60) offlineSummary(dt, q);
    } else {
      M.farm(S, dt, E, document.hidden ? null : uiEv);
    }
    if (E.logs.length) { E.logs.forEach(function (l) { addLog(l.t, l.c); }); E.logs = []; }
    if (E.dirty) { panelDirty = true; E.dirty = false; }
    if (!document.hidden) { renderTop(); renderArena(); renderPanel(false); }
    uiEv = [];
  }
  function addLog(t, c) { logs.unshift({ t: t, c: c || '' }); if (logs.length > 40) logs.length = 40; var el = $('log'); if (el) el.innerHTML = logs.slice(0, 2).map(function (l) { return '<div class="' + l.c + '">' + esc(l.t) + '</div>'; }).join(''); }

  function offlineSummary(sec, q) {
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60);
    modal('<h4>离线收益（' + (h ? h + ' 小时 ' : '') + m + ' 分钟' + (sec > 8 * 3600 ? '，最多计 8 小时' : '') + '）</h4><div class="kv">' +
      '<div>击杀<b>' + fmt(q.kills) + '</b></div><div>经验<b>' + fmt(q.exp) + '</b></div><div>金币<b>' + fmt(q.gold) + '</b></div><div>升级<b>' + q.lv + '</b></div>' +
      '<div>获得装备<b>' + q.items + '</b></div><div>自动出售<b>' + q.sold + '</b></div><div>宝石<b>' + q.gems + '</b></div><div>技能书<b>' + q.books + '</b></div></div>' +
      '<div class="btns"><button class="pri" onclick="document.getElementById(\'mw\').classList.add(\'hidden\')">好的</button></div>');
    panelDirty = true;
  }

  function showBossResult(r) {
    var rep = r.rep, z = M.ZONES[S.lastRep ? S.lastRep.zi : S.zone];
    var ok = rep.result === 'win';
    var title = ok ? '🏆 击败 ' + z.boss.n + '！' : rep.result === 'retreat' ? '已撤退' : rep.result === 'timeout' ? '⏱ 超时，挑战失败' : '💀 挑战失败';
    addLog(title, ok ? 'lv' : 'warn');
    modal('<h4>' + title + '（用时 ' + Math.round(rep.t) + ' 秒）</h4>' + (r.rewards.length ? '<div class="card">' + r.rewards.map(esc).join('<br>') + '</div>' : '') +
      reportHtml(rep, r.tips) + '<div class="btns"><button class="pri" id="okb">好的</button></div>');
    $('okb').onclick = closeModal; panelDirty = true;
  }

  // ---------- 顶部 & 战斗画面 ----------
  function renderTop() {
    var c = M.calc(S), need = M.expNeed(S.lvl);
        $('lv').textContent = 'Lv' + S.lvl;
    $('expb').style.width = Math.min(100, S.exp / need * 100) + '%';
    $('expt').textContent = (S.exp / need * 100).toFixed(1) + '%';
    $('gold').textContent = '💰' + fmt(S.gold);
    $('potT').textContent = '🧪' + S.pot + ' 💎' + S.gems.b + ' 🔮' + S.gems.s + ' 🧿' + S.gems.g;
    var zs = $('zoneSel'), h = '';
    M.ZONES.forEach(function (z, i) { var o = zoneOpen(i); h += '<option value="' + i + '"' + (o ? '' : ' disabled') + (i === S.zone ? ' selected' : '') + '>' + (o ? '' : '🔒') + z.n + (o ? '' : '（' + zoneLockReason(i) + '）') + '</option>'; });
    if (zs.dataset.h !== h) { zs.innerHTML = h; zs.dataset.h = h; }
    var bb = $('bossBtn');
    if (S.F && S.F.boss) { bb.textContent = '撤退'; bb.className = 'sm dan'; }
    else { bb.textContent = (S.zk >= M.BOSS_KILLS ? '👹 挑战' : '👹 ' + S.zk + '/' + M.BOSS_KILLS); bb.className = 'sm' + (S.zk >= M.BOSS_KILLS ? ' pri' : ''); }
  }

  var heroSig = '', bgZone = -1, lastAtk = 0;
  var POS = [[60, 0], [76, 6], [88, 0], [67, 16], [83, 20], [55, 18], [92, 14]];
  function dominantBond(c) { var best = null, bv = 0; M.EL_KEYS.forEach(function (e) { if (c.bonds[e].lv > bv) { bv = c.bonds[e].lv; best = e; } }); return best; }
  function useArt() { return true; }
  function bodyTier() { var n = 0; ['weapon', 'helm', 'armor', 'gloves', 'boots'].forEach(function (k) { var it = S.eq[k]; if (it && it.t === 4) n++; }); return n >= 4 ? 5 : 1; }
  function avgTier() { var a = 0, n = 0; ['weapon', 'helm', 'armor', 'gloves', 'boots'].forEach(function (k) { var it = S.eq[k]; if (it) { a += it.t; n++; } }); return n ? Math.round(a / n) : 0; }
  function glowLv() { return Math.min(4, Math.floor(avgPlus() / 3.3)); }
  function artSprite() {
    var src = ART_IMG['cut_' + S.cls + '_t' + bodyTier()];
    return '<div class="spr g' + glowLv() + ' tt' + avgTier() + '"><div class="aura"></div><img src="' + src + '"><div class="spk"><i></i><i></i><i></i><i></i><i></i></div>' +
      (S.cls === 'sw' ? '<svg class="slash" viewBox="0 0 100 100"><path d="M10 80 Q55 0 95 40" fill="none" stroke="#fff6c8" stroke-width="7" stroke-linecap="round"/><path d="M10 80 Q55 0 95 40" fill="none" stroke="#ffc23a" stroke-width="14" stroke-linecap="round" opacity=".35"/></svg>' : '<div class="cflash"></div>') + '</div>';
  }
  function heroArt(c) { return useArt() ? artSprite() : Art.hero(S.cls, S.eq, { bond: dominantBond(c) }); }
  function eqSig() { var t = S.cls; M.SLOT_KEYS.forEach(function (k) { var it = S.eq[k]; t += it ? it.id + it.p : '-'; }); return t; }
  function renderArena() {
    var F = S.F, c = M.calc(S), ar = $('arena'), zi = F ? F.zi : S.zone;
    ar.classList.toggle('bossf', !!(F && F.boss));
    if (bgZone !== zi) { $('bg').innerHTML = Art.scene(zi); bgZone = zi; }
    var sg = eqSig() + dominantBond(c) + S.cls + bodyTier() + glowLv() + avgTier();
    if (sg !== heroSig) { $('hwrap').innerHTML = heroArt(c); heroSig = sg; }
    var hero = $('hero');
    hero.className = 'hero cls-' + S.cls + (useArt() ? ' art' : '') + (hero.classList.contains('atk') ? ' atk' : '') + (F && F.frozen > 0 ? ' frz' : '') + (F && F.rest > 0 ? ' rest' : '');
    $('hhp').style.width = Math.max(0, S.hp / c.hp * 100) + '%';
    $('hshield').style.width = F ? Math.min(100, F.shield / c.hp * 100) + '%' : '0';
    $('hhpt').textContent = '❤ ' + fmt(Math.max(0, S.hp)) + (F && F.shield > 0 ? '  🛡' + fmt(F.shield) : '');
    var rv = 0, rt = '';
    if (S.cls === 'sw') { rv = F ? F.rage : 0; rt = '😡 ' + Math.round(rv); }
    else if (S.cls === 'mg') { var cap = S.sk.t === 'master' ? 8 : 5; rv = F ? F.reso / cap * 100 : 0; rt = '🔮 ' + (F ? F.reso : 0) + '/' + cap + (F && F.resoEl ? ' ' + M.EL[F.resoEl].i : ''); }
    else { var asp = c.aspd * (1 - (M.ZONES[S.zone].slow || 0)); var cp = S.sk.t === 'multi' ? 6 : 4; var n = Math.min(cp, 1 + Math.floor(Math.max(0, asp - 1) / 0.4)); rv = n / cp * 100; rt = '🏹 ×' + n; }
    $('hres').style.width = rv + '%'; $('hrest').textContent = rt + (F && F.might ? '   战意 ' + F.might : '');
    $('hmight').textContent = F && F.rest > 0 ? '💤' : F && F.frozen > 0 ? '🧊' : '';
    $('btimer').textContent = F && F.boss ? '⏱ ' + Math.round(F.bossT) + '/120' + (F.mons[0].enr ? ' 🔥狂暴' : '') + (F.mons[0].immune ? ' 免疫' + M.EL[F.mons[0].immune].i : '') : '';
    // 怪物
    var box = $('mons'), mons = F ? F.mons : [];
    var have = {}; Array.prototype.forEach.call(box.children, function (el) { have[el.dataset.k] = el; });
    var live = {};
    mons.forEach(function (m, i) {
      if (!m._k) m._k = 'm' + Math.random().toString(36).slice(2, 8);
      live[m._k] = 1;
      var el = have[m._k];
      if (!el) {
        el = document.createElement('div'); el.dataset.k = m._k;
        var p = m.boss ? [80, 0] : POS[i % POS.length];
        el.className = 'mob' + (m.boss ? ' boss' : '') + (m.add ? ' add' : '');
        el.style.left = p[0] + '%'; el.style.bottom = (18 + p[1]) + 'px'; el.style.zIndex = 10 - p[1];
        el.style.animationDelay = (-Math.random() * 1.5) + 's';
        el.innerHTML = '<div class="mst"></div><div class="mbar"><i></i><b></b></div><div class="mi">' + m.i + '</div>' + (m.boss ? '<div class="bn">' + esc(m.n) + '</div>' : '');
        box.appendChild(el);
      }
      m._el = el;
      el.querySelector('.mbar i').style.width = Math.max(0, m.hp / m.mhp * 100) + '%';
      el.querySelector('.mbar b').style.width = m.mshield ? Math.max(0, m.shield / m.mshield * 100) + '%' : '0';
      var st = ''; for (var k in m.st) st += M.ST[k].i + (k === 'burn' ? m.st.burn.n : '');
      if (m.voidT > 0) st += '🕳️';
      el.querySelector('.mst').textContent = st;
      el.classList.toggle('frz', M.hasSt(m, 'freeze'));
      if (m.hp <= 0 && !el.classList.contains('dead')) el.classList.add('dead');
    });
    for (var key in have) if (!live[key]) { (function (el) { el.classList.add('dead'); setTimeout(function () { el.remove(); }, 400); })(have[key]); delete have[key]; }
    // 动作 & 飘字
    var shown = 0, now = Date.now(), atkTarget = null;
    uiEv.forEach(function (e) {
      if (e.t === 'msg') { showBanner(e.m); return; }
      if (e.t === 'd' && !e.dot && e.src !== 'bounce' && e.src !== 'react') atkTarget = atkTarget || e;
      if (shown > 7) return;
      if (e.t === 'd' && e.m._el && e.d > 0) { shown++; floatNum(e.m._el, fmt(e.d) + (e.react ? '!' : ''), e.react ? 'react' : e.crit ? 'crit' : '', e.el); hitFx(e.m._el); }
      if (e.t === 'h' && e.d > 0) { shown++; floatNum($('hwrap'), '-' + fmt(e.d), 'h'); }
    });
    if (atkTarget && now - lastAtk > 260) { lastAtk = now; heroAttack(atkTarget); }
    if (bannerT && now > bannerT) { $('banner').textContent = ''; bannerT = 0; }
  }
  function hitFx(el) { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); }
  function heroAttack(e) {
    var h = $('hero'); h.classList.remove('atk'); void h.offsetWidth; h.classList.add('atk');
    if (S.cls === 'sw' || !e.m._el) return;
    var ar = $('arena').getBoundingClientRect(), hr = $('hwrap').getBoundingClientRect(), tr = e.m._el.getBoundingClientRect();
    var p = document.createElement('div'); p.className = 'proj ' + (S.cls === 'ar' ? 'arrow' : 'orb');
    var col = Art.ELC[e.el] || (S.cls === 'mg' ? '#c8a8ff' : '#f0e0c0');
    p.style.background = col; p.style.boxShadow = '0 0 8px ' + col;
    p.style.left = (hr.right - ar.left - 18) + 'px'; p.style.top = (hr.top - ar.top + hr.height * 0.42) + 'px';
    $('arena').appendChild(p);
    requestAnimationFrame(function () { p.style.left = (tr.left - ar.left + tr.width / 2) + 'px'; p.style.top = (tr.top - ar.top + tr.height * 0.55) + 'px'; });
    setTimeout(function () { p.remove(); }, 260);
  }
  function showBanner(t) { $('banner').textContent = t; bannerT = Date.now() + 1800; }
  function floatNum(el, txt, cls, elk) {
    var ar = $('arena'), r = el.getBoundingClientRect(), a = ar.getBoundingClientRect();
    var d = document.createElement('div'); d.className = 'fxn ' + cls; d.textContent = txt;
    if (!cls && elk && M.EL[elk]) d.style.color = M.EL[elk].c;
    d.style.left = (r.left - a.left + r.width / 2 - 12 + (Math.random() * 20 - 10)) + 'px';
    d.style.top = (r.top - a.top + 6) + 'px';
    ar.appendChild(d); setTimeout(function () { d.remove(); }, 900);
  }

  // ---------- 面板 ----------
  function renderPanel(force) {
    if (!force) { if (!panelDirty || Date.now() - lastPanel < 1000 || !$('mw').classList.contains('hidden')) return; if (tab === 'trial' || tab === 'set' || tab === 'map') return; }
    var ae = document.activeElement; if (!force && ae && (ae.tagName === 'TEXTAREA' || ae.tagName === 'INPUT' || ae.tagName === 'SELECT') && $('panel').contains(ae)) return;
    panelDirty = false; lastPanel = Date.now();
    document.querySelectorAll('#tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.t === tab); });
    ({ char: pChar, skill: pSkill, bag: pBag, up: pUp, trial: pTrial, map: pMap, shop: pShop, set: pSet })[tab]();
  }

  function glow(p) { return p >= 13 ? 'g4' : p >= 10 ? 'g3' : p >= 7 ? 'g2' : p >= 4 ? 'g1' : ''; }
  function artFor(it) { return it.t === 4 && ART_IMG[it.slot] && (it.slot !== 'weapon' || it.cls === 'sw') ? ART_IMG[it.slot] : null; }
  function itemIcon(it) { var a = artFor(it); if (a) return '<img class="ii" src="' + a + '">'; return it.slot === 'weapon' ? M.WPN_I[it.cls] : M.SLOTS[it.slot].i; }
  function itemCell(it, extra) {
    return '<div class="item r' + it.r + ' ' + glow(it.p) + (extra || '') + '" data-id="' + it.id + '">' + itemIcon(it) +
      (it.p ? '<span class="pl">+' + it.p + '</span>' : '') + (it.el ? '<span class="el">' + M.EL[it.el].i + '</span>' : '') +
      (it.lk ? '<span class="lk">🔒</span>' : '') + (better(it) ? '<span class="ar">▲</span>' : '') + '</div>';
  }
  function better(it) { if (S.eq[it.slot] === it || !M.canEquip(S, it)) return false; var c = S.eq[it.slot]; return !c || M.score(it) > M.score(c); }
  function itemInfo(it) {
    var h = '<div class="t" style="color:' + M.RAR[it.r].c + '">' + esc(M.itemLabel(it)) + '</div><div class="muted">' + M.RAR[it.r].n + ' · ' + M.SLOTS[it.slot].n +
      (it.slot === 'weapon' ? '（' + M.CLS[it.cls].n + '）' : '') + ' · 第' + (it.t + 1) + '代 · 物品等级 ' + it.ilvl + (it.el ? ' · ' + M.EL[it.el].i + M.EL[it.el].n + '元素' : '') + '</div>';
    h += '<div>' + M.statName(it.slot) + ' <b>' + M.itemVal(it) + '</b>' + (it.p ? ' <span class="muted">(强化 ×' + (M.itemVal(it) / (M.itemVal(Object.assign({}, it, { p: 0 })) || 1)).toFixed(2) + ')</span>' : '') + '</div>';
    it.af.forEach(function (a) { var d = M.AFF_MAP[a.k]; h += '<div class="af">+' + a.v + (d.u || '') + ' ' + d.n + '</div>'; });
    if (it.leg) { var L = M.LEG.filter(function (x) { return x.fx === it.leg; })[0]; h += '<div class="leg">【传说】' + esc(L.d) + '</div>'; }
    var bad = S.lvl < it.req.lvl;
    h += '<div class="muted ' + (bad ? 'bad' : '') + '">需要等级 ' + it.req.lvl + (it.slot === 'weapon' && it.cls !== S.cls ? '<span class="bad">（非本职业武器）</span>' : '') + '</div>';
    h += '<div class="muted">出售价 ' + M.sellPrice(it) + ' 金币</div>';
    return h;
  }
  function openItem(id) {
    var f = M.findItem(S, id); if (!f) return; var it = f.it, cur = S.eq[it.slot];
    var h = '<div class="card">' + itemInfo(it) + '</div>';
    if (!f.eq && cur) h += '<div class="muted" style="margin-top:6px">当前穿戴：</div><div class="card">' + itemInfo(cur) + '</div>';
    h += '<div class="btns">' + (f.eq ? '<button id="iUn">卸下</button>' : '<button class="pri" id="iEq">穿戴</button><button id="iSell">出售</button>') +
      '<button id="iLk">' + (it.lk ? '解锁' : '锁定') + '</button><button id="iUp">去强化</button><button id="iX">关闭</button></div>';
    modal(h);
    if ($('iEq')) $('iEq').onclick = function () { var e = M.equip(S, id); toast(e || '已穿戴'); closeModal(); panelDirty = true; renderPanel(true); };
    if ($('iUn')) $('iUn').onclick = function () { var e = M.unequip(S, f.eq); toast(e || '已卸下'); closeModal(); renderPanel(true); };
    if ($('iSell')) $('iSell').onclick = function () { if (it.lk) { toast('已锁定，不能出售'); return; } var g = M.sellById(S, id); toast('出售 +' + g + ' 金币'); closeModal(); renderPanel(true); };
    $('iLk').onclick = function () { it.lk = !it.lk; closeModal(); renderPanel(true); };
    $('iUp').onclick = function () { upSel = id; upRes = null; tab = 'up'; closeModal(); renderPanel(true); };
    $('iX').onclick = closeModal;
  }
  function bindItems(root) { root.querySelectorAll('[data-id]').forEach(function (el) { el.onclick = function () { openItem(el.dataset.id); }; }); }

  // 角色：造型展示 + 装备环绕
  function slotCell(k) {
    var it = S.eq[k];
    return it ? itemCell(it) : '<div class="slot"><span class="lb">' + M.SLOTS[k].n + '</span><span class="ic">' + M.SLOTS[k].i + '</span></div>';
  }
  function dollFig(c) {
    var n = 0; ['weapon', 'helm', 'armor', 'gloves', 'boots'].forEach(function (k) { var it = S.eq[k]; if (it && it.t === 4) n++; });
    return '<div class="big">' + heroArt(c) + '</div>';
  }
  function avgPlus() { var a = 0, n = 0; for (var k in S.eq) { a += S.eq[k].p; n++; } return n ? a / n : 0; }
  function setPreview() {
    var slots = ['weapon', 'helm', 'armor', 'gloves', 'boots', 'ring', 'neck'];
    modal('<h4>✨ 曜光套装（第 5 代）</h4><div class="prev"><div class="pv3">' + ['sw', 'mg', 'ar'].map(function (k) { return '<div><img src="' + ART_IMG['cut_' + k + '_t5'] + '"><span>' + M.CLS[k].n + '</span></div>'; }).join('') + '</div><div class="pgrid">' +
      slots.map(function (k) { return '<div><img src="' + ART_IMG[k] + '"><span>' + M.SLOTS[k].n + '</span></div>'; }).join('') +
      '</div></div><div class="muted">武器、头盔、铠甲、护手、靴子中有 4 件以上是曜光装备时，人物会换成曜光造型。</div><div class="btns"><button id="pvx">关闭</button></div>');
    $('pvx').onclick = closeModal;
  }
  function pChar() {
    var c = M.calc(S), P = $('panel'), C = M.CLS[S.cls];
    var h = '<div class="doll"><div class="dcol">' + ['helm', 'armor', 'gloves', 'boots'].map(slotCell).join('') + '</div>' +
      '<div class="dmid"><div class="dfig">' + dollFig(c) + '</div><div class="dname">' + C.n + ' <span class="lv">Lv' + S.lvl + '</span> <button class="sm" id="setPrev">👁 曜光套装</button></div></div>' +
      '<div class="dcol">' + ['weapon', 'ring', 'neck'].map(slotCell).join('') + '</div></div>';
    h += '<div class="chips"><span>⚔️ ' + fmt(c.atk) + '</span><span>❤️ ' + fmt(c.hp) + '</span><span>🛡️ ' + fmt(c.def) + '</span><span>⚡ ' + c.aspd.toFixed(2) + '</span><span>💥 ' + c.critc.toFixed(0) + '%</span></div>';
    h += '<div class="bonds">' + M.EL_KEYS.map(function (e) { var b = c.bonds[e]; return '<div class="' + (b.lv ? 'on' : '') + '" title="' + M.BOND[e].n + '">' + M.EL[e].i + '<b>' + b.n + '</b></div>'; }).join('') + '</div>';
    h += '<div class="pts"><span class="muted">属性点</span> <b class="lv">' + S.pts + '</b>' +
      [['str', '💪'], ['agi', '🏃'], ['vit', '❤️'], ['ene', '🧠']].map(function (a) { return '<span class="pt">' + a[1] + ' <b>' + S[a[0]] + '</b><button class="sm" data-p="' + a[0] + '" data-n="1"' + (S.pts ? '' : ' disabled') + '>+</button><button class="sm" data-p="' + a[0] + '" data-n="10"' + (S.pts >= 10 ? '' : ' disabled') + '>+10</button></span>'; }).join('') + '</div>';
    h += '<div class="loads">' + [0, 1, 2].map(function (i) { var L = S.loads[i]; return '<span class="ld"><b>' + (L ? esc(L.name) : '方案' + (i + 1)) + '</b><button class="sm" data-la="' + i + '"' + (L ? '' : ' disabled') + '>用</button><button class="sm" data-ls="' + i + '">存</button></span>'; }).join('') +
      '<button class="sm" id="codeBtn">📤 搭配码</button><button class="sm" id="viewCode">📥</button></div>';
    var legs = Object.keys(c.leg);
    h += '<details class="more"><summary>详细属性 · 伤害乘区 · 羁绊说明</summary>' +
      '<div class="muted">' + esc(C.d) + '</div><div class="kv" style="margin-top:6px">' +
      '<div>暴击伤害<b>' + c.critd + '%</b></div><div>吸血<b>' + c.leech + '%</b></div><div>冷却缩减<b>' + c.cdr + '%</b></div><div>反应伤害<b>+' + c.react + '%</b></div>' +
      '<div>火焰抗性<b>' + c.rfire + '%</b></div><div>冰霜抗性<b>' + c.rice + '%</b></div><div>加成区<b>×' + (1 + c.atkp / 100).toFixed(2) + '</b></div><div>暴击区<b>×' + (c.critd / 100).toFixed(2) + '</b></div>' +
      M.EL_KEYS.map(function (e) { return '<div>' + M.EL[e].i + '元素区<b>×' + (1 + c[e] / 100).toFixed(2) + '</b></div>'; }).join('') + '</div>' +
      '<div class="muted" style="margin-top:6px">同一乘区相加，不同乘区相乘。羁绊：装备同元素 2/4/6 件——' + M.EL_KEYS.map(function (e) { var B = M.BOND[e], b = c.bonds[e]; return M.EL[e].i + B.n + (b.lv ? ' +' + B.v[b.lv - 1] + B.u : ''); }).join('，') + '</div>' +
      (legs.length ? legs.map(function (fx) { var L = M.LEG.filter(function (x) { return x.fx === fx; })[0]; return '<div class="leg">【' + L.n + '】' + esc(L.d) + '</div>'; }).join('') : '') + '</details>';
    P.innerHTML = h; bindItems(P);
    $('setPrev').onclick = setPreview;
    P.querySelectorAll('[data-p]').forEach(function (b) { b.onclick = function () { M.addPoint(S, b.dataset.p, +b.dataset.n); renderPanel(true); }; });
    P.querySelectorAll('[data-ls]').forEach(function (b) { b.onclick = function () { var i2 = +b.dataset.ls; modal('<h4>保存搭配方案 ' + (i2 + 1) + '</h4><div class="muted">保存当前装备 + 技能 + 天赋</div><input id="lname" placeholder="比如：冰龙首领" style="width:100%" value="' + esc(S.loads[i2] ? S.loads[i2].name : '') + '"><div class="btns"><button class="pri" id="lok">保存</button><button id="lx">取消</button></div>'); $('lok').onclick = function () { M.saveLoad(S, i2, $('lname').value.trim()); closeModal(); toast('已保存'); renderPanel(true); }; $('lx').onclick = closeModal; }; });
    P.querySelectorAll('[data-la]').forEach(function (b) { b.onclick = function () { if (S.F && S.F.boss) { toast('首领战中不能换搭配'); return; } var e = M.applyLoad(S, +b.dataset.la); toast(e || '已切换：' + S.loads[+b.dataset.la].name); renderPanel(true); }; });
    $('codeBtn').onclick = function () { var code = M.buildCode(S); modal('<h4>我的搭配码</h4><div class="muted">发给朋友，对方点 📥 粘贴即可查看。</div><textarea id="cta" readonly>' + esc(code) + '</textarea><div class="btns"><button class="pri" id="cc">复制</button><button id="cx">关闭</button></div>'); $('cc').onclick = function () { $('cta').select(); try { navigator.clipboard.writeText(code).then(function () { toast('已复制'); }, function () { toast('请手动复制'); }); } catch (e) { toast('请手动复制'); } }; $('cx').onclick = closeModal; };
    $('viewCode').onclick = function () { modal('<h4>查看搭配码</h4><textarea id="vta" placeholder="粘贴 MMU1- 开头的搭配码"></textarea><div id="vout"></div><div class="btns"><button class="pri" id="vok">查看</button><button id="vx">关闭</button></div>'); $('vx').onclick = closeModal; $('vok').onclick = function () { var o = M.readCode($('vta').value); if (!o) { $('vout').innerHTML = '<div class="bad">搭配码无效</div>'; return; } $('vout').innerHTML = codeHtml(o); }; };
  }
  function codeHtml(o) {
    var h = '<div class="card"><div class="t">' + M.CLS[o.c].body + ' ' + M.CLS[o.c].n + ' Lv' + o.lv + '</div><div class="muted">力量 ' + o.a[0] + ' / 敏捷 ' + o.a[1] + ' / 体力 ' + o.a[2] + ' / 智力 ' + o.a[3] + '</div>';
    var tal = M.TAL[o.c].filter(function (t) { return t.id === o.sk.t; })[0];
    h += '<div>天赋：' + (tal ? tal.n : '—') + '</div><div>职业技能：' + o.sk.c.map(function (k) { return k ? M.SK[k].n : '空'; }).join('、') + '</div><div>通用技能：' + o.sk.g.map(function (k) { return k ? M.SK[k].n : '空'; }).join('、') + '</div>';
    for (var k in o.eq) { var e = o.eq[k]; h += '<div style="color:' + M.RAR[e.r].c + '">' + M.SLOTS[k].n + '：' + esc(e.n) + (e.e ? ' ' + M.EL[e.e].i : '') + ' <span class="af">' + e.a.map(function (x) { var p = x.split(':'); return (M.AFF_MAP[p[0]] ? M.AFF_MAP[p[0]].n : p[0]) + '+' + p[1]; }).join(' ') + '</span></div>'; }
    return h + '</div>';
  }

  // 技能
  function skName(id) { return id ? M.SK[id].n : '空'; }
  function pSkill() {
    var P = $('panel'), C = M.CLS[S.cls];
    var h = '<h4>职业机制</h4><div class="muted">' + esc(C.d) + '</div>';
    h += '<h4 style="margin-top:10px">天赋（决定流派方向，可随时切换）</h4><div class="tal">' + M.TAL[S.cls].map(function (t) { return '<div class="' + (S.sk.t === t.id ? 'on' : '') + '" data-tal="' + t.id + '"><b>' + t.n + '</b><br>' + esc(t.d) + '</div>'; }).join('') + '</div>';
    h += '<h4 style="margin-top:10px">技能栏 <span class="muted">（点格子选中，再点下方技能装入；从左到右优先施放）</span></h4><div class="muted">职业技能（3 格）</div><div class="skslots">';
    for (var i = 0; i < 3; i++) h += slotHtml('c', i);
    h += '</div><div class="muted" style="margin-top:6px">通用技能（2 格，附魔只能带 1 个）</div><div class="skslots">';
    for (var j = 0; j < 2; j++) h += slotHtml('g', j);
    h += '</div><h4 style="margin-top:10px">技能书库</h4>';
    var list = Object.keys(M.SK).filter(function (k) { return M.SK[k].cls === S.cls || M.SK[k].cls === 'all'; });
    list.forEach(function (k) {
      var sk = M.SK[k], has = S.books.indexOf(k) >= 0, inUse = S.sk.c.concat(S.sk.g).indexOf(k) >= 0;
      h += '<div class="skl' + (has ? '' : ' no') + '"><div><b>' + (sk.el !== 'phys' ? M.EL[sk.el].i : '⚔️') + ' ' + sk.n + '</b> <span class="muted">' + (sk.cls === 'all' ? '通用' : '职业') + (sk.cd ? ' · 冷却 ' + sk.cd + 's' : '') + '</span><div class="muted">' + esc(sk.d) + '</div></div><div>' +
        (has ? (inUse ? '<span class="muted">已装备</span>' : '<button class="sm" data-put="' + k + '">装入</button>') : '<span class="muted">未学会</span>') + '</div></div>';
    });
    h += '<div class="muted" style="margin-top:6px">技能书来源：怪物掉落（稀有）、首领首杀必掉、商店购买（随机一本）。</div>';
    P.innerHTML = h;
    P.querySelectorAll('[data-tal]').forEach(function (d) { d.onclick = function () { S.sk.t = d.dataset.tal; if (S.F && !S.F.boss) S.F.cds = {}; renderPanel(true); }; });
    P.querySelectorAll('[data-slot]').forEach(function (d) { d.onclick = function () { var v = d.dataset.slot; skSel = skSel === v ? null : v; renderPanel(true); }; });
    P.querySelectorAll('[data-clr]').forEach(function (d) { d.onclick = function (e) { e.stopPropagation(); var p = d.dataset.clr.split(':'); M.setSkill(S, p[0], +p[1], null); renderPanel(true); }; });
    P.querySelectorAll('[data-put]').forEach(function (b) {
      b.onclick = function () {
        var k = b.dataset.put, sk = M.SK[k], g = sk.cls === 'all' ? 'g' : 'c', idx;
        if (skSel && skSel[0] === g) idx = +skSel.split(':')[1];
        else { var arr = S.sk[g]; idx = arr.indexOf(null); if (idx < 0) idx = arr.length - 1; }
        var e = M.setSkill(S, g, idx, k); if (e) toast(e); skSel = null; renderPanel(true);
      };
    });
  }
  function slotHtml(g, i) {
    var id = S.sk[g][i], sk = id ? M.SK[id] : null, key = g + ':' + i;
    return '<div class="sks' + (skSel === key ? ' cur' : '') + '" data-slot="' + key + '">' + (sk ? '<div class="sn">' + (sk.el !== 'phys' ? M.EL[sk.el].i : '⚔️') + ' ' + sk.n + '</div><div class="muted">' + (sk.cd ? '冷却 ' + sk.cd + 's' : '被动') + ' <span data-clr="' + key + '" style="cursor:pointer">✖</span></div>' : '<div class="muted">空</div>') + '</div>';
  }

  // 背包
  function pBag() {
    var P = $('panel');
    var h = '<div class="row"><b>背包 ' + S.bag.length + '/' + M.BAG_MAX + '</b><span class="sp"></span><button class="sm" id="s0">卖普通</button><button class="sm" id="s1">卖精良及以下</button><button class="sm" id="s2">卖卓越及以下</button></div>' +
      '<div class="muted" style="margin:4px 0 8px">▲ 表示比当前穿戴更好；锁定和强化过的不会被一键出售（卓越以下）。传说装备不会被一键出售。</div><div class="grid">';
    var bag = S.bag.slice().sort(function (a, b) { return b.r - a.r || b.t - a.t || b.p - a.p; });
    bag.forEach(function (it) { h += itemCell(it); });
    h += '</div>';
    P.innerHTML = h; bindItems(P);
    [0, 1, 2].forEach(function (r) { $('s' + r).onclick = function () { var o = M.sellBulk(S, r); toast('出售 ' + o.n + ' 件，+' + fmt(o.g) + ' 金币'); renderPanel(true); }; });
  }

  // 强化
  function pUp() {
    var P = $('panel'), all = [];
    M.SLOT_KEYS.forEach(function (k) { if (S.eq[k]) all.push(S.eq[k]); });
    S.bag.forEach(function (it) { if (it.r >= 1 || it.p) all.push(it); });
    if (!upSel || !M.findItem(S, upSel)) upSel = all[0] ? all[0].id : null;
    var h = '<div class="muted">选择要强化的装备（已穿戴 + 背包里精良以上）</div><div class="grid" style="margin:6px 0">' + all.map(function (it) { return itemCell(it, it.id === upSel ? ' sel' : ''); }).join('') + '</div>';
    if (upSel) {
      var it = M.findItem(S, upSel).it, need = M.upNeed(it.p), cost = M.upCost(it), rate = M.RATE[it.p];
      h += '<div class="card">' + itemInfo(it) + '</div>';
      if (it.p >= 15) h += '<div class="card">已强化到最高 +15</div>';
      else {
        h += '<div class="card"><div>+' + it.p + ' → +' + (it.p + 1) + '　成功率 <b class="big">' + Math.round(rate * 100) + '%</b></div>' +
          '<div>消耗：' + (need.b ? '💎强化石 ×1（有 ' + S.gems.b + '）' : '') + (need.s ? ' 🔮灵魂石 ×1（有 ' + S.gems.s + '）' : '') + ' 💰' + fmt(cost) + '</div>' +
          '<div class="muted">' + (it.p < 6 ? '失败无惩罚' : it.p < 9 ? '失败：降 1 级' : '<span class="bad">失败：装备会碎掉！</span>') + '</div>' +
          (it.p >= 9 ? '<label><input type="checkbox" id="gd"' + (guard ? ' checked' : '') + '> 使用 🧿守护符（有 ' + S.gems.g + '）：失败时保住装备，回到 +9</label>' : '') +
          '<div class="btns"><button class="pri" id="doUp">强化</button></div></div>';
      }
      if (upRes) h += '<div class="upres ' + upRes.res + '">' + esc(upRes.msg) + '</div>';
    }
    P.innerHTML = h;
    P.querySelectorAll('[data-id]').forEach(function (el) { el.onclick = function () { upSel = el.dataset.id; upRes = null; renderPanel(true); }; });
    if ($('gd')) $('gd').onchange = function () { guard = this.checked; };
    if ($('doUp')) $('doUp').onclick = function () {
      var it2 = M.findItem(S, upSel).it;
      if (it2.p >= 9 && !(guard && S.gems.g > 0)) {
        modal('<h4>⚠️ 确认强化？</h4><div>' + esc(M.itemLabel(it2)) + ' 强化失败会<b class="bad">碎掉</b>（成功率 ' + Math.round(M.RATE[it2.p] * 100) + '%），且没有使用守护符。</div><div class="btns"><button class="dan" id="yup">确定强化</button><button id="nup">取消</button></div>');
        $('yup').onclick = function () { closeModal(); doUp(); }; $('nup').onclick = closeModal; return;
      }
      doUp();
    };
  }
  function doUp() { upRes = M.upgrade(S, upSel, guard); if (upRes.res === 'break') upSel = null; addLog(upRes.msg, upRes.res === 'ok' ? 'lv' : 'warn'); renderPanel(true); save(); }

  // 试炼
  function pTrial() {
    var P = $('panel');
    var h = '<h4>木桩试炼</h4><div class="muted">按目标地图的规则瞬间模拟（刷怪 60 秒 / 首领最多 120 秒），不消耗任何东西，结果可复现。</div>' +
      '<div class="row" style="margin-top:8px"><select id="tz">' + M.ZONES.map(function (z, i) { return '<option value="' + i + '"' + (i === trialZone ? ' selected' : '') + '>' + z.n + (zoneOpen(i) ? '' : '（未解锁）') + '</option>'; }).join('') + '</select>' +
      '<div class="sel3"><button id="tf" class="' + (trialBoss ? '' : 'on') + '">刷怪</button><button id="tb" class="' + (trialBoss ? 'on' : '') + '">首领</button></div><button class="pri" id="trun">开始模拟</button></div>';
    var z = M.ZONES[trialZone];
    h += '<div class="muted" style="margin-top:6px">地图特性：' + esc(z.trait) + (trialBoss ? '<br>首领机制：' + esc(z.boss.md) : '') + '</div>';
    if (trialRes) {
      var r = trialRes, rep = r.rep;
      h += '<div class="card">';
      if (r.boss) h += '<div class="big">' + (rep.result === 'win' ? '✅ 能赢（' + Math.round(rep.t) + ' 秒）' : rep.result === 'lose' ? '❌ 会输（第 ' + Math.round(rep.t) + ' 秒阵亡）' : '⏱ 打不完（120 秒超时）') + '</div>';
      else h += '<div class="big">' + (r.safe ? '✅ 可以稳定挂机' : '⚠️ 生存有风险') + '</div><div class="kv"><div>每分钟击杀<b>' + r.kpm + '</b></div><div>撤退次数<b>' + rep.flee + '</b></div><div>预估经验/小时<b>' + fmt(r.expH) + '</b></div><div>预估金币/小时<b>' + fmt(r.goldH) + '</b></div></div>';
      h += '<div>每秒伤害（DPS）<b class="big"> ' + fmt(r.dps) + '</b></div></div>' + reportHtml(rep, r.tips);
    }
    if (S.lastRep) h += '<div class="muted" style="margin-top:10px">上次首领战报：' + M.ZONES[S.lastRep.zi].boss.n + ' · ' + ({ win: '胜利', lose: '失败', timeout: '超时', retreat: '撤退' }[S.lastRep.rep.result] || '') + ' <button class="sm" id="lastRep">查看</button></div>';
    P.innerHTML = h;
    $('tz').onchange = function () { trialZone = +this.value; trialRes = null; renderPanel(true); };
    $('tf').onclick = function () { trialBoss = false; trialRes = null; renderPanel(true); };
    $('tb').onclick = function () { trialBoss = true; trialRes = null; renderPanel(true); };
    $('trun').onclick = function () { this.disabled = true; this.textContent = '模拟中…'; setTimeout(function () { trialRes = M.trial(S, trialZone, trialBoss); renderPanel(true); }, 30); };
    if ($('lastRep')) $('lastRep').onclick = function () { var L = S.lastRep; modal('<h4>' + M.ZONES[L.zi].boss.n + ' 战报</h4>' + (L.rewards && L.rewards.length ? '<div class="card">' + L.rewards.map(esc).join('<br>') + '</div>' : '') + reportHtml(L.rep, L.tips) + '<div class="btns"><button id="lx2">关闭</button></div>'); $('lx2').onclick = closeModal; };
  }
  var SRC_N = { burn: '🔥灼烧', bounce: '⚡感电弹射', react: '💥元素反应' };
  function reportHtml(rep, tips) {
    var tot = Math.max(1, rep.total), h = '<h4 style="margin-top:8px">伤害来源</h4>';
    var src = Object.keys(rep.dmg).filter(function (k) { return rep.dmg[k] > 0; }).sort(function (a, b) { return rep.dmg[b] - rep.dmg[a]; }).slice(0, 8);
    src.forEach(function (k) { var v = rep.dmg[k]; h += '<div class="hbar"><span class="nm">' + esc(SRC_N[k] || k) + '</span><span class="tr"><i style="width:' + (v / tot * 100) + '%"></i></span><span class="v">' + Math.round(v / tot * 100) + '%</span></div>'; });
    h += '<h4>元素占比</h4>';
    Object.keys(rep.el).filter(function (k) { return rep.el[k] > 0; }).sort(function (a, b) { return rep.el[b] - rep.el[a]; }).forEach(function (k) { var v = rep.el[k]; h += '<div class="hbar"><span class="nm">' + M.EL[k].i + M.EL[k].n + '</span><span class="tr"><i style="width:' + (v / tot * 100) + '%;background:' + M.EL[k].c + '"></i></span><span class="v">' + Math.round(v / tot * 100) + '%</span></div>'; });
    var rk = Object.keys(rep.react);
    h += '<h4>元素反应</h4><div class="muted">' + (rk.length ? rk.map(function (k) { return M.REACT[k].i + M.REACT[k].n + ' ×' + rep.react[k]; }).join('　') + '　反应伤害占 ' + Math.round(rep.reactDmg / tot * 100) + '%' : '没有触发反应') + '</div>';
    var tk = Object.keys(rep.taken).filter(function (k) { return rep.taken[k] > 0; });
    if (tk.length) h += '<h4>承受伤害</h4><div class="muted">' + tk.map(function (k) { return esc(k) + ' ' + fmt(rep.taken[k]); }).join('　') + (rep.pot ? '　喝药 ' + rep.pot + ' 次' : '') + '</div>';
    h += '<h4>战报提示</h4><ul class="tips">' + tips.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
    return h;
  }

  // 地图
  function pMap() {
    var P = $('panel'), h = '<div class="muted">每张地图都有特性，每个首领都有克制某些流派的机制。击败首领解锁下一张地图，首杀必掉传说装备。</div>';
    M.ZONES.forEach(function (z, i) {
      var o = zoneOpen(i);
      h += '<div class="zone' + (o ? '' : ' lock') + '"><div class="row"><b>' + (o ? '' : '🔒 ') + z.n + '</b><span class="muted">Lv' + z.min + '+ · 每波 ' + z.pack + ' 只</span><span class="sp"></span>' +
        (S.bossWin[i] ? '<span class="good">✓ 已击败首领</span>' : '') + (o && i !== S.zone ? ' <button class="sm" data-go="' + i + '">前往</button>' : i === S.zone ? ' <span class="muted">当前</span>' : '') + '</div>' +
        '<div class="muted">怪物：' + z.mons.map(function (m) { return m[1] + m[0]; }).join(' ') + '</div><div>地图特性：' + esc(z.trait) + '</div>' +
        '<div>首领 ' + z.boss.i + ' <b>' + z.boss.n + '</b>：' + esc(z.boss.md) + '</div><div class="leg">首杀传说：' + M.LEG[i].n + '（' + esc(M.LEG[i].d) + '）</div>' +
        (o ? '' : '<div class="bad">' + zoneLockReason(i) + '</div>') + '</div>';
    });
    P.innerHTML = h;
    P.querySelectorAll('[data-go]').forEach(function (b) { b.onclick = function () { if (S.F && S.F.boss) { toast('首领战中不能换地图'); return; } S.zone = +b.dataset.go; S.zk = 0; S.F = null; renderTop(); renderPanel(true); }; });
  }

  // 商店
  function pShop() {
    var P = $('panel'), rows = [
      ['pot', '🧪 生命药水 ×10', 10], ['pot', '🧪 生命药水 ×50', 50], ['b', '💎 强化石', 1], ['s', '🔮 灵魂石', 1], ['g', '🧿 守护符', 1],
      ['book', '📖 随机技能书（本职业或通用，未学会的）', 1], ['reset', '🔄 洗点（重置所有属性点）', 1]];
    var h = '<div class="shop"><div class="muted">金币 💰' + fmt(S.gold) + '　价格随等级上涨</div>' + rows.map(function (r, i) {
      return '<div class="r"><span>' + r[1] + '</span><span>💰' + fmt(M.shopPrice(S, r[0]) * r[2]) + ' <button class="sm" data-b="' + i + '">购买</button></span></div>';
    }).join('') + '</div>';
    P.innerHTML = h;
    P.querySelectorAll('[data-b]').forEach(function (b) { b.onclick = function () { var r = rows[+b.dataset.b]; var o = M.buy(S, r[0], r[2]); toast(o.err || o.msg); renderPanel(true); renderTop(); }; });
  }

  // 设置
  function pSet() {
    var P = $('panel'), st = S.set;
    var h = '<div class="set">' +
      '<div class="r"><span>自动出售</span><select id="sell"><option value="0">不自动卖</option><option value="1">普通</option><option value="2">精良及以下</option><option value="3">卓越及以下</option></select></div>' +
      '<div class="r"><span>自动穿戴（会打乱搭配，建议只补空位）</span><select id="aeq"><option value="empty">只补空位</option><option value="better">更好就换</option><option value="off">关闭</option></select></div>' +
      '<div class="r"><span>生命低于 <b id="pv">' + st.potAt + '</b>% 自动喝药</span><input type="range" id="pa" min="20" max="80" step="5" value="' + st.potAt + '"></div>' +
      '<div class="r"><span>药水不足时自动购买</span><input type="checkbox" id="ab"' + (st.autoBuy ? ' checked' : '') + '></div>' +
      '<div class="r"><span>☁️ 云存档（手机电脑同步）' + (C ? '：<b>' + esc(C.name) + '</b>' : '：未登录') + '</span><button class="sm pri" id="cloudBtn">' + (C ? '管理' : '登录 / 注册') + '</button></div>' +
      '<div class="r"><span>存档备份（存在本浏览器，清缓存会丢失）</span><span><button class="sm" id="exp">导出存档</button> <button class="sm" id="imp">导入存档</button></span></div>' +
      '<div class="r"><span>切换角色 / 新建角色（各自进度独立保存）</span><button class="sm pri" id="rst">👥 我的角色</button></div></div>' +
      '<div class="muted" style="margin-top:10px">MMU v0.1 · 搭配核心测试版 · 数值会根据试玩反馈调整</div>';
    P.innerHTML = h;
    $('sell').value = st.sell; $('aeq').value = st.autoEq;
    $('sell').onchange = function () { st.sell = +this.value; };
    $('aeq').onchange = function () { st.autoEq = this.value; };
    $('pa').oninput = function () { st.potAt = +this.value; $('pv').textContent = this.value; };
    $('ab').onchange = function () { st.autoBuy = this.checked; };
    $('exp').onclick = function () { save(); var t = ''; try { var F = S.F; S.F = null; t = btoa(unescape(encodeURIComponent(JSON.stringify(S)))); S.F = F; } catch (e) { } modal('<h4>导出存档（当前角色）</h4><div class="muted">复制保存好，换设备或清缓存后可导入恢复。</div><textarea id="et" readonly>' + t + '</textarea><div class="btns"><button class="pri" id="ec">复制</button><button id="ex">关闭</button></div>'); $('ec').onclick = function () { $('et').select(); try { navigator.clipboard.writeText(t).then(function () { toast('已复制'); }, function () { toast('请手动复制'); }); } catch (e) { toast('请手动复制'); } }; $('ex').onclick = closeModal; };
    $('imp').onclick = function () { modal('<h4>导入存档</h4><div class="bad">会覆盖当前角色的进度！</div><textarea id="it"></textarea><div class="btns"><button class="dan" id="iok">导入</button><button id="ix">取消</button></div>'); $('ix').onclick = closeModal; $('iok').onclick = function () { try { var o = M.fixState(JSON.parse(decodeURIComponent(escape(atob($('it').value.trim()))))); if (!o) throw 0; S = o; save(); closeModal(); build(); toast('导入成功'); } catch (e) { toast('存档码无效'); } }; };
    $('rst').onclick = roster;
    $('cloudBtn').onclick = cloudPanel;
  }

  // ---------- 启动 ----------
  function start() {
    S = load();
    if (C) { build0(); $('app').innerHTML += '<div class="muted" style="padding:20px;text-align:center">☁️ 正在同步云存档…</div>'; var done = false, go = function () { if (done) return; done = true; start2(); }; cSync('start', go); setTimeout(go, 6000); return; }
    start2();
  }
  function start2() {
    if (!S) { build0(); classSelect(false); return; }
    var off = (Date.now() - (S.last || Date.now())) / 1000;
    build();
    if (off > 60) { var q = M.mkE(true); M.farm(S, Math.min(off, 8 * 3600), q); offlineSummary(off, q); }
    lastTick = Date.now();
  }
  function build0() { $('app').innerHTML = '<div class="top"><span class="logo">MMU</span> <span class="muted">搭配挂机</span></div>'; }
  start();
  setInterval(tick, 100);
  setInterval(save, 10000);
  document.addEventListener('visibilitychange', function () { if (document.hidden) { save(); cPush(true); } else if (C && S) cSync('show'); });
  setInterval(function () { if (C && S && !document.hidden) cPush(false); }, 60000);
  window.addEventListener('beforeunload', function () { save(); cPush(true); });
  window.__MMU = { get S() { return S; } };
})();
