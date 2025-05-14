import { JSX } from "react";
import { useQuery } from "@tanstack/react-query";
import { getWallets } from "../../utils/api/wallet";
import { AppLayout } from "../../components/layout/AppLayout";
import { HorizontalDivider } from "../../components/global/Divider";
import "../../styles/pages/masternode/settings.scss";

export default function TreasuryWallet(): JSX.Element {
  const { data: allwallets } = useQuery({
    queryKey: ["wallets"],
    queryFn: getWallets,
  });

  const treasurywallet = allwallets?.wallets?.find(
    (_wallet) =>
      _wallet?.address ===
      "04c839804680e1743ccf21c9c68887330d58f41821ff7d4378c5a4c33f061bfe2ddd11b4d17bbf2e3344c83b789540c7d4af9edb251168eddcfb6706f0d11ee020"
  );

  return (
    <AppLayout>
      <section id="masternodesettings">
        <div className="content_ctr">
          <p className="title">Treasury Wallet</p>

          <HorizontalDivider sx={{ marginTop: "1rem" }} />

          <div className="settings">
            <SettingsCtr
              label="Balance"
              value={treasurywallet?.balance?.toFixed(2) || "- - -"}
            />
            <SettingsCtr label="Nonce" value={treasurywallet?.nonce || 0} />
          </div>
        </div>
      </section>
    </AppLayout>
  );
}

const SettingsCtr = ({
  label,
  value,
}: {
  label: string;
  value: number | string;
}): JSX.Element => {
  return (
    <p>
      {label} <span>{value}</span>
    </p>
  );
};
