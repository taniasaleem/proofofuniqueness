import { JSX } from "react";
import { useQuery } from "@tanstack/react-query";
// import { useAppDrawer } from "../hooks/drawer";
import { getAllNodes, nodetype, NodesResponse } from "../utils/api/masternode";
// import { nodetype } from "../utils/api/masternode";
import { AppLayout } from "../components/layout/AppLayout";
import "../styles/pages/masternode/nodes.scss";

export default function MasterNode(): JSX.Element {
  console.log("MasterNode calling getAllNodes");
  const { data: response } = useQuery<NodesResponse>({
    queryKey: ["allnodes"],
    queryFn: getAllNodes,
  });
  

  return (
    <AppLayout>
      <section id="masternode">
        <p className="title">Nodes</p>

        <NodesCtr nodes={response?.data.peers || []} />
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

        {nodes?.map((node, index) => (
          <tr className="table_row" key={index}>
            <td id="walletname">
              {node.addresses?.[0]?.split('/')[2] || 'Unknown'}
            </td>
            <td id="network">
              {new Date().toLocaleString()}
            </td>
            <td id="network">
              {node.wallet?.address 
                ? `${node.wallet.address.substring(0, 16)}...`
                : 'Not Found'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
