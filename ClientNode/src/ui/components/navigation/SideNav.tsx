import { Fragment, JSX, ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import { Dashboard, MyNode, MyWallets } from "../../assets/icons/navigation";
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
            DAI Node Manager <span>Decentralized Artificial Intelligence</span>
          </p>
        </div>

        <div className="navlinks">
          {navLinks.map((_link, index) => (
            <Fragment key={index}>
              <NavLink
                to={_link.path}
                className={pathname === _link.path ? "currpage" : ""}
              >
                {_link.icon} {_link.title}
              </NavLink>

              {index == 1 && (pathname.includes("/my-node") || pathname.includes("/node-manager")) && (
                <div className="sublinks">
                  {mynodeSubLinks.map((sub_link, index) => (
                    <button
                      className={
                        pathname.includes(String(sub_link.path))
                          ? "currsublink"
                          : ""
                      }
                      key={index + String(sub_link.path)}
                      onClick={() => navigate(`/${sub_link.path}`)}
                    >
                      {sub_link.title}
                    </button>
                  ))}
                </div>
              )}

              {index == 2 && pathname.includes("/my-wallets") && (
                <div className="sublinks">
                  {mywalletSubLinks.map((sub_link, index) => (
                    <button
                      className={
                        pathname.includes(String(sub_link.path))
                          ? "currsublink"
                          : ""
                      }
                      key={index + String(sub_link.path)}
                      onClick={() => navigate(`/${sub_link.path}`)}
                    >
                      {sub_link.title}
                    </button>
                  ))}
                </div>
              )}
            </Fragment>
          ))}
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

const navLinks: link[] = [
  { path: "/", title: "Dashboard", icon: <Dashboard /> },
  { path: "/my-node/create-token", title: "My Node", icon: <MyNode /> },
  { path: "/my-wallets", title: "My Wallets", icon: <MyWallets /> },
];

const mynodeSubLinks: Partial<link>[] = [
  { path: "my-node", title: "Create Token" },
  { path: "my-node/network-activity", title: "Network Activity" },
  { path: "my-node/verify", title: "Verify Hashes" },
  { path: "my-node/messages", title: "Messages" },
  { path: "my-node/ledgers", title: "Ledgers" },
  { path: "my-node/settings", title: "Settings" },
];

const mywalletSubLinks: Partial<link>[] = [
  { path: "my-wallets", title: "Overview" },
  { path: "my-wallets/create", title: "Create a new wallet" },
  { path: "my-wallets/ledgers", title: "Ledgers" },
];
