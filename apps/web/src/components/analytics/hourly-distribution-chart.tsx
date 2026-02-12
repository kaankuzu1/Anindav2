'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface HourlyData {
  hour: number;
  sent: number;
  opened: number;
  replied: number;
}

interface HourlyDistributionChartProps {
  data: HourlyData[];
}

export function HourlyDistributionChart({ data }: HourlyDistributionChartProps) {
  // Transform data for Recharts
  const chartData = data.map((entry) => ({
    hour: `${entry.hour.toString().padStart(2, '0')}:00`,
    Sent: entry.sent,
    Opened: entry.opened,
    Replied: entry.replied,
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.3} />
          <XAxis
            dataKey="hour"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            tickLine={{ stroke: 'hsl(var(--border))' }}
            interval={2}
          />
          <YAxis
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            tickLine={{ stroke: 'hsl(var(--border))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            }}
            labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
            itemStyle={{ color: 'hsl(var(--foreground))' }}
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
          />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="circle"
            formatter={(value) => (
              <span style={{ color: 'hsl(var(--muted-foreground))' }}>{value}</span>
            )}
          />
          <Bar dataKey="Sent" fill="hsl(var(--stat-blue))" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Opened" fill="hsl(var(--stat-green))" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Replied" fill="hsl(var(--stat-purple))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
