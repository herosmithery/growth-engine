'use client';

import { useState } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { TrendingUp, Calendar, BarChart3, PieChartIcon } from 'lucide-react';

// Color palette matching our med spa theme
const COLORS = {
  rose: '#D4A5A5',
  sage: '#9DB5B2',
  gold: '#C9A962',
  lavender: '#B8A9C9',
  primary: '#9B7E6B',
  success: '#7CB99E',
};

interface RevenueDataPoint {
  month: string;
  revenue: number;
  bookings: number;
  reactivations: number;
}

interface AgentPerformanceData {
  name: string;
  value: number;
  color: string;
}

// Revenue Trend Chart
interface RevenueTrendChartProps {
  data: RevenueDataPoint[];
  title?: string;
}

export function RevenueTrendChart({ data, title = 'Revenue Trend' }: RevenueTrendChartProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-[var(--border)] p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-[var(--foreground)]">{title}</h3>
          <p className="text-sm text-[var(--foreground-muted)]">Monthly revenue from all sources</p>
        </div>
        <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--success-light)] text-[var(--success)]">
          <TrendingUp className="w-4 h-4" />
          <span className="text-sm font-medium">+24%</span>
        </div>
      </div>

      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="reactivationGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.gold} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS.gold} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--foreground-muted)', fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--foreground-muted)', fontSize: 12 }}
              tickFormatter={(value) => `$${value / 1000}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke={COLORS.primary}
              strokeWidth={2}
              fill="url(#revenueGradient)"
              name="Total Revenue"
            />
            <Area
              type="monotone"
              dataKey="reactivations"
              stroke={COLORS.gold}
              strokeWidth={2}
              fill="url(#reactivationGradient)"
              name="From Reactivations"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-[var(--border-light)]">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.primary }} />
          <span className="text-sm text-[var(--foreground-muted)]">Total Revenue</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.gold }} />
          <span className="text-sm text-[var(--foreground-muted)]">From Reactivations</span>
        </div>
      </div>
    </div>
  );
}

// Agent Performance Comparison Chart
interface AgentComparisonChartProps {
  data: {
    aura: { calls: number; bookings: number; revenue: number };
    phoenix: { campaigns: number; reactivated: number; revenue: number };
    star: { requests: number; reviews: number; avgRating: number };
    sage: { followUps: number; converted: number; engagement: number };
  };
}

export function AgentComparisonChart({ data }: AgentComparisonChartProps) {
  const [activeMetric, setActiveMetric] = useState<'revenue' | 'conversions'>('revenue');

  const chartData = [
    {
      name: 'Aura',
      revenue: data.aura.revenue,
      conversions: data.aura.bookings,
      fill: COLORS.rose,
    },
    {
      name: 'Phoenix',
      revenue: data.phoenix.revenue,
      conversions: data.phoenix.reactivated,
      fill: COLORS.gold,
    },
    {
      name: 'Star',
      revenue: data.star.reviews * 50, // Estimated review value
      conversions: data.star.reviews,
      fill: COLORS.lavender,
    },
    {
      name: 'Sage',
      revenue: data.sage.converted * 250,
      conversions: data.sage.converted,
      fill: COLORS.sage,
    },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-[var(--border)] p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-[var(--foreground)]">Agent Performance</h3>
          <p className="text-sm text-[var(--foreground-muted)]">Compare AI agent contributions</p>
        </div>
        <div className="flex items-center gap-1 p-1 bg-[var(--background-secondary)] rounded-lg">
          <button
            onClick={() => setActiveMetric('revenue')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${activeMetric === 'revenue'
              ? 'bg-white text-[var(--foreground)] shadow-sm'
              : 'text-[var(--foreground-muted)]'
              }`}
          >
            Revenue
          </button>
          <button
            onClick={() => setActiveMetric('conversions')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${activeMetric === 'conversions'
              ? 'bg-white text-[var(--foreground)] shadow-sm'
              : 'text-[var(--foreground-muted)]'
              }`}
          >
            Conversions
          </button>
        </div>
      </div>

      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--foreground-muted)', fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--foreground-muted)', fontSize: 12 }}
              tickFormatter={(value) =>
                activeMetric === 'revenue' ? `$${value / 1000}k` : value.toString()
              }
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey={activeMetric}
              radius={[8, 8, 0, 0]}
              maxBarSize={60}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Conversion Funnel / Pie Chart
interface ConversionBreakdownProps {
  data: {
    calls: number;
    appointments: number;
    completed: number;
    reviews: number;
  };
}

export function ConversionBreakdown({ data }: ConversionBreakdownProps) {
  const pieData = [
    { name: 'Calls Handled', value: data.calls, color: COLORS.rose },
    { name: 'Appointments Booked', value: data.appointments, color: COLORS.sage },
    { name: 'Treatments Completed', value: data.completed, color: COLORS.gold },
    { name: 'Reviews Collected', value: data.reviews, color: COLORS.lavender },
  ];

  const totalValue = pieData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-[var(--border)] p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-[var(--foreground)]">Activity Breakdown</h3>
          <p className="text-sm text-[var(--foreground-muted)]">This month's activity distribution</p>
        </div>
        <PieChartIcon className="w-5 h-5 text-[var(--foreground-muted)]" />
      </div>

      <div className="flex items-center gap-6">
        <div className="w-[180px] h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex-1 space-y-3">
          {pieData.map((item) => (
            <div key={item.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-[var(--foreground-muted)]">{item.name}</span>
              </div>
              <div className="text-right">
                <span className="font-semibold text-[var(--foreground)]">{item.value}</span>
                <span className="text-xs text-[var(--foreground-muted)] ml-1">
                  ({((item.value / totalValue) * 100).toFixed(0)}%)
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Hours Saved Over Time
interface HoursSavedChartProps {
  data: { week: string; hours: number; value: number }[];
}

export function HoursSavedChart({ data }: HoursSavedChartProps) {
  const totalHours = data.reduce((sum, d) => sum + d.hours, 0);
  const totalValue = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-[var(--border)] p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-[var(--foreground)]">Hours Saved</h3>
          <p className="text-sm text-[var(--foreground-muted)]">
            {totalHours}h saved = ${totalValue.toLocaleString()} in labor
          </p>
        </div>
        <Calendar className="w-5 h-5 text-[var(--foreground-muted)]" />
      </div>

      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="week"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--foreground-muted)', fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--foreground-muted)', fontSize: 12 }}
              tickFormatter={(value) => `${value}h`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="hours"
              stroke={COLORS.sage}
              strokeWidth={3}
              dot={{ fill: COLORS.sage, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: COLORS.sage }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Custom Tooltip Component
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-[var(--border)] p-3">
      <p className="text-sm font-medium text-[var(--foreground)] mb-2">{label}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-[var(--foreground-muted)]">{entry.name}:</span>
          <span className="font-medium text-[var(--foreground)]">
            {typeof entry.value === 'number' && entry.dataKey?.includes('revenue')
              ? `$${entry.value.toLocaleString()}`
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0];
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-[var(--border)] p-3">
      <div className="flex items-center gap-2">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: data.payload.color }}
        />
        <span className="text-sm font-medium text-[var(--foreground)]">
          {data.name}: {data.value}
        </span>
      </div>
    </div>
  );
}

// Export all chart types
export { COLORS as ChartColors };
