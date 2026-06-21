// Goal metrics that can be targeted from the Settings page. Client-safe (no fs).

// The cadence every COUNT goal (visitors / signups / churn) is expressed in.
// Onboarding sets this to however the team plans — "month" by default, "quarter"
// for OKR-style teams. It drives the goal labels (e.g. "/quarter") and how the
// dashed goal line scales to the chart's Group-by grain. Rate goals (activation /
// conversion %) are cadence-independent, so they ignore it.
export type Cadence = "week" | "month" | "quarter";
export const GOAL_CADENCE: Cadence = "month";

export type GoalMetric = {
  key: string; // storage key in goals.json
  label: string;
  unit: "count" | "rate";
  suffix: string; // shown next to the input/value
  hint: string;
  upIsGood: boolean; // true = higher is better (churn is false)
};

const per = `/${GOAL_CADENCE}`;

export const GOAL_METRICS: GoalMetric[] = [
  { key: "visitors", label: "Web visitors", unit: "count", suffix: per, hint: `Target unique visitors per ${GOAL_CADENCE}`, upIsGood: true },
  { key: "signups", label: "Signups", unit: "count", suffix: per, hint: `Target new signups per ${GOAL_CADENCE}`, upIsGood: true },
  { key: "activation", label: "Activation rate", unit: "rate", suffix: "%", hint: "Target % of orgs activated", upIsGood: true },
  { key: "conversion", label: "Paid conversion", unit: "rate", suffix: "%", hint: "Target % paid within 30d", upIsGood: true },
  { key: "churn", label: "Churn", unit: "count", suffix: per, hint: `Max cancellations per ${GOAL_CADENCE} (lower is better)`, upIsGood: false },
];

export type Goals = Record<string, number>;
export const GOAL_KEYS = GOAL_METRICS.map((m) => m.key);

// Convert a per-cadence COUNT goal into the chart's current bucket (grain) so the
// dashed goal line is meaningful whether you Group-by Month or Week. Approximate
// (52/12 weeks per month, 13 per quarter). Rate goals don't use this.
const WEEKS_PER: Record<Cadence, number> = { week: 1, month: 52 / 12, quarter: 13 };
const MONTHS_PER: Record<Cadence, number> = { week: 12 / 52, month: 1, quarter: 3 };

export function scaleGoalToGrain(value: number, grain: "month" | "week"): number {
  const div = grain === "week" ? WEEKS_PER[GOAL_CADENCE] : MONTHS_PER[GOAL_CADENCE];
  return value / div;
}
