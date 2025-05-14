import { CSSProperties, JSX, useState } from "react";
import { Checkbox } from "@mui/material";
import { AppLayout } from "../../components/layout/AppLayout";
import { colors } from "../../assets/colors";
import "../../styles/pages/mynodes/settings.scss";

type nodesType = "small" | "medium" | "large";

export default function MyNodeSettings(): JSX.Element {
  const [selectNode, setSelectNode] = useState<nodesType>("small");
  const [blockLedgerSelected, setBlockLedgerSelected] =
    useState<boolean>(false);
  const [txLedgerSelectd, setTxLedgerSelectd] = useState<boolean>(false);
  const [nodeLedgerSelected, setNodeLedgerSelected] = useState<boolean>(false);

  return (
    <AppLayout>
      <section id="mynodesettings">
        <div className="_settings resources">
          <p className="title_desc">
            Node Size
            <span>Select the level of resources available to your node.</span>
          </p>

          <Resource
            cpu="0.5"
            memory="1Gb"
            size="Small"
            isSelected={selectNode == "small"}
            onNodeClick={() => setSelectNode("small")}
          />
          <Resource
            cpu="1"
            memory="2Gb"
            size="Medium"
            isSelected={selectNode == "medium"}
            onNodeClick={() => setSelectNode("medium")}
          />
          <Resource
            cpu="2"
            memory="4Gb"
            size="Large"
            isSelected={selectNode == "large"}
            onNodeClick={() => setSelectNode("large")}
          />
        </div>

        <div className="_settings ledgers">
          <p className="title_desc">
            Ledger downloads
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
      </section>
    </AppLayout>
  );
}

export const Resource = ({
  size,
  memory,
  cpu,
  isSelected,
  onNodeClick,
}: {
  size: string;
  memory: string;
  cpu: string;
  isSelected: boolean;
  onNodeClick: () => void;
}): JSX.Element => {
  return (
    <div
      className="resource_ctr"
      style={{
        borderColor: isSelected ? colors.accent : "",
        backgroundColor: isSelected ? "transparent" : "",
      }}
      onClick={onNodeClick}
    >
      <div className="radioctr">
        <div
          style={{
            backgroundColor: isSelected ? colors.accent : colors.primary,
          }}
        />
      </div>
      <p>
        {size}
        <span>
          ({memory} memory, {cpu} vCPU)
        </span>
      </p>
    </div>
  );
};

export const Ledger = ({
  title,
  memory,
  cpu,
  isSelected,
  onNodeClick,
}: {
  title: string;
  memory: string;
  cpu: string;
  isSelected: boolean;
  onNodeClick: () => void;
}): JSX.Element => {
  return (
    <div
      className="resource_ctr"
      style={{
        borderColor: isSelected ? colors.accent : "",
        backgroundColor: isSelected ? "transparent" : "",
      }}
      onClick={onNodeClick}
    >
      <Checkbox
        checked={isSelected}
        disableRipple
        sx={{
          color: colors.textsecondary,
          padding: "unset",
          "&.Mui-checked": {
            color: colors.accent,
          },
        }}
      />
      <p>
        {title}
        <span>
          ({memory} memory, {cpu} vCPU)
        </span>
      </p>
    </div>
  );
};

export const RadioButton = ({
  dpText,
  isSelected,
  onclick,
  sxstyles,
}: {
  dpText: string;
  isSelected: boolean;
  onclick: () => void;
  sxstyles?: CSSProperties;
}): JSX.Element => {
  return (
    <div
      className="radio_btn"
      style={{
        borderColor: isSelected ? colors.accent : "",
        backgroundColor: isSelected ? "transparent" : "",
        ...sxstyles,
      }}
      onClick={onclick}
    >
      <div className="radioctr">
        <div
          style={{
            backgroundColor: isSelected ? colors.accent : colors.primary,
          }}
        />
      </div>
      <p>{dpText}</p>
    </div>
  );
};
