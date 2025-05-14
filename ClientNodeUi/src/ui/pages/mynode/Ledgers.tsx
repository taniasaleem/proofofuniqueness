import { JSX, useState } from "react";
import { AppLayout } from "../../components/layout/AppLayout";
import { Ledger } from "./Settings";
import "../../styles/pages/mywallets/ledgers.scss";

export default function Ledgers(): JSX.Element {
  const [blockLedgerSelected, setBlockLedgerSelected] =
    useState<boolean>(false);
  const [txLedgerSelectd, setTxLedgerSelectd] = useState<boolean>(false);
  const [nodeLedgerSelected, setNodeLedgerSelected] = useState<boolean>(false);

  return (
    <AppLayout>
      <section id="mywalletsledger">
        <div className="_ledgers">
          <p className="title_desc">
            Ledger Downloads
            <span>Select the ledgers to download</span>
          </p>

          <Ledger
            cpu="0.5"
            memory="1Gb"
            title="Ledger of the blocks"
            isSelected={blockLedgerSelected}
            onNodeClick={() => setBlockLedgerSelected(!blockLedgerSelected)}
          />
          <Ledger
            cpu="1"
            memory="2Gb"
            title="Full ledger of transactions"
            isSelected={txLedgerSelectd}
            onNodeClick={() => setTxLedgerSelectd(!txLedgerSelectd)}
          />
          <Ledger
            cpu="2"
            memory="4Gb"
            title="Ledger of the nodes"
            isSelected={nodeLedgerSelected}
            onNodeClick={() => setNodeLedgerSelected(!nodeLedgerSelected)}
          />
        </div>

        <div className="last_update">
          <p>Last Update: 13:52 - 21/03/2025</p>
          <p>
            Saved in: my computer/my documents/DAI <br /> (1 GB memory)
          </p>
        </div>
      </section>
    </AppLayout>
  );
}
