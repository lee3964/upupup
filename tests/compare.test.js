"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const PB = require("../compare.js");

function sample(with120) {
  const state = {
    generated: 1_700_000_000,
    late: {
      version: "late-v4",
      equity: 1000,
      pnl: 12,
      n: 4,
      wins: 3,
      recent: [
        { slug: "btc-updown-5m-1", asset: "btc", dur_s: 300, ts: 100, end_ts: 130, side: "UP", status: "settled", fill_px: 0.42, size: 10, cost: 4.2, pnl: 1.2 },
        { slug: "eth-updown-5m-2", asset: "eth", dur_s: 300, ts: 200, end_ts: 230, side: "DOWN", status: "missed" },
      ],
    },
    late_live: {
      version: "live-late-v1",
      equity: 800,
      pnl: -2,
      n: 2,
      wins: 1,
      recent: [
        { slug: "btc-updown-5m-1", asset: "btc", dur_s: 300, ts: 101, end_ts: 130, side: "UP", status: "missed", note: "thin" },
      ],
    },
    late_order_compare: {
      aligned: [
        {
          slug: "btc-updown-5m-1",
          asset: "btc",
          dur_s: 300,
          end_ts: 130,
          paper: { side: "UP", status: "settled", fill_px: 0.42, cost: 4.2, pnl: 1.2, note: "from-align" },
          live: { side: "UP", status: "missed", note: "thin" },
        },
        {
          slug: "",
          asset: "xrp",
          dur_s: 300,
          end_ts: 400,
          paper: { side: "DOWN", status: "open", fill_px: 0.2, cost: 1 },
          live: { side: "DOWN", status: "open", fill_px: 0.21, cost: 1 },
        },
      ],
      timeline: [
        { src: "paper", slug: "btc-updown-5m-1", ts: 100, side: "UP", status: "settled", fill_px: 0.42, pnl: 1.2 },
        { src: "live", slug: "btc-updown-5m-1", ts: 101, side: "UP", status: "missed" },
      ],
      n_paper: 1,
      n_live: 1,
    },
    triad: {
      paper_late: { label: "模拟·尾盘", version: "late-v4", equity: 1000, pnl: 12, win_rate: 75, today: { pnl: 3, opens: 2, win_rate: 50 }, dog: { status: "ok", pid: 11 } },
      paper_maker: { version: "maker-v7", equity: 500, pnl: 1, today: { pnl: 0.2, fills: 6, win_rate: 40 }, dog: { status: "ok" } },
      live_late: { version: "live-late-v1", equity: 800, pnl: -2, win_rate: 50, today: { n: 1, pnl: -1 }, dog: { status: "remote_ok" } },
    },
  };
  if (with120) {
    state.late120 = {
      version: "late-v4-120",
      equity: 1100,
      pnl: 8,
      n: 5,
      wins: 2,
      budget: 1000,
      recent: [
        { slug: "btc-updown-5m-1", asset: "btc", dur_s: 300, ts: 90, end_ts: 130, side: "UP", status: "settled", fill_px: 0.4, size: 12, pnl: 0.5 },
        { slug: "sol-updown-5m-3", asset: "sol", dur_s: 300, ts: 300, end_ts: 330, side: "UP", status: "open", fill_px: 0.55, size: 8, cost: 4.4 },
      ],
    };
    state.triad.paper_late120 = {
      version: "late-v4-120",
      equity: 1100,
      pnl: 8,
      today: { pnl: 1.5, win_rate: 100 },
      dog: { status: "ok", pid: 22 },
    };
    state.late_order_compare.timeline.push({
      src: "paper120", slug: "btc-updown-5m-1", ts: 90, side: "UP", status: "settled", fill_px: 0.4, pnl: 0.5,
    });
  }
  return state;
}

test("aligns 60 and 120 by slug and keeps one-sided markets", () => {
  const view = PB.align(sample(true), ["paper", "paper120"]);
  const btc = view.rows.find(r => r.slug === "btc-updown-5m-1");
  const eth = view.rows.find(r => r.slug === "eth-updown-5m-2");
  const sol = view.rows.find(r => r.slug === "sol-updown-5m-3");
  assert.ok(btc && btc.paper && btc.paper120);
  assert.equal(btc.paper.side, "UP");
  assert.equal(btc.paper120.fill_px, 0.4);
  assert.equal(btc.paper120.size, 12);
  assert.equal(btc.paper.note, "from-align");
  assert.equal(btc.paper.size, 10);
  assert.ok(eth && eth.paper && !eth.paper120);
  assert.equal(eth.paper.status, "missed");
  assert.ok(sol && sol.paper120 && !sol.paper);
  assert.equal(view.count.both, 1);
  assert.equal(view.count.paper, 3);
  assert.equal(view.count.paper120, 2);
  assert.equal(view.count.filled.paper120, 2);
  assert.equal(view.count.filled.paper, 2);
  assert.equal(PB.isFilled(eth.paper), false);
});

test("three-column paper vs live keeps working and adds 120", () => {
  const view = PB.align(sample(true), ["paper", "paper120", "live"]);
  const btc = view.rows.find(r => r.slug === "btc-updown-5m-1");
  assert.equal(btc.live.status, "missed");
  assert.equal(btc.paper120.status, "settled");
  assert.equal(view.count.pair.paper_live >= 1, true);
  assert.equal(view.count.pair.paper_paper120, 1);
  const xrp = view.rows.find(r => r.asset === "xrp" && !r.slug);
  assert.ok(xrp && xrp.paper && xrp.live);
  assert.equal(xrp.paper.side, "DOWN");
});

test("missing late120 does not drop paper or live rows", () => {
  const state = sample(false);
  assert.equal(PB.hasLate120(state), false);
  const view = PB.align(state, ["paper", "paper120", "live"]);
  assert.equal(view.count.paper120, 0);
  assert.equal(view.count.paper >= 2, true);
  assert.equal(view.count.live >= 1, true);
  assert.equal(view.rows.some(r => r.slug === "btc-updown-5m-1" && r.paper && r.live), true);
  const tl = PB.mergedTimeline(state);
  assert.equal(tl.some(r => PB.srcKind(r.src) === "paper120"), false);
  assert.equal(tl.some(r => PB.srcKind(r.src) === "paper"), true);
  assert.equal(tl.some(r => PB.srcKind(r.src) === "live"), true);
  const paperRow = tl.find(r => PB.srcKind(r.src) === "paper");
  assert.match(paperRow.src, /late-v4/);
  assert.equal(paperRow.src.includes("120"), false);
  assert.equal(PB.describeSrc(paperRow).text.includes("尾盘60"), true);
  assert.equal(PB.describeSrc(paperRow).text.includes("尾盘120"), false);
});

test("timeline and aligned paper120 fields are picked up without recent", () => {
  const state = sample(false);
  state.late_order_compare.aligned[0].paper120 = {
    side: "DOWN", status: "settled", fill_px: 0.33, size: 4, pnl: 0.2,
  };
  state.late_order_compare.timeline.push({
    src: "late120", slug: "sol-updown-5m-9", asset: "sol", dur_s: 300, ts: 500, end_ts: 530,
    side: "UP", status: "missed",
  });
  assert.equal(PB.hasLate120(state), true);
  const view = PB.align(state, ["paper", "paper120"]);
  const btc = view.rows.find(r => r.slug === "btc-updown-5m-1");
  assert.equal(btc.paper120.side, "DOWN");
  assert.equal(btc.paper120.size, 4);
  const sol = view.rows.find(r => r.slug === "sol-updown-5m-9");
  assert.ok(sol && sol.paper120 && !sol.paper);
  assert.equal(sol.paper120.status, "missed");
  const tl = PB.mergedTimeline(state);
  assert.equal(tl.filter(r => PB.srcKind(r.src) === "paper120").length >= 1, true);
  const solTl = tl.find(r => r.slug === "sol-updown-5m-9");
  assert.equal(PB.srcKind(solTl.src), "paper120");
  assert.equal(PB.describeSrc(solTl).text.startsWith("尾盘120"), true);
});

test("sysNode merges triad card fields with late120 recent and derives win rate", () => {
  const state = sample(true);
  delete state.triad.paper_late120.win_rate;
  state.late120.today = { opens: 3 };
  const node = PB.sysNode(state, "paper_late120");
  assert.equal(node.version, "late-v4-120");
  assert.equal(node.equity, 1100);
  assert.equal(node.today.pnl, 1.5);
  assert.equal(node.today.opens, 3);
  assert.equal(node.today.win_rate, 100);
  assert.ok(Array.isArray(node.recent) && node.recent.length === 2);
  assert.equal(node.dog.pid, 22);
  assert.equal(PB.winRate(node), 40);
  assert.equal(PB.todayOpens(node.today), 3);
  assert.equal(PB.todayOpens({ n: 0 }), 0);
  assert.equal(PB.todayOpens({ fills: 6 }), 6);
  const maker = PB.sysNode(state, "paper_maker");
  assert.equal(PB.todayOpens(maker.today), 6);
  assert.equal(PB.kpiOf(node).equity, 1100);
});

test("merged late-v% paper column keeps late-v4-120 out of 60-10", () => {
  const state = sample(false);
  state.late.recent = [];
  state.late.pnl = 0;
  state.late.n = 0;
  state.late120 = {
    version: "late-v4-120",
    equity: 1000,
    pnl: 1,
    n: 1,
    wins: 1,
    recent: [],
  };
  state.triad.paper_late120 = { version: "late-v4-120", equity: 1000, pnl: 1, today: { pnl: 1, opens: 1 } };
  state.late_order_compare.aligned.push({
    slug: "sol-updown-5m-9",
    asset: "sol",
    dur_s: 300,
    end_ts: 530,
    paper: { side: "UP", status: "settled", fill_px: 0.61, size: 5, pnl: 1, version: "late-v4-120" },
    live: { side: "UP", status: "missed", version: "live-late-v1" },
  });
  state.late_order_compare.aligned.push({
    slug: "btc-updown-5m-1",
    asset: "btc",
    dur_s: 300,
    end_ts: 130,
    paper: { side: "DOWN", status: "settled", fill_px: 0.2, pnl: 0.1, tag: "archived-late-v4" },
  });
  state.late_order_compare.timeline = [
    { src: "paper", version: "late-v4-120", slug: "sol-updown-5m-9", asset: "sol", dur_s: 300, ts: 500, end_ts: 530, side: "UP", status: "settled", fill_px: 0.61, pnl: 1 },
    { src: "paper", version: "late-v4", slug: "eth-updown-5m-2", asset: "eth", dur_s: 300, ts: 200, end_ts: 230, side: "DOWN", status: "missed" },
    { src: "paper", tag: "archived-late-v4-120", slug: "doge-updown-5m-4", asset: "doge", dur_s: 300, ts: 600, end_ts: 630, side: "UP", status: "open", fill_px: 0.44 },
  ];
  const view = PB.align(state, ["paper", "paper120", "live"]);
  const sol = view.rows.find(r => r.slug === "sol-updown-5m-9");
  assert.ok(sol && sol.paper120 && !sol.paper);
  assert.equal(sol.paper120.version, "late-v4-120");
  assert.equal(sol.live.status, "missed");
  const eth = view.rows.find(r => r.slug === "eth-updown-5m-2");
  assert.ok(eth && eth.paper && !eth.paper120);
  assert.equal(eth.paper.version, "late-v4");
  const doge = view.rows.find(r => r.slug === "doge-updown-5m-4");
  assert.ok(doge && doge.paper120 && !doge.paper);
  const btc = view.rows.find(r => r.slug === "btc-updown-5m-1");
  assert.equal(btc.paper.tag, "archived-late-v4");
  assert.equal(btc.paper120, null);
  assert.equal(view.count.paper120 >= 2, true);
  const tl = PB.mergedTimeline(state);
  const solTl = tl.find(r => r.slug === "sol-updown-5m-9");
  assert.equal(PB.srcKind(solTl.src), "paper120");
  assert.match(solTl.src, /late-v4-120/);
  const label = PB.describeSrc(solTl);
  assert.equal(label.kind, "paper120");
  assert.equal(label.text.includes("尾盘120"), true);
  assert.equal(label.text.includes("尾盘60"), false);
  const ethTl = tl.find(r => r.slug === "eth-updown-5m-2");
  assert.equal(PB.srcKind(ethTl.src), "paper");
  assert.match(ethTl.src, /late-v4/);
  assert.equal(ethTl.src.includes("120"), false);
  assert.equal(PB.describeSrc({ src: "paper", version: "late-v4-120" }).text.startsWith("尾盘120"), true);
  assert.equal(PB.rowKind({ src: "paper", version: "archived-late-v4-120" }), "paper120");
  assert.equal(PB.rowKind({ src: "paper", tag: "archived-late-v4" }), "paper");
});

test("fill that exists only on late120 is not shown under 60 even without a version field", () => {
  const state = sample(false);
  state.late.recent = [];
  state.late120 = {
    version: "late-v4-120",
    recent: [
      { slug: "sol-updown-5m-9", asset: "sol", dur_s: 300, ts: 500, end_ts: 530, side: "UP", status: "settled", fill_px: 0.61, size: 5, pnl: 1 },
    ],
  };
  state.triad.paper_late120 = { version: "late-v4-120", equity: 1000, pnl: 1 };
  state.late_order_compare.aligned.push({
    slug: "sol-updown-5m-9",
    asset: "sol",
    dur_s: 300,
    end_ts: 530,
    paper: { side: "UP", status: "settled", fill_px: 0.61, size: 5, pnl: 1 },
    live: null,
  });
  state.late_order_compare.timeline.push({
    src: "paper", slug: "sol-updown-5m-9", asset: "sol", dur_s: 300, ts: 500, end_ts: 530, side: "UP", status: "settled", fill_px: 0.61, pnl: 1,
  });
  const view = PB.align(state, ["paper", "paper120", "live"]);
  const sol = view.rows.find(r => r.slug === "sol-updown-5m-9");
  assert.ok(sol && sol.paper120 && !sol.paper);
  assert.equal(sol.paper120.version, "late-v4-120");
  const tl = PB.mergedTimeline(state).find(r => r.slug === "sol-updown-5m-9");
  assert.equal(PB.srcKind(tl.src), "paper120");
  assert.match(tl.src, /late-v4-120/);
  assert.equal(PB.describeSrc(tl).text.includes("尾盘60"), false);
});

test("empty state does not throw", () => {
  const view = PB.align({}, ["paper", "paper120", "live"]);
  assert.deepEqual(view.rows, []);
  assert.equal(view.count.both, 0);
  assert.equal(view.has120, false);
  assert.equal(PB.sysNode({}, "paper_late120"), null);
  assert.equal(PB.winRate(null), null);
  assert.equal(PB.todayOpens(null), null);
  assert.deepEqual(PB.mergedTimeline(null), []);
});
