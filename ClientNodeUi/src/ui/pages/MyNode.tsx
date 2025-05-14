import { JSX, useEffect, useState } from "react";
import { AppLayout } from "../components/layout/AppLayout";
import { HorizontalDivider } from "../components/global/Divider";
import "../styles/pages/mynodes/overview.scss";
import { Blockchain, Node, NodeToken } from "./node-token-implementation";
import { useTokenHash } from "../../../../MAsterNodeUi/src/ui/hooks/useTokenHash";

export default function MyNode(): JSX.Element {
  // Initialize blockchain and node (simulate single user node for this UI)
  const [node] = useState(() => new Node(new Blockchain()));
  const [nodeToken, setNodeToken] = useState<NodeToken | null>(null);
  const [creationDate, setCreationDate] = useState<string>("");
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [status, setStatus] = useState<string>("Started");
  const [connectionStatus, setConnectionStatus] = useState<string>("Disconnected");
  const [region] = useState<string>("AWS: US-east-2");
  const [wallet, setWallet] = useState<string>("");

  // Use the token hash hook for real-time status
  const {
    getTokenHashData,
    getTokenHash,
    isConnected,
    status: wsStatus,
    processMessages
  } = useTokenHash();

  useEffect(() => {
    processMessages();
    const serial = node.serialNumber;
    
    // Get token data from master node
    getTokenHash(serial);
    
    // Update UI with token data
    const tokenData = getTokenHashData(serial);
    if (tokenData) {
      setCreationDate(new Date(tokenData.timestamp).toLocaleString());
      setLastUpdated(new Date().toLocaleString());
      setWallet(node.wallet.getPublicKey().slice(0, 12) + ".." + serial);
      setStatus(tokenData.verificationCount > 0 ? "Started" : "Pending");
    }
    
    setConnectionStatus(isConnected ? "Connected" : "Disconnected");
  }, [node, isConnected, processMessages, getTokenHash, getTokenHashData]);

  return (
    <AppLayout>
      <section id="mynode_overview">
        <div className="content_ctr nodeinfo">
          <p className="title">Node Information</p>
          <HorizontalDivider />

          <p className="info_ctr">
            Node Serial # <span>{node.serialNumber}</span>
          </p>

          <p className="info_ctr">
            Node Token <span>{getTokenHashData(node.serialNumber)?.hash || "-"}</span>
          </p>

          <p className="info_ctr">
            Node Size <span>{node.nodeType === "M" ? "Master" : "Small"}</span>
          </p>

          <p className="info_ctr">
            Node IP <span>-</span>
          </p>

          <p className="info_ctr">
            Status <span className="status">{status}</span>
          </p>

          <p className="info_ctr">
            Connection Status <span className="status">{connectionStatus}</span>
          </p>

          <p className="info_ctr">
            Region <span>{region}</span>
          </p>

          <p className="info_ctr">
            Creation date <span>{creationDate}</span>
          </p>

          <p className="info_ctr">
            Last updated date
            <span>{lastUpdated}</span>
          </p>

          <p className="info_ctr final">
            Associated wallet
            <span>{wallet}</span>
          </p>
        </div>

        <div className="content_ctr messages">
          <p className="title">Messages</p>
          <HorizontalDivider />
        </div>
      </section>
    </AppLayout>
  );
}
