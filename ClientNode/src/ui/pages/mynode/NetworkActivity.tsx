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

  // Helper function to safely format numbers
  const formatNumber = (value: number | undefined | null): string => {
    if (value === undefined || value === null || isNaN(value)) {
      return '0';
    }
    return value.toString();
  };

  // Helper function to safely calculate transaction total
  const calculateTransactionTotal = (transactions: any[] | undefined): number => {
    if (!transactions || !Array.isArray(transactions)) {
      return 0;
    }
    return transactions.reduce((total, tx) => {
      const amount = Number(tx?.amount) || 0;
      return total + amount;
    }, 0);
  };

  return (
    <AppLayout>
      <section id="networkactivity">
        <div className="form">
          <p className="title">Network Activity</p>
          <HorizontalDivider />
          <p>
            Latest Block Hash: <span>{chainInfo?.latestBlockHash || '-'}</span>
          </p>
          <p>
            Block No: <span>{formatNumber(chainInfo?.height)}</span>
          </p>

          {!latesthashpending && (
            <>
              <p>
                Total Transactions:&nbsp;
                <span>{formatNumber(latestblockhash?.data?.transactionCount)}</span>
              </p>
              <p>
                No Of Attending Nodes:&nbsp;
                <span>{formatNumber((chainInfo?.peers as number) + 1)}</span>
              </p>
              <p>
                No Of Approvals: <span>{formatNumber((chainInfo?.peers as number) + 1)}</span>
              </p>
              <p>
                No Of Flagged Nodes: <span>0</span>
              </p>
              <p>
                Transacted DAI Coins:&nbsp;
                <span>
                  {formatNumber(calculateTransactionTotal(latestblockhash?.data?.transactions))}
                </span>
              </p>
            </>
          )}
        </div>
      </section>
    </AppLayout>
  );
}
