import { JSX } from "react";

interface props {
  title: string;
  value: string | number;
}

export const NodeStatus = ({ title, value }: props): JSX.Element => {
  return (
    <div className="stat">
      <span>{title}</span>
      <p>{value}</p>
    </div>
  );
};
