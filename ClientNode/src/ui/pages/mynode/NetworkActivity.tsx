import { JSX, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getChainInfo } from "../../utils/api/chain";
import { verifyBlockWithHash } from "../../utils/api/transactions";
import { AppLayout } from "../../components/layout/AppLayout";
import { HorizontalDivider } from "../../components/global/Divider";
import "../../styles/pages/mynodes/verifyhashes.scss";

export default function NetworkActivity(): JSX.Element {
  const { data: chainInfo } = useQuery({
    queryKey: ["chaininfo"],
    queryFn: getChainInfo,
  });

  const {
    mutate: mutateBlockHash,
    data: latestblockhash,
    isPending: latesthashpending,
  } = useMutation({
    mutationKey: ["verifyblockhash"],
    mutationFn: () => verifyBlockWithHash(chainInfo?.latestBlockHash as string),
  });

  useEffect(() => {
    if (chainInfo?.latestBlockHash) {
      mutateBlockHash();
    }
  }, [chainInfo]);

  return (
    <AppLayout>
      <section id="networkactivity">
        <div className="form">
          <p className="title">Network Activity</p>
          <HorizontalDivider />
          <p>
            Latest Block Hash: <span>{chainInfo?.latestBlockHash}</span>
          </p>
          <p>
            Block No: <span>{chainInfo?.height}</span>
          </p>

          {!latesthashpending && (
            <>
              <p>
                Total Transactions:&nbsp;
                <span>{latestblockhash?.data?.transactionCount}</span>
              </p>
              <p>
                No Of Attending Nodes:&nbsp;
                <span>{(chainInfo?.peers as number) + 1}</span>
              </p>
              <p>
                No Of Approvals: <span>{(chainInfo?.peers as number) + 1}</span>
              </p>
              <p>
                No Of Flagged Nodes: <span>0</span>
              </p>
              <p>
                Transacted DAI Coins:&nbsp;
                <span>
                  {latestblockhash?.data?.transactions?.reduce(
                    (a, b) => a + b?.amount,
                    0
                  )}
                </span>
              </p>
            </>
          )}
        </div>
      </section>
    </AppLayout>
  );
}
