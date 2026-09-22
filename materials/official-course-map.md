# Official course map - learn-prescriptive-analytics-with-phoebe

Bucket `ds`, difficulty d4, 16 sessions, Leader 6 + Practitioner 10.
**Every session is 45 minutes, on both tracks.** That is the estate convention and the
landing page states it; a page carrying any other figure contradicts its own course.
Company: **Ravensworth Mills**, a fictional feed mill blending and bagging three products.
Scope: **optimisation as the decision layer.** Prediction tells you what will happen; this is
about choosing what to do about it.

---

## The seam

| Subject | Owner | This course |
|---|---|---|
| MCMC, sampling a posterior | `learn-bayesian-with-phoebe` | Not touched. Bayesian's "Monte Carlo" means walking a posterior; here it means drawing uncertain inputs and re-running a plan. Different technique, different purpose, named as such. |
| Prediction, model choice, evaluation | `learn-intro-ml`, `learn-model-evaluation`, `learn-ml-strategy` | Not taught. This course starts after a forecast exists. |
| Decision framing, options, judgement under uncertainty | `learn-decision-intelligence-with-phoebe` | Named once. That course frames the decision; this one solves it once the constraints are written down. |
| Metric trees, driver decomposition | `learn-metric-decomposition-with-phoebe` | Not taught. |

**Estate vocabulary check before this build.** `linear programming` **0**, `integer programming`
**0**, `simplex` **0**, `objective function` **0**, `shadow price` **0**, `feasible region` **0**,
`constraint matrix` **0**, `duality` **0**, `knapsack` **0**, `decision variable` **0**,
`optimal allocation` **0**, `capacity constraint` **0**. Twelve terms, all zero.

`Monte Carlo` returned 7 pages and **both sources were checked individually**: in
`learn-bayesian` it is MCMC over a posterior, and in `learn-data-pipelines` it is the *company*
Monte Carlo in a cited survey. Neither is simulation for decisions.

---

## Frozen canon - Ravensworth Mills

Computed in node from `assets/opt-live.js` before any page quoted a number.
**Any page citing these must match exactly.**

### The solver is real, and it was wrong twice before it was right

`opt-live.js` implements the simplex method, branch and bound over the LP relaxation, and a
Monte Carlo driver. It carries three problems whose optima can be checked by hand and runs them
via `selfTest()`:

| Problem | Optimum |
|---|---|
| max 3x+5y, x<=4, 2y<=12, 3x+2y<=18 | **36** at (2, 6) |
| max x+y, x+y<=10 (a deliberate tie) | **10** |
| max 2x+y, x+y<=10, x<=20 | **20** at (10, 0) |

Passing those three was **not enough**. A brute force cross-check over 1,100 randomly generated
problems found two separate faults, in opposite directions:

1. **The solver understated optima.** Branch and bound applied a lower bound like `x >= 5` as a
   row `-x <= -5`, which carries a negative right hand side. This simplex refuses those, and the
   refusal was silent, so every round-up branch died and the search only ever explored downward.
   Fixed by shifting the origin instead: substitute `x = L + x'`, which keeps every right hand
   side non-negative.
2. **The checker was wrong.** After the fix the solver appeared to *overstate*. It was correct:
   the brute force capped every variable at 12, so genuine optima sat outside its search box.
   The fix was to size each variable's box from the constraints.

**After both fixes: 1,100 of 1,100 agree across five seeds.** This sequence is taught in p9,
because a solver that is subtly wrong returns confident, plausible numbers and neither fault was
visible from reading the code.

### The base case

Three products, margin per tonne: Standard **38**, Dairy **54**, Show **71**.

| Constraint | Standard | Dairy | Show | Available |
|---|---|---|---|---|
| Milling hours | 1.1 | 1.5 | 2.3 | **131** |
| Blending hours | 0.6 | 0.9 | 1.7 | **77** |
| Premium protein, tonnes | 0.1 | 0.4 | 1.0 | **29** |

| | Standard | Dairy | Show | Margin |
|---|---|---|---|---|
| Continuous optimum | 30.6897 | 64.8276 | 0 | **4,666.90** |
| Integer optimum | **33** | **63** | **0** | **4,656.00** (29 nodes) |
| Round the continuous answer down | 30 | 64 | 0 | **4,596.00** (feasible) |

**Three findings, all measured:**

1. **The highest-margin product is never made.** Show earns 71 a tonne against Standard's 38 and
   is zero in every optimal plan. Margin per tonne ranks products; it does not allocate capacity,
   because Show consumes 2.3 milling hours against Standard's 1.1.
2. **Rounding costs 60.00 and points the wrong way.** The continuous answer says 30.69 Standard,
   so rounding gives 30. The true integer optimum is **33**. Rounding is not a small
   approximation here, it moves in the opposite direction to the right answer.
3. **A constraint that looks tight can be worth nothing.** Blending hours are not binding and
   their shadow price is exactly **0**.

### Shadow prices, and the range nobody quotes

| Constraint | Shadow price | Binding |
|---|---|---|
| Milling hours | **33.7931** | yes |
| Blending hours | **0** | no |
| Premium protein | **8.2759** | yes |

A shadow price is a **local rate with a validity range**, not a price you may multiply by any
quantity. Measured on the milling constraint:

| Extra hours | Predicted by the shadow price | Actual gain | Agree |
|---|---|---|---|
| 0.01 | 0.3379 | 0.3379 | yes |
| 0.10 | 3.3793 | 3.3793 | yes |
| 0.25 | 8.4483 | 8.4483 | yes |
| 0.50 | 16.8966 | 16.4368 | no |
| 1.00 | 33.7931 | 26.4368 | no |
| 2.00 | 67.5862 | 46.4368 | no |

**The shadow price holds up to about +0.46 milling hours**, then the binding set changes and the
real gain flattens. Buying **10 extra hours** looks like 10 x 33.7931 = **337.93**; the actual
gain is **206.44**, so the naive figure **overstates by 1.64 times**.

That 206.44 is the **continuous** gain. The **integer** plan gains **208.00** over the same ten
hours, rising from 4,656.00 to **4,864.00**. Both are far below the naive 337.93, and a page
showing a learner the integer bench should quote the integer figure rather than the continuous
one.

### Why the ranking reverses, in one table

Margin per tonne ranks the products one way. Margin per unit of the **scarce** resource ranks
them the other way, and the optimal plan follows the second.

| Product | Margin per tonne | Per milling hour | Per blending hour | Per tonne of protein |
|---|---|---|---|---|
| Standard | 38 | **34.55** | 63.33 | 380.00 |
| Dairy | 54 | **36.00** | 60.00 | 135.00 |
| Show | 71 | **30.87** | 41.76 | 71.00 |

By margin per tonne the order is Show, Dairy, Standard. **By margin per milling hour it is Dairy,
Standard, Show, which is exactly the order the optimal plan uses** (63 Dairy, 33 Standard, no
Show). The highest-margin product is last once the measure is the resource that actually runs out.

This is a per-unit ranking against a single binding constraint. It happens to agree with the
optimum here; with two or more binding constraints it need not, which is why the solver exists
rather than a sorted list.

### Slack, measured

| Constraint | Slack | Binding |
|---|---|---|
| Milling hours | 0 | yes |
| Blending hours | **0.2414** | no |
| Premium protein | 0 | yes |

Blending finishes with 0.2414 hours unused, which is why its shadow price is 0.

### Validity range for each binding constraint

| Constraint | Shadow price | Rate holds to |
|---|---|---|
| Milling hours | 33.7931 | **+0.46 hours** |
| Premium protein | 8.2759 | **+0.77 tonnes** |
| Blending hours | 0 | not binding, so there is no range to measure |

Both ranges are short. A shadow price is a statement about the next fraction of a unit, not about
a purchase order.

### What the optimal plan actually delivers

The deterministic plan (33 / 63 / 0) promises **4,656**. Run it against uncertain demand
(Standard mean 33 sd 6, Dairy mean 63 sd 11, 10,000 draws):

| Seed | Sells out | Mean profit | 5th percentile | Median |
|---|---|---|---|---|
| 7 | 25.1% | 4,317.94 | 3,539.75 | 4,440.26 |
| 101 | 25.6% | 4,327.93 | 3,571.12 | 4,451.73 |
| 2024 | 24.7% | 4,330.55 | 3,590.76 | 4,446.08 |
| 55555 | 24.8% | 4,328.35 | 3,559.39 | 4,448.79 |
| 987654 | 24.4% | 4,323.93 | 3,562.75 | 4,448.95 |

**Across five seeds the mean profit is 4,318 to 4,331 against a promised 4,656, a shortfall of
325 to 338, and the plan sells out only about a quarter of the time.**

**What "sells out" counts, precisely.** `simulatePlan` marks a draw a success when
`plan[j] <= demand[j]` for **every** product, that is, demand took every tonne the plan made and
nothing was left unsold. It is **not** the same as meeting demand in full, which would be the
opposite condition, and an earlier version of this table mislabelled the column that way. The
shortfall against 4,656 comes from the other three quarters of weeks, where some of what the
plan made found no buyer. A plan optimal for
the average is not a plan that works on a given week, and the optimiser never said it was.

### A claim NOT to make

**Do not say this plan has alternative optima.** It was checked: exactly **one** integer plan
achieves 4,656. Degeneracy is real and worth teaching as a concept, but it is not a property of
this instance and no page may imply otherwise.

---

## Coverage per session

`✓` taught to working depth. `◐` named and handed on.

### Leader track

| Session | Covers | Depth |
|---|---|---|
| a1 Prediction is half the question | What a forecast leaves undecided; the shape of a decision problem | ✓ |
| a2 The highest margin product nobody makes | Why ranking by margin misallocates capacity | ✓ |
| a3 What a constraint is worth | Shadow prices, and the validity range that makes or breaks the number | ✓ |
| a4 The plan that works on average | Monte Carlo against the deterministic promise | ✓ |
| a5 When optimisation beats a model | Choosing between prediction and prescription, honestly | ✓ |
| a6 Reading an optimisation you did not run | What to ask before acting on somebody's optimal plan | ✓ |
| Decision framing and options | Handed to `learn-decision-intelligence` | ◐ |

### Practitioner track

| Session | Covers | Depth |
|---|---|---|
| p1 Writing a problem down | Decision variables, objective, constraints | ✓ |
| p2 The feasible region | Geometry, vertices, why the optimum sits on a corner | ✓ |
| p3 Simplex, mechanically | Pivoting, slack variables, reading a tableau | ✓ |
| p4 Shadow prices and their range | The dual, and measuring where the rate stops holding | ✓ |
| p5 Integers change the answer | Branch and bound; rounding costs 60.00 and points the wrong way | ✓ |
| p6 Modelling choices that bite | Units, big-M, when a formulation is the bug | ✓ |
| p7 Monte Carlo over the plan | Uncertain inputs, percentiles, the 25% figure | ✓ |
| p8 Robust and stochastic, in outline | Planning for a distribution rather than a mean | ✓ |
| p9 The solver that was wrong twice | The silent negative-RHS fault, and the checker that was also wrong | ✓ |
| p10 The optimisation bench | Build, solve, round, branch, price, simulate, all live | ✓ |
| Posterior sampling | Pointed at `learn-bayesian` | ◐ |

## Not covered, by design

- **Prediction and model building.** This course starts after the forecast.
- **MCMC and posterior inference.** `learn-bayesian`.
- **Commercial solvers, their APIs and licensing.** They move faster than a course.
- **Nonlinear and convex optimisation beyond a named mention.**
- **Any claim that this instance has multiple optima.** It has one.

## Re-verify before delivery

The solver is deterministic and the Monte Carlo is seeded. If `opt-live.js` is edited, run
`selfTest()` first, then re-run the brute force cross-check over at least 1,000 generated
problems **with a box sized from the constraints**, and update every number here before touching
a page. **A solver passing three hand-checked cases is not a verified solver** - this one passed
all three while being wrong on roughly one problem in five.
