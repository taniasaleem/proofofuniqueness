import { JSX, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useSnackbar } from "../../hooks/snackbar";
import { syncWithNodes } from "../../utils/api/chain";
import { AppLayout } from "../../components/layout/AppLayout";
import { HorizontalDivider } from "../../components/global/Divider";
import { TextInput } from "../../components/global/Inputs";
import { SubmitButton } from "../../components/global/Buttons";
import "../../styles/pages/masternode/uploadversion.scss";

export default function UploadVersion(): JSX.Element {
  const { showerrorsnack, showsuccesssnack } = useSnackbar();

  const [peerUrl, setPeerUrl] = useState<string>("");

  const { mutate: syncnodes, isPending } = useMutation({
    mutationFn: () =>
      syncWithNodes(peerUrl)
        .then((res) => {
          console.log(res);
          setPeerUrl("");
          showsuccesssnack(`Successfully synced with 1 peer`);
        })
        .catch(() => {
          showerrorsnack("Sync failed, please try again");
        }),
  });

  return (
    <AppLayout>
      <section id="uploadversion">
        <div className="content_ctr">
          <p className="title">Sync with a Peer</p>

          <HorizontalDivider sx={{ marginTop: "1rem" }} />

          <TextInput
            muiLabel="Peer URL"
            placeholder="ws/:86.0.."
            inputType="text"
            inputValue={peerUrl}
            setInputValue={setPeerUrl}
            xstyles={{ width: "90%" }}
          />

          <SubmitButton
            btnText={isPending ? "Syncing, please wait..." : "Sync"}
            isDisabled={peerUrl == "" || isPending}
            onClickBtn={syncnodes}
            xstyles={{ width: "90%", marginTop: "1rem" }}
          />
        </div>
      </section>
    </AppLayout>
  );
}
