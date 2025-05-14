import { JSX } from "react";
import { NavLink } from "react-router";
import { Link } from "../../assets/icons/actions";
import { LinkedIn, Telegram, XTwitter } from "../../assets/icons/social";
import "../../styles/components/naigation/topnav.scss";

export const TopNav = (): JSX.Element => {
  return (
    <div className="topnav">
      <div className="node_man_title">
        <p>Proof Of Uniqueness</p>
      </div>

      <div className="links_actions">
        <div className="links">
          {navLinks.map((_link, index) => (
            <NavLink key={index} to={_link.path}>
              {_link.title}
            </NavLink>
          ))}
        </div>

        <div className="actions">
          {/* <button className="logout">Log Out</button> */}

          <button className="_action">
            <Link />
          </button>

          <button className="_action">
            <XTwitter />
          </button>

          <button className="_action">
            <Telegram />
          </button>

          <button className="_action">
            <LinkedIn />
          </button>
        </div>
      </div>
    </div>
  );
};

type link = {
  path: string;
  title: string;
};

const navLinks: link[] = [
  { path: "/", title: "Dashboard" },
  { path: "/my-node", title: "My Node" },
  { path: "/my-wallets", title: "My Wallets" },
  { path: "/my-node/settings", title: "Settings" },
];
