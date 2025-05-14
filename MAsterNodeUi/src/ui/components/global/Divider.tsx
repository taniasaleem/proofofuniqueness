import { JSX, CSSProperties } from "react";
import { colors } from "../../assets/colors";

interface props {
  sx?: CSSProperties;
}

export const HorizontalDivider = ({ sx }: props): JSX.Element => {
  return (
    <div
      style={{
        width: "100%",
        height: "1px",
        backgroundColor: colors.divider,
        ...sx,
      }}
    ></div>
  );
};

export const VerticalDivider = ({ sx }: props): JSX.Element => {
  return (
    <div
      style={{
        width: "1px",
        height: "100%",
        backgroundColor: colors.divider,
        ...sx,
      }}
    ></div>
  );
};
