import { JSX } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getChainInfo, getChainSupplyInfo } from "../../utils/api/chain";
import { AppLayout } from "../../components/layout/AppLayout";
import { HorizontalDivider } from "../../components/global/Divider";
import { SubmitButton } from "../../components/global/Buttons";
import "../../styles/pages/masternode/settings.scss";

export default function MasterNodeSettings(): JSX.Element {
  const queryclient = useQueryClient();

  const { data: chainInfo } = useQuery({
    queryKey: ["chaininfo"],
    queryFn: getChainInfo,
  });
  const { data: chainsupply, isFetching } = useQuery({
    queryKey: ["chainsupply"],
    queryFn: getChainSupplyInfo,
  });

  const onUpdate = () => {
    queryclient.invalidateQueries({ queryKey: ["chainsupply"] });
  };

  return (
    <AppLayout>
      <section id="masternodesettings">
        <div className="content_ctr">
          <p className="title">Network</p>

          <HorizontalDivider sx={{ marginTop: "1rem" }} />

          <div className="settings">
            <SettingsCtr
              label="Total Supply"
              value={chainsupply?.currentSupply || 0}
            />
            <SettingsCtr
              label="Block Reward"
              value={chainsupply?.blockReward || 0}
            />
            <SettingsCtr
              label="Soft node reward"
              value={chainsupply?.blockReward || 0}
            />
            <SettingsCtr
              label="Full node reward"
              value={chainsupply?.blockReward || 0}
            />
            <SettingsCtr label="Transaction fee" value={chainInfo?.fee || 0} />
          </div>

          <SubmitButton
            btnText="Update"
            isDisabled={isFetching}
            onClickBtn={onUpdate}
          />
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
