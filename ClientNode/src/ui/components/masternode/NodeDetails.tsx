import { JSX } from "react";
import { HorizontalDivider } from "../global/Divider";
import { colors } from "../../assets/colors";
import "../../styles/components/masternode/nodedetails.scss";

export const NodeDetails = (): JSX.Element => {
  return (
    <div className="node_details">
      <p className="det_title">Node Information</p>

      <HorizontalDivider
        sx={{ margin: "0.5rem 0", backgroundColor: colors.textsecondary }}
      />

      <p className="desc">
        Node Serial# <span>12dshj3892</span>
      </p>

      <p className="desc">
        Node Hash ID <span>0x05de32f00d20a6ac03c4f331c5e69d617e7c836</span>
      </p>

      <p className="desc">
        Token <span>3c677608a498bf3f413</span>
      </p>

      <p className="desc">
        Type <span>Mlt</span>
      </p>

      <p className="desc">
        Transaction Date time <span>1/25/2021, 2:52:17 PM</span>
      </p>
    </div>
  );
};
