// Goal metrics that can be targeted from the Settings page. Client-safe (no fs).
export type GoalMetric = {
  key: string; // storage key in goals.json
  label: string;
  unit: "count" | "rate";
  suffix: string; // shown next to the input/value
  hint: string;
  upIsGood: boolean; // true = higher is better (churn is false)
};

export const GOAL_METRICS: GoalMetric[] = [
  { key: "signups", label: "Signups", unit: "count", suffix: "/period", hint: "Target new signups per period", upIsGood: true },
  { key: "activation", label: "Activation rate", unit: "rate", suffix: "%", hint: "Target % of orgs activated", upIsGood: true },
  { key: "conversion", label: "Paid conversion", unit: "rate", suffix: "%", hint: "Target % paid within 30d", upIsGood: true },
  { key: "churn", label: "Churn", unit: "count", suffix: "/period", hint: "Max cancellations per period (lower is better)", upIsGood: false },
  { key: "visitors", label: "Web visitors", unit: "count", suffix: "/period", hint: "Target unique visitors per period", upIsGood: true },
];

export type Goals = Record<string, number>;
export const GOAL_KEYS = GOAL_METRICS.map((m) => m.key);
