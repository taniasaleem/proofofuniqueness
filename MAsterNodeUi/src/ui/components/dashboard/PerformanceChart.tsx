import { JSX } from "react";
import { BarChart, Bar, XAxis, ResponsiveContainer } from "recharts";
import { colors } from "../../assets/colors";

const data = [
  { day: "Mon", value: 80 },
  { day: "Tue", value: 60 },
  { day: "Wed", value: 50 },
  { day: "Thu", value: 70 },
  { day: "Fri", value: 80 },
];

export const PerformanceChart = (): JSX.Element => {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <XAxis
          dataKey="day"
          axisLine={false}
          tick={{
            fill: colors.textsecondary,
            fontSize: "0.875rem",
            fontWeight: "bold",
          }}
        />
        <Bar
          dataKey="value"
          fill={colors.divider}
          barSize={30}
          radius={[0, 0, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};
