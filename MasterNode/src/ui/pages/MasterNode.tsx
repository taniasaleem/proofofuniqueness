import { JSX } from "react";
import { useQuery } from "@tanstack/react-query";
// import { useAppDrawer } from "../hooks/drawer";
import { getAllNodes, nodetype } from "../utils/api/masternode";
import { AppLayout } from "../components/layout/AppLayout";
import "../styles/pages/masternode/nodes.scss";

export default function MasterNode(): JSX.Element {
  const { data: allnodes } = useQuery({
    queryKey: ["allnodes"],
    queryFn: getAllNodes,
  });

  return (
    <AppLayout>
      <section id="masternode">
        <p className="title">Nodes</p>

        <NodesCtr nodes={allnodes || []} />
      </section>
    </AppLayout>
  );
}

const NodesCtr = ({ nodes }: { nodes: nodetype[] }): JSX.Element => {
  // const { openAppDrawer } = useAppDrawer();

  return (
    <table className="nodes_ctr">
      <tbody>
        <tr>
          <th>IP Address</th>
          <th>Timestamp</th>
          <th>Wallet</th>
        </tr>

        {nodes?.map((wallet, index) => (
          <tr
            className="table_row"
            key={index}
            // onClick={() => openAppDrawer("nodeinfo")}
          >
            <td id="walletname">{wallet?.address}</td>
            <td id="network">{wallet?.timestamp}</td>
            <td id="network">
              {wallet?.wallet?.address?.substring(0, 16) + "..."}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
