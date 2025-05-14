import { JSX, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import nodes from "../../assets/images/icons/nodes.png";
import "../../styles/components/naigation/sidenav.scss";

export const SideNav = (): JSX.Element => {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <div className="sidenav">
      <div className="layer">
        <div className="_dai">
          <img src={nodes} alt="nodes" />
          <p>
            DAI Master Node Manager
            <span>Decentralized Artificial Intelligence</span>
          </p>
        </div>

        <div className="navlinks">
          <div className="sublinks">
            {masternodeSubLinks.map((sub_link, index) => (
              <button
                className={
                  pathname.includes(String(sub_link.path)) ? "currsublink" : ""
                }
                key={index + String(sub_link.path)}
                onClick={() => navigate(`/${sub_link.path}`)}
              >
                {sub_link.title}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

type link = {
  path: string;
  title: string;
  icon: ReactNode;
};

const masternodeSubLinks: Partial<link>[] = [
  { path: "", title: "Nodes" },
  { path: "node-manager", title: "Node Manager" },
  { path: "master-node/upload", title: "Sync" },
  { path: "master-node/messages", title: "Messages" },
  { path: "master-node/treasury", title: "Treasury Wallet" },
  { path: "master-node/settings", title: "Settings" },
];
