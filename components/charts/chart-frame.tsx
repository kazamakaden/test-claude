"use client";

import { ResponsiveContainer } from "recharts";
import type { ReactElement } from "react";

export const chartTooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  color: "var(--card-foreground)",
};

export const chartAxisProps = {
  stroke: "var(--muted-foreground)",
  fontSize: 12,
};

export const chartGridProps = {
  strokeDasharray: "3 3",
  stroke: "var(--border)",
};

export function ChartFrame({ children }: { children: ReactElement }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}
