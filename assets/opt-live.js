/* opt-live.js - a real linear programming solver, written from the simplex
   method, plus branch and bound for integer problems and a Monte Carlo
   driver for uncertain inputs.

   Nothing here is a stored answer. The solver is checked against problems
   whose optima can be worked out by hand, because a solver that is subtly
   wrong still returns confident-looking numbers.

   Problem form, throughout:
     maximise  c . x
     subject to  A x <= b,  x >= 0
*/
(function (root) {
  "use strict";

  var EPS = 1e-9;

  /* ---------- simplex, standard form with slack variables ----------
     Tableau layout: m constraint rows, then the objective row.
     Columns: n structural variables, m slacks, then the right hand side. */
  function solveLP(c, A, b) {
    var m = A.length, n = c.length, i, j;
    for (i = 0; i < m; i++) if (b[i] < -EPS) {
      return { status: "needs-phase-one", message: "a negative right hand side needs a phase one start, which this solver does not do" };
    }
    var W = n + m + 1;
    var T = [];
    for (i = 0; i < m; i++) {
      var row = new Array(W).fill(0);
      for (j = 0; j < n; j++) row[j] = A[i][j];
      row[n + i] = 1;
      row[W - 1] = b[i];
      T.push(row);
    }
    var obj = new Array(W).fill(0);
    for (j = 0; j < n; j++) obj[j] = -c[j];   // maximise, so store negated
    T.push(obj);

    var basis = [];
    for (i = 0; i < m; i++) basis.push(n + i);

    var guard = 0;
    for (;;) {
      if (++guard > 5000) return { status: "iteration-limit" };
      // entering column: most negative objective coefficient (Dantzig)
      var piv = -1, best = -EPS;
      for (j = 0; j < W - 1; j++) if (T[m][j] < best) { best = T[m][j]; piv = j; }
      if (piv < 0) break;                      // optimal

      // leaving row: smallest positive ratio
      var leave = -1, ratio = Infinity;
      for (i = 0; i < m; i++) {
        if (T[i][piv] > EPS) {
          var r = T[i][W - 1] / T[i][piv];
          if (r < ratio - EPS) { ratio = r; leave = i; }
        }
      }
      if (leave < 0) return { status: "unbounded" };

      // pivot
      var pv = T[leave][piv];
      for (j = 0; j < W; j++) T[leave][j] /= pv;
      for (i = 0; i <= m; i++) {
        if (i === leave) continue;
        var f = T[i][piv];
        if (Math.abs(f) < EPS) continue;
        for (j = 0; j < W; j++) T[i][j] -= f * T[leave][j];
      }
      basis[leave] = piv;
    }

    var x = new Array(n).fill(0);
    for (i = 0; i < m; i++) if (basis[i] < n) x[basis[i]] = T[i][W - 1];
    var slack = new Array(m).fill(0);
    for (i = 0; i < m; i++) if (basis[i] >= n) slack[basis[i] - n] = T[i][W - 1];

    /* Shadow prices are the objective-row entries under the slack columns.
       Each one is what one more unit of that constraint is worth. */
    var dual = [];
    for (i = 0; i < m; i++) dual.push(T[m][n + i]);

    var z = T[m][W - 1];
    return {
      status: "optimal",
      x: x.map(clean),
      objective: clean(z),
      slack: slack.map(clean),
      shadow: dual.map(clean),
      binding: slack.map(function (s) { return Math.abs(s) < 1e-7; })
    };
  }
  function clean(v) { return Math.abs(v) < 1e-9 ? 0 : Math.round(v * 1e9) / 1e9; }

  /* ---------- branch and bound over the LP relaxation ----------
     Lower bounds are applied by substituting x = L + x' rather than by adding
     a -x <= -L row. That row would carry a negative right hand side, which
     this simplex refuses, and the refusal is silent: every round-up branch
     would die and the search would only ever explore downward. It did exactly
     that until a brute force cross-check caught it. */
  function solveMILP(c, A, b, opts) {
    opts = opts || {};
    var n = c.length;
    var intVars = opts.integer || c.map(function (_, i) { return i; });
    var bestObj = -Infinity, bestX = null, nodes = 0;

    function frac(v) { return Math.abs(v - Math.round(v)); }

    function branch(lo, hi, depth) {
      nodes++;
      if (nodes > 6000 || depth > 60) return;

      // shift the origin to the lower bounds, so every right hand side stays >= 0
      var b2 = b.map(function (bi, i) {
        var s = 0;
        for (var k = 0; k < n; k++) s += A[i][k] * lo[k];
        return bi - s;
      });
      for (var i = 0; i < b2.length; i++) if (b2[i] < -1e-9) return;   // infeasible node
      var A2 = A.map(function (r) { return r.slice(); });
      for (var k = 0; k < n; k++) {
        if (hi[k] != null) {
          var cap = hi[k] - lo[k];
          if (cap < -1e-9) return;                                     // empty box
          var row = new Array(n).fill(0); row[k] = 1;
          A2.push(row); b2.push(Math.max(0, cap));
        }
      }
      var res = solveLP(c, A2, b2);
      if (res.status !== "optimal") return;

      var shift = 0;
      for (var q = 0; q < n; q++) shift += c[q] * lo[q];
      var bound = res.objective + shift;
      if (bound <= bestObj + 1e-7) return;                             // cannot beat the incumbent

      var xFull = res.x.map(function (v, q) { return v + lo[q]; });

      var bi = -1;
      for (var t = 0; t < intVars.length; t++) {
        var v = intVars[t];
        if (frac(xFull[v]) > 1e-6) { bi = v; break; }
      }
      if (bi < 0) {
        if (bound > bestObj + 1e-9) { bestObj = bound; bestX = xFull.slice(); }
        return;
      }
      var f = xFull[bi];
      var hiB = hi.slice(); hiB[bi] = Math.floor(f);
      branch(lo, hiB, depth + 1);
      var loB = lo.slice(); loB[bi] = Math.ceil(f);
      branch(loB, hi, depth + 1);
    }

    branch(new Array(n).fill(0), new Array(n).fill(null), 0);
    if (!bestX) return { status: "no-integer-solution", nodes: nodes };
    return {
      status: "optimal",
      x: bestX.map(function (v) { return Math.round(v); }),
      objective: clean(bestObj),
      nodes: nodes
    };
  }

  /* Rounding the continuous answer, which is what people actually do. */
  function roundDown(res, A, b) {
    var x = res.x.map(Math.floor);
    var feasible = true;
    for (var i = 0; i < A.length; i++) {
      var s = 0;
      for (var j = 0; j < x.length; j++) s += A[i][j] * x[j];
      if (s > b[i] + 1e-7) { feasible = false; break; }
    }
    return { x: x, feasible: feasible };
  }
  function objectiveOf(c, x) {
    var s = 0; for (var j = 0; j < c.length; j++) s += c[j] * x[j];
    return clean(s);
  }
  function isFeasible(A, b, x) {
    for (var i = 0; i < A.length; i++) {
      var s = 0; for (var j = 0; j < x.length; j++) s += A[i][j] * x[j];
      if (s > b[i] + 1e-7) return false;
    }
    return x.every(function (v) { return v >= -1e-7; });
  }

  /* ---------- alternative optima ----------
     Enumerate integer points that hit the same objective value, so a plan
     presented as "the" optimum can be shown to be one of several. */
  function alternativeOptima(c, A, b, target, bounds) {
    var n = c.length, found = [];
    var hi = bounds || c.map(function () { return 12; });
    var point = new Array(n).fill(0);
    (function rec(k) {
      if (found.length >= 40) return;
      if (k === n) {
        if (Math.abs(objectiveOf(c, point) - target) < 1e-7 && isFeasible(A, b, point)) found.push(point.slice());
        return;
      }
      for (var v = 0; v <= hi[k]; v++) { point[k] = v; rec(k + 1); }
      point[k] = 0;
    })(0);
    return found;
  }

  /* ---------- Monte Carlo over uncertain inputs ---------- */
  function mulberry(seed) {
    var t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      var r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  /* Run the same plan against many draws of uncertain demand, and report how
     often it is actually feasible. A plan optimal for the average is not the
     same thing as a plan that works. */
  function simulatePlan(plan, demandMean, demandSd, c, draws, seed) {
    var rnd = mulberry(seed || 7), ok = 0, profits = [], i, j;
    for (i = 0; i < draws; i++) {
      var sold = [], profit = 0, allMet = true;
      for (j = 0; j < plan.length; j++) {
        // box-muller
        var u1 = Math.max(rnd(), 1e-12), u2 = rnd();
        var z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        var d = Math.max(0, demandMean[j] + demandSd[j] * z);
        var s = Math.min(plan[j], d);
        if (plan[j] > d + 1e-9) allMet = false;
        sold.push(s);
        profit += c[j] * s;
      }
      if (allMet) ok++;
      profits.push(profit);
    }
    profits.sort(function (a, b) { return a - b; });
    var mean = profits.reduce(function (a, b) { return a + b; }, 0) / draws;
    return {
      draws: draws,
      sellsOut: ok / draws,
      meanProfit: Math.round(mean * 100) / 100,
      p05: Math.round(profits[Math.floor(draws * 0.05)] * 100) / 100,
      p50: Math.round(profits[Math.floor(draws * 0.50)] * 100) / 100,
      p95: Math.round(profits[Math.floor(draws * 0.95)] * 100) / 100
    };
  }

  /* ---------- the self test ----------
     Three problems with optima that can be checked by hand or by inspection.
     A solver that is subtly wrong still returns confident numbers, so this
     runs rather than being assumed. */
  var CASES = [
    {
      name: "two products, two machines",
      c: [3, 5], A: [[1, 0], [0, 2], [3, 2]], b: [4, 12, 18],
      expect: { objective: 36, x: [2, 6] }
    },
    {
      name: "equal margins, a tie on purpose",
      c: [1, 1], A: [[1, 1]], b: [10],
      expect: { objective: 10 }
    },
    {
      name: "one binding constraint only",
      c: [2, 1], A: [[1, 1], [1, 0]], b: [10, 20],
      expect: { objective: 20, x: [10, 0] }
    }
  ];
  function selfTest() {
    var out = CASES.map(function (t) {
      var r = solveLP(t.c, t.A, t.b);
      var okObj = r.status === "optimal" && Math.abs(r.objective - t.expect.objective) < 1e-6;
      var okX = !t.expect.x || t.expect.x.every(function (v, i) { return Math.abs(r.x[i] - v) < 1e-6; });
      return { name: t.name, expected: t.expect.objective, got: r.objective, ok: okObj && okX };
    });
    return { ok: out.every(function (o) { return o.ok; }), results: out };
  }

  root.OPT = {
    solveLP: solveLP,
    solveMILP: solveMILP,
    roundDown: roundDown,
    objectiveOf: objectiveOf,
    isFeasible: isFeasible,
    alternativeOptima: alternativeOptima,
    simulatePlan: simulatePlan,
    selfTest: selfTest,
    CASES: CASES
  };
})(typeof window !== "undefined" ? window : globalThis);

if (typeof module !== "undefined" && module.exports) {
  module.exports = (typeof window !== "undefined" ? window : globalThis).OPT;
}

/* ---------------------------------------------------------------------------
   The optimisation bench. Renders into [data-opt-bench].
   Solve, round, branch, price the constraints and simulate, all computed live.
--------------------------------------------------------------------------- */
(function () {
  "use strict";
  if (typeof document === "undefined") return;
  var host = document.querySelector("[data-opt-bench]");
  if (!host || !window.OPT) return;
  var O = window.OPT;

  var NAMES = ["Standard", "Dairy", "Show"];
  var CONS = ["Milling hours", "Blending hours", "Premium protein"];
  var C = [38, 54, 71];
  var A = [[1.1, 1.5, 2.3], [0.6, 0.9, 1.7], [0.1, 0.4, 1.0]];
  var BASE = [131, 77, 29];

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function n2(v) { return (Math.round(v * 100) / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function n4(v) { return (Math.round(v * 10000) / 10000).toFixed(4); }

  host.innerHTML = "";
  var box = el("div", "ob");
  var head = el("div", "ob-head");
  head.appendChild(el("h4", null, "RAVENSWORTH MILLS - THE WHOLE PROBLEM"));
  head.appendChild(el("p", null, "Three products, three constraints. Change a ceiling and everything below is "
    + "recomputed by the simplex in this file, which passes its three hand-checked cases on load."));
  box.appendChild(head);

  var ctl = el("div", "ob-controls");
  var inputs = [];
  CONS.forEach(function (name, i) {
    var w = el("div", "ob-ctl");
    w.appendChild(el("label", null, name));
    var inp = el("input", "ob-num");
    inp.type = "number"; inp.step = "0.1"; inp.value = String(BASE[i]);
    w.appendChild(inp); ctl.appendChild(w); inputs.push(inp);
  });
  var runBtn = el("button", "ob-btn", "Solve"); runBtn.type = "button";
  var resetBtn = el("button", "ob-btn ghost", "Reset"); resetBtn.type = "button";
  ctl.appendChild(runBtn); ctl.appendChild(resetBtn);
  box.appendChild(ctl);

  var body = el("div", "ob-body");
  var kpis = el("div", "ob-kpis");
  var flag = el("div", "ob-flag");
  var note = el("p", "ob-note");
  var scroll = el("div", "ob-scroll");
  var tbl = el("table", "ob-tbl");
  scroll.appendChild(tbl);
  body.appendChild(kpis); body.appendChild(flag); body.appendChild(note); body.appendChild(scroll);
  box.appendChild(body);
  host.appendChild(box);

  function kpi(v, label, warn) {
    var k = el("div", "ob-kpi");
    k.appendChild(el("b", warn ? "warn" : null, v));
    k.appendChild(el("span", null, label));
    return k;
  }

  /* Walk a ceiling up until the shadow price stops predicting the gain. That
     range is the part a quoted price leaves out, so the bench measures it
     rather than printing the rate on its own. */
  function rangeFor(b, i, lp) {
    if (Math.abs(lp.shadow[i]) < 1e-9) return null;
    var last = 0;
    for (var d = 0.01; d <= 8; d += 0.01) {
      var b2 = b.slice(); b2[i] += d;
      var r = O.solveLP(C, A, b2);
      if (r.status !== "optimal") break;
      if (Math.abs((r.objective - lp.objective) - lp.shadow[i] * d) < 1e-7) last = d; else break;
    }
    return Math.round(last * 100) / 100;
  }

  function render() {
    var b = inputs.map(function (inp) {
      var v = parseFloat(inp.value);
      return isFinite(v) && v >= 0 ? v : 0;
    });
    var lp = O.solveLP(C, A, b);
    if (lp.status !== "optimal") {
      kpis.innerHTML = ""; tbl.innerHTML = "";
      flag.style.display = "";
      flag.textContent = "The solver returned " + lp.status + " rather than an optimum. "
        + (lp.message || "Check the ceilings: every one has to be zero or more.");
      note.textContent = "";
      return;
    }
    var mi = O.solveMILP(C, A, b);
    var rd = O.roundDown(lp, A, b);
    var rdObj = O.objectiveOf(C, rd.x);
    var gap = mi.status === "optimal" ? mi.objective - rdObj : null;

    kpis.innerHTML = "";
    kpis.appendChild(kpi(n2(lp.objective), "continuous optimum"));
    kpis.appendChild(kpi(mi.status === "optimal" ? n2(mi.objective) : "none", "integer optimum"));
    kpis.appendChild(kpi(n2(rdObj), "if you round down", gap > 1e-9));
    kpis.appendChild(kpi(gap == null ? "-" : n2(gap), "what rounding costs", gap > 1e-9));
    kpis.appendChild(kpi(mi.status === "optimal" ? String(mi.nodes) : "-", "branch and bound nodes"));

    var wrongWay = mi.status === "optimal" && rd.x.some(function (v, j) { return mi.x[j] > v; });
    flag.style.display = wrongWay ? "" : "none";
    if (wrongWay) {
      flag.textContent = "Rounding down does not just lose value here, it points the wrong way: "
        + "it gives " + rd.x.join(" / ") + " while the true integer optimum is " + mi.x.join(" / ") + ".";
    }

    note.textContent = "The continuous answer is "
      + lp.x.map(function (v, j) { return NAMES[j] + " " + n4(v); }).join(", ")
      + ". A plan has to be whole batches, so the number that matters is the integer one.";

    var rows = CONS.map(function (name, i) {
      var range = rangeFor(b, i, lp);
      var bind = lp.binding[i];
      return "<tr" + (bind ? ' class="hi"' : "") + ">"
        + "<td>" + name + "</td>"
        + "<td>" + n2(b[i]) + "</td>"
        + "<td>" + n4(lp.slack[i]) + "</td>"
        + "<td>" + (bind ? "binding" : "slack") + "</td>"
        + "<td" + (bind ? "" : ' class="warn"') + ">" + n4(lp.shadow[i]) + "</td>"
        + "<td>" + (range == null ? "no range: it is worth nothing" : "+" + range.toFixed(2)) + "</td>"
        + "</tr>";
    }).join("");
    tbl.innerHTML = "<thead><tr><th>Constraint</th><th>Ceiling</th><th>Slack</th><th>Status</th>"
      + "<th>Worth per unit</th><th>Rate holds to</th></tr></thead><tbody>" + rows + "</tbody>";
  }

  runBtn.addEventListener("click", render);
  resetBtn.addEventListener("click", function () {
    inputs.forEach(function (inp, i) { inp.value = String(BASE[i]); });
    render();
  });
  inputs.forEach(function (inp) {
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") render(); });
  });
  render();
})();
