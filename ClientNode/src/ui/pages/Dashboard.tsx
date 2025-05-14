import { JSX } from "react";
import { useQuery } from "@tanstack/react-query";
import { getChainInfo, getChainSupplyInfo } from "../utils/api/chain";
import { getWallets } from "../utils/api/wallet";
import { AppLayout } from "../components/layout/AppLayout";
import { NodeStatus } from "../components/dashboard/NodeStatus";
import { ActivityChart } from "../components/dashboard/ActivityChart";
import { PerformanceChart } from "../components/dashboard/PerformanceChart";
import { WebSocketConnection } from "../components/WebSocketConnection";
import "../styles/pages/dashboard.scss";

export default function Dashboard(): JSX.Element {
  const { data: chainInfo } = useQuery({
    queryKey: ["chaininfo"],
    queryFn: getChainInfo,
  });
  const { data: chainsupply } = useQuery({
    queryKey: ["chainsupply"],
    queryFn: getChainSupplyInfo,
  });
  const { data: wallets } = useQuery({
    queryKey: ["allwallets"],
    queryFn: getWallets,
  });

  return (
    <AppLayout>
      <section id="dashboard">
        <p className="_title">
          Welcome to DAI Node Manager
          <span>
            Manage your blockchain node, connect to the network and start
            mining.
          </span>
        </p>

        <WebSocketConnection />

        <div className="stats">
          <NodeStatus title="Node Status" value="Soft Node Running" />
          <NodeStatus title="Connected Peers" value={chainInfo?.peers || 0} />
          <NodeStatus title="Mining Status" value="Active" />
        </div>

        <div className="network_activity_performance">
          <div className="network_activity">
            <p className="activity_title">
              <span className="activity_desc">Number Of Nodes</span>
              {Number(chainInfo?.peers) + 1 || 0}
              <span className="time_change">Last 7 days +10%</span>
            </p>

            <ActivityChart />
          </div>

          <div className="_performance">
            <p className="activity_title">
              <span className="activity_desc">Number Of Transactions</span>
              50 Coins/Day
              <span className="time_change">Last 7 days +5%</span>
            </p>

            <PerformanceChart />
          </div>

          <div className="network_activity">
            <p className="activity_title">
              <span className="activity_desc">Soft Node Rewards</span>
              {chainsupply?.blockReward || 0}
              <span className="time_change">Last 7 days +10%</span>
            </p>

            <ActivityChart />
          </div>
        </div>

        <div className="network_activity_performance">
          <div className="network_activity">
            <p className="activity_title">
              <span className="activity_desc">Number Of Wallets</span>
              {wallets?.count || 0}
              <span className="time_change">Last 7 days +10%</span>
            </p>

            <ActivityChart />
          </div>

          <div className="_performance">
            <p className="activity_title">
              <span className="activity_desc">Circulating Supply</span>
              {chainInfo?.currentSupply || 0} Coins
              <span className="time_change">Last 7 days +5%</span>
            </p>

            <PerformanceChart />
          </div>

          <div className="network_activity">
            <p className="activity_title">
              <span className="activity_desc">Full Node Rewards</span>
              {chainsupply?.blockReward || 0}
              <span className="time_change">Last 7 days +10%</span>
            </p>

            <ActivityChart />
          </div>
        </div>
      </section>
    </AppLayout>
  );
}
