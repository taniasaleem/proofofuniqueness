import { JSX } from "react";
import { useQuery } from "@tanstack/react-query";
import { getWallets, wallettype } from "../utils/api/wallet";
import { AppLayout } from "../components/layout/AppLayout";
import "../styles/pages/mywallets/overview.scss";

export default function MyWallets(): JSX.Element {
  const { data: wallets } = useQuery({
    queryKey: ["allwallets"],
    queryFn: getWallets,
  });

  return (
    <AppLayout>
      <section id="mywallets">
        <p className="title">Wallets</p>

        <WalletsCtr wallets={wallets?.wallets || []} />
      </section>
    </AppLayout>
  );
}

const WalletsCtr = ({ wallets }: { wallets: wallettype[] }): JSX.Element => {
  return (
    <table className="wallet_ctr">
      <tbody>
        <tr>
          <th>Address</th>
          <th>Balance</th>
          <th>Nonce</th>
        </tr>

        {wallets?.map((wallet, index) => (
          <tr key={index} onClick={() => console.log("hello there" + index)}>
            <td id="address">{wallet?.address?.substring(0, 15) + "..."}</td>
            <td id="balance">{wallet?.balance}</td>
            <td id="datetime">{wallet?.nonce}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
