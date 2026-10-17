// Shared helpers for the four-system floor compare (60→10, 120→10, maker, live).
// Safe when late120 / triad.paper_late120 is absent.
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.PBCompare = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SIDES = ["paper", "paper120", "live"];

  function isObj(x) { return !!x && typeof x === "object" && !Array.isArray(x); }

  function mergeDefined(base, extra) {
    const out = Object.assign({}, base || {});
    if (!isObj(extra)) return out;
    for (const k of Object.keys(extra)) {
      if (extra[k] !== undefined && extra[k] !== null) out[k] = extra[k];
    }
    return out;
  }

  // 120 is checked before "late" / "live" so late-v4-120 and archived-late-v4-120
  // are not swallowed by the 60-minute book. A bare "paper" / "late" tag is 60.
  function srcKind(src) {
    const s = String(src || "").toLowerCase();
    if (!s) return "";
    if (s.includes("maker")) return "maker";
    if (s.includes("120")) return "paper120";
    if (s === "live" || s.includes("live")) return "live";
    if (s === "paper" || s.includes("late") || s === "pm_late" || s.includes("archived") || s.includes("60-10") || s.includes("60_10") || s.startsWith("paper:")) return "paper";
    return s;
  }

  function versionBlob(r) {
    if (!isObj(r)) return "";
    return [r.version, r.ver, r.strategy_version, r.tag, r.archived_tag, r.paper_version]
      .filter(v => v != null && String(v).trim() !== "")
      .join(" ");
  }

  function versionFromSrc(src) {
    const s = String(src || "");
    const i = s.indexOf(":");
    return i < 0 ? "" : s.slice(i + 1).trim();
  }

  function displayVersion(r) {
    if (!isObj(r)) return versionFromSrc(r);
    return String(r.version || r.ver || r.strategy_version || r.tag || r.archived_tag || versionFromSrc(r.src) || "");
  }

  // Version / archived tag wins over a generic src:"paper". Otherwise every
  // late-v% row the floor API stuffed into one paper column is labeled 尾盘60.
  function rowKind(r) {
    if (r == null || r === "") return "";
    if (typeof r === "string") return srcKind(r);
    const v = versionBlob(r).toLowerCase();
    if (v.includes("maker")) return "maker";
    if (v.includes("120")) return "paper120";
    if (v.includes("live")) return "live";
    if (v.includes("late") || v.includes("archived") || v.includes("60-10") || v.includes("60_10")) return "paper";
    return srcKind(r.src || r.bot || "");
  }

  function srcTag(kind, version) {
    const v = String(version || "").trim();
    if (!kind) return v;
    return v ? (kind + ":" + v) : kind;
  }

  function describeSrc(row) {
    const o = typeof row === "string" ? { src: row } : (row || {});
    const kind = rowKind(o) || srcKind(o.src);
    const version = displayVersion(o);
    let text = "";
    if (kind === "live") text = version ? ("实盘 " + version) : "实盘";
    else if (kind === "maker") text = version ? ("做市 " + version) : "做市";
    else if (kind === "paper120") text = version ? ("尾盘120 " + version) : "尾盘120";
    else if (kind === "paper") text = version ? ("尾盘60 " + version) : "尾盘60";
    else text = version || String(o.src || o.bot || "");
    return { kind: kind, version: version, text: text };
  }

  function eventKind(e) {
    if (!e) return "";
    return rowKind(e) || srcKind(`${e.bot || ""} ${e.src || ""}`);
  }

  function num(v) {
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function normOrder(r, inherited) {
    if (!isObj(r)) return null;
    const parent = inherited || {};
    const slug = r.slug || r.market_id || r.market || parent.slug || "";
    const asset = r.asset || parent.asset || "";
    const dur_s = r.dur_s != null ? r.dur_s : parent.dur_s;
    const end_ts = r.end_ts || r.expiry || parent.end_ts || null;
    const ts = r.ts || r.time || null;
    const price = r.fill_px != null ? r.fill_px : r.price;
    const size = r.size != null ? r.size : (r.shares != null ? r.shares : r.qty);
    let cost = r.cost;
    if (cost == null && price != null && size != null) cost = Number(price) * Number(size);
    const o = {
      slug: String(slug || ""),
      asset: asset ? String(asset) : "",
      dur_s: dur_s != null && dur_s !== "" ? Number(dur_s) : null,
      end_ts: num(end_ts),
      ts: num(ts),
      side: r.side || "",
      status: r.status || "",
      fill_px: num(price),
      size: num(size),
      cost: num(cost),
      pnl: num(r.pnl),
      edge: num(r.edge),
      note: r.note || "",
      version: String(r.version || r.ver || r.strategy_version || parent.version || ""),
      tag: String(r.tag || r.archived_tag || parent.tag || ""),
      src: String(r.src || parent.src || ""),
    };
    if (!o.slug && parent._key) o._key = parent._key;
    return o;
  }

  function rowKey(o) {
    if (!o) return "";
    if (o.slug) return "s:" + o.slug;
    if (o._key) return "k:" + o._key;
    if (o.asset && o.end_ts) return "e:" + o.asset + ":" + o.end_ts;
    if (o.asset && o.ts) return "t:" + o.asset + ":" + o.ts + ":" + (o.side || "");
    return "";
  }

  function score(o) {
    if (!o) return -1;
    let s = 0;
    if (o.status) s += 2;
    if (o.side) s += 1;
    if (o.fill_px != null) s += 2;
    if (o.pnl != null) s += 1;
    if (o.cost != null) s += 1;
    if (o.size != null) s += 1;
    if (o.note) s += 1;
    return s;
  }

  function mergeOrder(a, b) {
    if (!a) return b;
    if (!b) return a;
    const sb = score(b), sa = score(a);
    const primary = sb > sa ? b : (sb < sa ? a : ((b.ts || 0) >= (a.ts || 0) ? b : a));
    const secondary = primary === a ? b : a;
    const out = Object.assign({}, secondary, primary);
    for (const k of ["side", "status", "note", "slug", "asset", "version", "tag", "src"]) {
      if ((out[k] == null || out[k] === "") && secondary[k]) out[k] = secondary[k];
    }
    for (const k of ["fill_px", "size", "cost", "pnl", "edge", "ts", "end_ts", "dur_s"]) {
      if (out[k] == null && secondary[k] != null) out[k] = secondary[k];
    }
    if (!out._key && secondary._key) out._key = secondary._key;
    return out;
  }

  function pushList(bucket, list, inherited) {
    if (!Array.isArray(list)) return;
    for (const r of list) {
      const o = normOrder(r, inherited);
      if (o && rowKey(o)) bucket.push(o);
    }
  }

  function ordersFromSys(sys) {
    const bucket = [];
    if (!isObj(sys)) return bucket;
    const inherited = { version: sys.version || "", tag: sys.tag || sys.archived_tag || "" };
    for (const k of ["recent", "orders", "trades", "history"]) pushList(bucket, sys[k], inherited);
    if (isObj(sys.today)) {
      for (const k of ["recent", "orders", "trades"]) pushList(bucket, sys.today[k], inherited);
    }
    return bucket;
  }

  function fillKey(o) {
    if (!o || !o.slug) return "";
    const px = o.fill_px == null ? "" : String(o.fill_px);
    return o.slug + "|" + (o.side || "") + "|" + px;
  }

  function bookIndex(list) {
    const slugs = new Set();
    const fills = new Set();
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o && o.slug) slugs.add(o.slug);
      const k = fillKey(o);
      if (k) fills.add(k);
    }
    return { slugs: slugs, fills: fills };
  }

  // Generic src:"paper" (the merged late-v% column) is 60 only when this fill
  // is not exclusively on the late-v4-120 book.
  function unversionedPaperSide(o, sets) {
    if (!sets || !o || !o.slug) return "paper";
    const in60 = sets.k60.slugs.has(o.slug);
    const in120 = sets.k120.slugs.has(o.slug);
    if (in120 && !in60) return "paper120";
    if (in60 && !in120) return "paper";
    const k = fillKey(o);
    if (k && sets.k120.fills.has(k) && !sets.k60.fills.has(k)) return "paper120";
    return "paper";
  }

  function sideOf(raw, o, fallback, sets) {
    const probe = Object.assign({}, isObj(raw) ? raw : {}, o || {});
    let kind = rowKind(probe);
    if (kind === "maker") return "";
    if (!kind) kind = fallback || "";
    if (sets && kind === "paper" && !versionBlob(probe)) kind = unversionedPaperSide(o, sets);
    if (kind === "paper" || kind === "paper120" || kind === "live") return kind;
    return fallback || "";
  }

  function cell120(e) {
    if (!isObj(e)) return null;
    return e.paper120 || e.late120 || e.paper_late120 || e.p120 || null;
  }

  function pushSide(paper, paper120, live, kind, o) {
    if (!o || !kind) return;
    if (kind === "paper") paper.push(o);
    else if (kind === "paper120") paper120.push(o);
    else if (kind === "live") live.push(o);
  }

  function absorb(paper, paper120, live, raw, inherited, fallback, sets) {
    const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    for (let i = 0; i < list.length; i++) {
      const o = normOrder(list[i], inherited);
      if (!o || !rowKey(o)) continue;
      pushSide(paper, paper120, live, sideOf(list[i], o, fallback, sets), o);
    }
  }

  function collect(state) {
    const S = state || {};
    const T = isObj(S.triad) ? S.triad : {};
    const paper = [], paper120 = [], live = [];
    // Distinct books already exposed by the floor API. Per-row version still
    // wins, so a late-v4-120 fill nested under `late` cannot land in 60-10.
    absorb(paper, paper120, live, ordersFromSys(S.late), null, "paper", null);
    absorb(paper, paper120, live, ordersFromSys(T.paper_late), null, "paper", null);
    absorb(paper, paper120, live, ordersFromSys(S.late120), null, "paper120", null);
    absorb(paper, paper120, live, ordersFromSys(T.paper_late120), null, "paper120", null);
    absorb(paper, paper120, live, ordersFromSys(S.late_live), null, "live", null);
    absorb(paper, paper120, live, ordersFromSys(T.live_late), null, "live", null);
    const sets = { k60: bookIndex(paper), k120: bookIndex(paper120) };
    const LOC = isObj(S.late_order_compare) ? S.late_order_compare : {};
    const aligned = Array.isArray(LOC.aligned) ? LOC.aligned : [];
    for (let i = 0; i < aligned.length; i++) {
      const e = aligned[i];
      if (!isObj(e)) continue;
      const inherited = {
        slug: e.slug,
        asset: e.asset,
        dur_s: e.dur_s,
        end_ts: e.end_ts,
        _key: e.slug ? "" : ("row:" + i),
      };
      // `paper` is the merged late-v% column. Route each row by its own version
      // (late-v4 vs late-v4-120 / archived tag), not into 60 by default.
      if (e.paper) absorb(paper, paper120, live, e.paper, inherited, "paper", sets);
      if (e.live) absorb(paper, paper120, live, e.live, inherited, "live", sets);
      const p120 = cell120(e);
      if (p120) absorb(paper, paper120, live, p120, inherited, "paper120", sets);
    }
    const timeline = Array.isArray(LOC.timeline) ? LOC.timeline : [];
    for (let i = 0; i < timeline.length; i++) {
      const r = timeline[i];
      const hinted = rowKind(r) || srcKind(r && r.src);
      const fallback = hinted === "paper" || hinted === "paper120" || hinted === "live" ? hinted : "";
      absorb(paper, paper120, live, r, null, fallback, sets);
    }
    return { paper: paper, paper120: paper120, live: live };
  }

  function isFilled(o) {
    if (!o) return false;
    const st = String(o.status || "").toLowerCase();
    if (st === "missed" || st === "error" || st === "skip" || st === "skipped" || st === "reject" || st === "rejected") return false;
    if (st === "settled" || st === "open" || st === "filled" || st === "fill" || st === "active") return true;
    return o.fill_px != null;
  }

  function tsOf(row) {
    return row.end_ts || Math.max(
      (row.paper && row.paper.ts) || 0,
      (row.paper120 && row.paper120.ts) || 0,
      (row.live && row.live.ts) || 0
    );
  }

  function align(state, sides) {
    const want = (sides && sides.length) ? sides.slice() : SIDES.slice();
    const bags = collect(state);
    const map = new Map();
    for (let si = 0; si < want.length; si++) {
      const side = want[si];
      const list = bags[side] || [];
      for (let i = 0; i < list.length; i++) {
        const o = list[i];
        const k = rowKey(o);
        if (!k) continue;
        if (!map.has(k)) {
          map.set(k, {
            key: k,
            slug: o.slug || "",
            asset: o.asset || "",
            dur_s: o.dur_s != null ? o.dur_s : null,
            end_ts: o.end_ts || null,
            paper: null,
            paper120: null,
            live: null,
          });
        }
        const row = map.get(k);
        if (!row.slug && o.slug) row.slug = o.slug;
        if (!row.asset && o.asset) row.asset = o.asset;
        if (row.dur_s == null && o.dur_s != null) row.dur_s = o.dur_s;
        if (!row.end_ts && o.end_ts) row.end_ts = o.end_ts;
        row[side] = mergeOrder(row[side], o);
        if (!row.end_ts && row[side] && row[side].end_ts) row.end_ts = row[side].end_ts;
        if (row.dur_s == null && row[side] && row[side].dur_s != null) row.dur_s = row[side].dur_s;
      }
    }
    const rows = Array.from(map.values());
    rows.sort((a, b) => tsOf(b) - tsOf(a));
    const count = { both: 0, filled: {}, pair: {} };
    for (let i = 0; i < want.length; i++) {
      const side = want[i];
      count[side] = rows.filter(r => r[side]).length;
      count.filled[side] = rows.filter(r => isFilled(r[side])).length;
    }
    count.both = rows.filter(r => want.every(s => r[s])).length;
    if (want.indexOf("paper") >= 0 && want.indexOf("live") >= 0) {
      count.pair.paper_live = rows.filter(r => r.paper && r.live).length;
    }
    if (want.indexOf("paper") >= 0 && want.indexOf("paper120") >= 0) {
      count.pair.paper_paper120 = rows.filter(r => r.paper && r.paper120).length;
    }
    if (want.indexOf("paper120") >= 0 && want.indexOf("live") >= 0) {
      count.pair.paper120_live = rows.filter(r => r.paper120 && r.live).length;
    }
    return { rows: rows, count: count, has120: hasLate120(state) };
  }

  function hasLate120(state) {
    const S = state || {};
    const T = isObj(S.triad) ? S.triad : {};
    if (S.late120 || T.paper_late120) return true;
    const LOC = isObj(S.late_order_compare) ? S.late_order_compare : {};
    if ((LOC.aligned || []).some(e => e && (e.paper120 || e.late120 || e.paper_late120 || e.p120 || rowKind(e.paper) === "paper120"))) return true;
    if ((LOC.timeline || []).some(r => rowKind(r) === "paper120")) return true;
    if (ordersFromSys(S.late).some(o => rowKind(o) === "paper120")) return true;
    if (ordersFromSys(T.paper_late).some(o => rowKind(o) === "paper120")) return true;
    return false;
  }

  function mergedTimeline(state) {
    const S = state || {};
    const LOC = isObj(S.late_order_compare) ? S.late_order_compare : {};
    const T = isObj(S.triad) ? S.triad : {};
    const rows = [];
    const seen = new Map();
    const bags = collect(S);
    const sets = { k60: bookIndex(bags.paper), k120: bookIndex(bags.paper120) };
    function bookVersion(o, kind) {
      const list = kind === "paper120" ? bags.paper120 : kind === "live" ? bags.live : kind === "paper" ? bags.paper : [];
      const k = fillKey(o);
      let slugVer = "";
      for (let i = 0; i < list.length; i++) {
        const v = displayVersion(list[i]);
        if (!v) continue;
        if (k && fillKey(list[i]) === k) return v;
        if (o.slug && list[i].slug === o.slug) slugVer = slugVer && slugVer !== v ? "" : (slugVer || v);
      }
      return slugVer;
    }
    function add(r, hint) {
      const o = normOrder(r);
      if (!o) return;
      let kind = rowKind(Object.assign({}, isObj(r) ? r : {}, o)) || hint || "";
      if (kind === "paper" && !versionBlob(o) && !versionBlob(r)) kind = unversionedPaperSide(o, sets);
      if (!kind || kind === "maker") return;
      const ver = displayVersion(o) || displayVersion(r) || bookVersion(o, kind);
      const tag = srcTag(kind, ver);
      const id = [kind, o.slug, o.ts, o.side, o.status, o.fill_px].join("|");
      if (seen.has(id)) {
        const prev = rows[seen.get(id)];
        if (prev && !prev.version && ver) {
          prev.version = ver;
          prev.src = tag;
        }
        return;
      }
      seen.set(id, rows.length);
      rows.push(Object.assign({}, o, { src: tag, version: ver || o.version || "" }));
    }
    const timeline = Array.isArray(LOC.timeline) ? LOC.timeline : [];
    for (let i = 0; i < timeline.length; i++) add(timeline[i], rowKind(timeline[i]));
    if (hasLate120(S)) {
      const extra = ordersFromSys(S.late120).concat(ordersFromSys(T.paper_late120));
      for (let i = 0; i < extra.length; i++) add(extra[i], "paper120");
    }
    // 60-book fills that never made the merged timeline still need a versioned tag.
    const paperOnly = ordersFromSys(S.late).concat(ordersFromSys(T.paper_late));
    for (let i = 0; i < paperOnly.length; i++) {
      if (rowKind(paperOnly[i]) === "paper120") add(paperOnly[i], "paper120");
    }
    rows.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    return rows;
  }

  function sysNode(state, key) {
    const S = state || {};
    const T = isObj(S.triad) ? S.triad : {};
    const map = {
      paper_late: [T.paper_late, S.late],
      paper_late120: [T.paper_late120, S.late120],
      paper_maker: [T.paper_maker, S.pm],
      live_late: [T.live_late, S.late_live],
    };
    const pair = map[key];
    if (!pair) return null;
    const primary = pair[0], fallback = pair[1];
    if (!primary && !fallback) return null;
    const merged = mergeDefined(fallback, primary);
    merged.today = mergeDefined(fallback && fallback.today, primary && primary.today);
    merged.dog = mergeDefined(fallback && fallback.dog, primary && primary.dog);
    if (merged.dog.hb_age == null && merged.hb_age != null) merged.dog.hb_age = merged.hb_age;
    if (merged.dog.pid == null && merged.hb_pid != null) merged.dog.pid = merged.hb_pid;
    if (merged.dog.sync_age == null && merged.sync_mtime != null && S.generated != null) {
      merged.dog.sync_age = Number(S.generated) - Number(merged.sync_mtime);
    }
    return merged;
  }

  function todayOpens(today) {
    if (!isObj(today)) return null;
    if (today.opens != null && today.opens !== "") return today.opens;
    if (today.n != null && today.n !== "") return today.n;
    if (today.fills != null && today.fills !== "") return today.fills;
    return null;
  }

  function winRate(node) {
    if (!isObj(node)) return null;
    if (node.win_rate != null && node.win_rate !== "") {
      const n = Number(node.win_rate);
      return Number.isFinite(n) ? n : null;
    }
    const closed = num(node.n);
    const wins = num(node.wins);
    if (closed != null && closed > 0 && wins != null) return (wins / closed) * 100;
    return null;
  }

  function kpiOf(node) {
    if (!isObj(node)) return null;
    const n = node.n != null ? node.n : (node.filled != null ? node.filled : null);
    return {
      n: n,
      win_rate: winRate(node),
      pnl: node.pnl != null ? node.pnl : null,
      missed: node.missed != null ? node.missed : null,
      errors: node.errors != null ? node.errors : null,
      equity: node.equity != null ? node.equity : null,
    };
  }

  return {
    srcKind: srcKind,
    rowKind: rowKind,
    srcTag: srcTag,
    describeSrc: describeSrc,
    eventKind: eventKind,
    normOrder: normOrder,
    ordersFromSys: ordersFromSys,
    align: align,
    hasLate120: hasLate120,
    mergedTimeline: mergedTimeline,
    sysNode: sysNode,
    todayOpens: todayOpens,
    winRate: winRate,
    kpiOf: kpiOf,
    isFilled: isFilled,
  };
});
