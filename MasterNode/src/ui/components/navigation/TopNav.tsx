import { JSX } from "react";
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
        <div className="actions">
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
