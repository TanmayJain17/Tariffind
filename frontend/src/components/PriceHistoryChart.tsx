import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, Area, CartesianGrid,
} from "recharts";
import type { PriceHistoryData } from "@/types/tariff";

interface Props {
  data: PriceHistoryData;
}

export function PriceHistoryChart({ data }: Props) {
  const timeline = data.timeline.map((entry) => ({
    ...entry,
    prePrice: data.estimated_pre_tariff_price,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={timeline} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey="date"
          tick={{ fill: "#8888A0", fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: "rgba(255,255,255,0.07)" }}
        />
        <YAxis
          tick={{ fill: "#8888A0", fontSize: 11, fontFamily: "JetBrains Mono" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `$${v}`}
          domain={["auto", "auto"]}
        />
        <Tooltip
          contentStyle={{
            background: "rgba(19,19,26,0.95)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 12,
            color: "#F0F0F5",
            fontSize: 12,
          }}
          formatter={(value: number) => [`$${value.toFixed(2)}`, "Price"]}
          labelFormatter={(label: string) => label}
        />
        <defs>
          <linearGradient id="tariffArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#FF4D00" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#FF4D00" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="estimated_price"
          stroke="none"
          fill="url(#tariffArea)"
        />
        <Line
          type="monotone"
          dataKey="prePrice"
          stroke="#00C896"
          strokeDasharray="5 5"
          strokeWidth={1.5}
          dot={false}
          name="Pre-tariff baseline"
        />
        <Line
          type="monotone"
          dataKey="estimated_price"
          stroke="#FF4D00"
          strokeWidth={2}
          dot={{ fill: "#FF4D00", r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "#FF4D00" }}
          name="Estimated price"
        />
        {/* Annotate tariff events */}
        {timeline
          .filter((e) => e.event && e.tariff_impact)
          .slice(0, 4)
          .map((entry, i) => (
            <ReferenceLine
              key={i}
              x={entry.date}
              stroke="rgba(255,255,255,0.15)"
              strokeDasharray="3 3"
              label={{
                value: "",
                position: "top",
              }}
            />
          ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
