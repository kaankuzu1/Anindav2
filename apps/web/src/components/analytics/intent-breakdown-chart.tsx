'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

interface ReplyBreakdown {
  intent: string;
  count: number;
  percentage: number;
}

interface IntentBreakdownChartProps {
  data: ReplyBreakdown[];
}

const intentColors: { [key: string]: string } = {
  interested: 'hsl(var(--stat-green))',
  meeting_request: 'hsl(142, 71%, 40%)',
  question: 'hsl(var(--stat-blue))',
  not_interested: 'hsl(0, 72%, 51%)',
  unsubscribe: 'hsl(38, 92%, 50%)',
  out_of_office: 'hsl(215, 15%, 60%)',
  auto_reply: 'hsl(215, 15%, 50%)',
  bounce: 'hsl(var(--stat-orange))',
  neutral: 'hsl(215, 15%, 55%)',
  unknown: 'hsl(215, 15%, 65%)',
};

export function IntentBreakdownChart({ data }: IntentBreakdownChartProps) {
  // Transform data for Recharts
  const chartData = data.map((entry) => ({
    intent: entry.intent.replace(/_/g, ' '),
    Count: entry.count,
    Percentage: entry.percentage,
  }));

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 5, right: 10, left: 0, bottom: 60 }}
          layout="horizontal"
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.3} />
          <XAxis
            dataKey="intent"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            tickLine={{ stroke: 'hsl(var(--border))' }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            tickLine={{ stroke: 'hsl(var(--border))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            label={{ value: 'Count', angle: -90, position: 'insideLeft', style: { fill: 'hsl(var(--muted-foreground))' } }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            }}
            labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600, textTransform: 'capitalize' }}
            itemStyle={{ color: 'hsl(var(--foreground))' }}
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
            formatter={(value: number, name: string, props: any) => {
              if (name === 'Count') {
                return [`${value} replies (${props.payload.Percentage}%)`, name];
              }
              return [value, name];
            }}
          />
          <Bar dataKey="Count" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => {
              const originalIntent = data[index].intent;
              const color = intentColors[originalIntent] || 'hsl(215, 15%, 65%)';
              return <Cell key={`cell-${index}`} fill={color} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
