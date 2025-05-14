import { JSX, ReactNode } from "react";
import { TopNav } from "../navigation/TopNav";
import { SideNav } from "../navigation/SideNav";
import "../../styles/components/layout/applayout.scss";

interface props {
  children: ReactNode;
}

export const AppLayout = ({ children }: props): JSX.Element => {
  return (
    <section id="applayout">
      <TopNav />

      <SideNav />

      <div className="pagewithsidenav">
        <section id="content">{children}</section>
      </div>
    </section>
  );
};
