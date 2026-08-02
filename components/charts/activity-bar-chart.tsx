"use client";

import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";
import { ChartFrame, chartAxisProps, chartGridProps, chartTooltipStyle } from "@/components/charts/chart-frame";
import type { ActivityStat } from "@/types/dashboard";

export function ActivityBarChart({
  stats,
  labels,
}: {
  stats: ActivityStat[];
  labels: { attendance: string; completed: string; pending: string };
}) {
  return (
    <ChartFrame>
      <BarChart data={stats}>
        <CartesianGrid {...chartGridProps} />
        <XAxis dataKey="month" {...chartAxisProps} />
        <YAxis {...chartAxisProps} />
        <Tooltip contentStyle={chartTooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="attendance" name={labels.attendance} fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="completed" name={labels.completed} fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="pending" name={labels.pending} fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartFrame>
  );
}
