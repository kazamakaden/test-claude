"use client";

import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { ChartFrame, chartAxisProps, chartGridProps, chartTooltipStyle } from "@/components/charts/chart-frame";
import type { DepartmentStat } from "@/types/dashboard";

export function DepartmentBarChart({ stats }: { stats: DepartmentStat[] }) {
  return (
    <ChartFrame>
      <BarChart data={stats} layout="vertical" margin={{ left: 8 }}>
        <CartesianGrid {...chartGridProps} horizontal={false} />
        <XAxis type="number" {...chartAxisProps} />
        <YAxis type="category" dataKey="department" width={80} {...chartAxisProps} />
        <Tooltip contentStyle={chartTooltipStyle} />
        <Bar dataKey="memberCount" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ChartFrame>
  );
}
