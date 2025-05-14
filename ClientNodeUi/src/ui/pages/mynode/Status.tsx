import { JSX } from "react";
import { AppLayout } from "../../components/layout/AppLayout";
import "../../styles/pages/mynodes/status.scss";
import { SubmitButton } from "../../components/global/Buttons";

export default function MyNodeStatus(): JSX.Element {
  return (
    <AppLayout>
      <section id="mynodestatus">
        <div className="activate_node">
          <p className="title_desc">
            Activate Your Node
            <span>
              To activate your node, you need to perform the Proof Of Uniqueness
              of your account
            </span>
          </p>

          <p className="activity_status">
            Your node is:
            <span className="not_active">Not Active</span>
          </p>

          <p className="activity_status">
            Activate your soft node by sending 1€ with:
            <span>Revolut</span>
          </p>

          <p className="activity_status">
            Activate your full node, earn more DAI Coins for 100€ with :
            <span>Revolut</span>
          </p>
        </div>

        <div className="activate_node connect_node">
          <p className="title_desc">Connect Your Node</p>

          <p className="activity_status">
            Your connection status is:
            <span className="not_active">Not Active</span>
          </p>

          <div className="button_ctr">
            <SubmitButton
              btnText="Connect"
              isDisabled={false}
              onClickBtn={() => {}}
              xstyles={{ width: "50%", marginTop: "0.5rem" }}
            />
          </div>
        </div>
      </section>
    </AppLayout>
  );
}
