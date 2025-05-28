import { useState, useEffect } from 'react';
import { AppLayout } from "../components/layout/AppLayout";
import { HorizontalDivider } from "../components/global/Divider";
import "../styles/pages/mynodes/overview.scss";
import { Blockchain, Node } from "./node-token-implementation";
import { useP2P } from '../hooks/useP2P';

export default function MyNode() {
  // Initialize blockchain and node (simulate single user node for this UI)
  const [node] = useState(() => new Node(new Blockchain()));
  const [creationDate, setCreationDate] = useState<string>("");
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [status, setStatus] = useState<string>("Pending");
  const [connectionStatus, setConnectionStatus] = useState<string>("Disconnected");
  const [region] = useState<string>("AWS: US-east-2");
  const [wallet, setWallet] = useState<string>("");
  const [tokenHash, setTokenHash] = useState<string>("-");

  // Use the token hash hook for real-time status
  const { isConnected, getTokenHashData } = useP2P();

  // Update connection status when P2P connection changes
  useEffect(() => {
    console.log('Connection status changed:', isConnected);
    setConnectionStatus(isConnected ? "Connected" : "Disconnected");
    setStatus(isConnected ? "Connected" : "Pending");
  }, [isConnected]);

  // Update token hash and node info when token data changes
  useEffect(() => {
    const serial = node.serialNumber;
    console.log('Checking token data for serial:', serial);
    const tokenData = getTokenHashData(serial);
    console.log('Token data:', tokenData);
    
    if (tokenData) {
      console.log('Updating UI with token data:', tokenData);
      setTokenHash(tokenData.hash);
      setCreationDate(new Date(tokenData.timestamp).toLocaleString());
      setLastUpdated(new Date().toLocaleString());
      setWallet(node.wallet.getPublicKey().slice(0, 12) + ".." + serial);
      setStatus(tokenData.verificationCount > 0 ? "Verified" : "Connected");
    }
  }, [node, getTokenHashData]);

  // Listen for token hash updates
  useEffect(() => {
    const handleTokenUpdate = () => {
      const serial = node.serialNumber;
      const tokenData = getTokenHashData(serial);
      if (tokenData) {
        console.log('Token update received:', tokenData);
        setTokenHash(tokenData.hash);
        setCreationDate(new Date(tokenData.timestamp).toLocaleString());
        setLastUpdated(new Date().toLocaleString());
        setStatus(tokenData.verificationCount > 0 ? "Verified" : "Connected");
      }
    };

    // Set up interval to check for updates
    const interval = setInterval(handleTokenUpdate, 1000);

    return () => clearInterval(interval);
  }, [node, getTokenHashData]);

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
            Node Token <span>{tokenHash}</span>
          </p>

          <p className="info_ctr">
            Node Size <span>{node.nodeType === "M" ? "Master" : "Small"}</span>
          </p>

          <p className="info_ctr">
            Node IP <span>-</span>
          </p>

          <p className="info_ctr">
            Status <span className={`status ${status.toLowerCase()}`}>{status}</span>
          </p>

          <p className="info_ctr">
            Connection Status <span className={`status ${connectionStatus.toLowerCase()}`}>{connectionStatus}</span>
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
