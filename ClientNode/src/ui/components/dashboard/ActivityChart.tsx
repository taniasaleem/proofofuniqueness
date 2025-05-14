import { JSX } from "react";
import { LineChart, Line, XAxis, ResponsiveContainer } from "recharts";
import { colors } from "../../assets/colors";

const data = [
  { time: "00:00", value: 50 },
  { time: "03:00", value: 40 },
  { time: "06:00", value: 45 },
  { time: "09:00", value: 35 },
  { time: "12:00", value: 60 },
  { time: "15:00", value: 40 },
  { time: "18:00", value: 55 },
];

export const ActivityChart = (): JSX.Element => {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={colors.textsecondary}
          strokeWidth={4}
          dot={false}
        />
        <XAxis
          dataKey="time"
          axisLine={false}
          tick={{
            fill: colors.textsecondary,
            fontSize: "0.875rem",
            fontWeight: "bold",
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};
