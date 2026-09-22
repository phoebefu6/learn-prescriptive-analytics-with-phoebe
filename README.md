# Learn Prescriptive Analytics with Phoebe

**Prediction is half the question.** Sixteen 45-minute sessions on choosing what to do, not just
forecasting what will happen: linear and integer programming, shadow prices and the range they
hold over, and Monte Carlo over the plan.

Live: https://phoebefu6.github.io/learn-prescriptive-analytics-with-phoebe/

Ravensworth Mills makes three feeds. Show earns 71 a tonne, nearly double Standard at 38, so the
obvious move is to make more Show. The optimal plan makes none of it, because Show eats 2.3
milling hours a tonne against Standard's 1.1. The mill is not allocating margin, it is allocating
hours.

## Two tracks

**Leader, six sessions, no code.** Why the obvious allocation is usually wrong, what a constraint
is worth and for how long, what "optimal" quietly assumed, when optimisation beats a model, and
five questions for a plan you did not produce.

**Practitioner, ten sessions, hands on.** Writing the problem down, the feasible region, simplex,
shadow prices and their range, integers, formulation traps, Monte Carlo, robust planning, a
solver that was wrong twice, and a capstone bench.

## The solver is real, and it was wrong twice before it was right

`assets/opt-live.js` implements the simplex method, branch and bound over the LP relaxation, and
a Monte Carlo driver. It carries three problems whose optima can be checked by hand and runs them
on load.

**Passing those three was not enough.** A brute-force cross-check over 1,100 generated problems
found two faults, in opposite directions:

1. **The solver understated optima.** Branch and bound expressed a lower bound `x >= 5` as a row
   `-x <= -5`, which carries a negative right hand side. This simplex refuses those, and the
   refusal was silent, so every round-up branch died and the search only ever explored downward.
2. **Then the checker was the one at fault.** After the fix the solver appeared to overstate. It
   was right: the brute force capped every variable at 12, so genuine optima sat outside its
   search box.

A wrong solver and a wrong verifier, failing in opposite directions, both returning confident
numbers, neither visible from reading the code. **After both fixes, 1,100 of 1,100 agree across
five seeds.** Practitioner session 9 tells that story, because it is the subject of the course
happening to the course.

## What the numbers say

- **The highest margin product is never made.** Show at 71 a tonne appears in no optimal plan.
- **Rounding costs 60.00 and points the wrong way.** The continuous answer says 30.69 Standard,
  so rounding gives 30. The true integer optimum is 33.
- **A shadow price expires.** Milling capacity is worth 33.7931 an hour, but only up to about
  +0.46 hours. Buying 10 more looks like 337.93 and actually returns 206.44, overstating by 1.64
  times.
- **A constraint that is not binding is worth exactly nothing.** Blending hours have a shadow
  price of 0.
- **The optimal plan under-delivers.** It promises 4,656; across five seeds it averages 4,318 to
  4,331 and meets demand in full only about a quarter of the time.

One claim this course refuses to make: the base problem has **exactly one** optimal integer plan,
so nothing here implies alternative optima.

## Running it

No build step. Any static server:

```
python3 -m http.server 8720
```

Then open http://localhost:8720/

## Credits

by Phoebe Fu. Part of [Learn with Phoebe](https://phoebefu6.github.io/learn-with-phoebe/).

Framing the decision itself lives in
[learn decision intelligence](https://phoebefu6.github.io/learn-decision-intelligence-with-phoebe/),
and posterior sampling in
[learn bayesian](https://phoebefu6.github.io/learn-bayesian-with-phoebe/).
