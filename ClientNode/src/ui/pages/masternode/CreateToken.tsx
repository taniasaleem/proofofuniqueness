import { JSX, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useSnackbar } from "../../hooks/snackbar";
import { addIdentity } from "../../utils/api/masternode";
import { AppLayout } from "../../components/layout/AppLayout";
import { TextInput, MultiLineTextInput } from "../../components/global/Inputs";
import { HorizontalDivider } from "../../components/global/Divider";
import { SubmitButton } from "../../components/global/Buttons";
import "../../styles/pages/masternode/createtoken.scss";

export default function CreateToken(): JSX.Element {
  const { showerrorsnack, showsuccesssnack } = useSnackbar();

  const [nodeName, setNodeName] = useState<string>("");
  const [txDateTime, setTxDateTime] = useState<string>("");
  const [nodeSerial, setNodeSerial] = useState<string>("");
  const [revolutClient, setRevolutClient] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [privateKey, setPrivateKey] = useState<string>("");

  const { mutate: addnewidentity, isPending } = useMutation({
    mutationFn: () =>
      addIdentity(address, privateKey)
        .then(() => {
          setNodeName("");
          setTxDateTime("");
          setNodeSerial("");
          setRevolutClient("");
          setAddress("");
          setPrivateKey("");
          showsuccesssnack("Token created successfully");
        })
        .catch(() => {
          showerrorsnack("Failed to create token, please try again");
        }),
  });

  return (
    <AppLayout>
      <section id="createtoken">
        <div className="form">
          <p className="title">Get a Node token</p>

          <HorizontalDivider sx={{ marginTop: "1rem" }} />

          <p style={{ marginTop: "0.5rem", fontWeight: 500 }}>
            Get a Node Token by sending 1€ through Revolut
          </p>
          <TextInput
            muiLabel="Revolut Client ID"
            placeholder="67H0..."
            inputType="text"
            inputValue={revolutClient}
            setInputValue={setRevolutClient}
          />

          <TextInput
            muiLabel="Address"
            placeholder="0x123..."
            inputType="text"
            inputValue={address}
            setInputValue={setAddress}
          />

          <MultiLineTextInput
            muiLabel="Private Key"
            placeholder="private key"
            inputType="text"
            inputValue={privateKey}
            setInputValue={setPrivateKey}
          />

          <SubmitButton
            btnText={isPending ? "Creating, Please wait..." : "Create"}
            isDisabled={
              nodeName == "" ||
              txDateTime == "" ||
              nodeSerial == "" ||
              revolutClient == "" ||
              address == "" ||
              privateKey == "" ||
              isPending
            }
            onClickBtn={addnewidentity}
            xstyles={{ marginTop: "1rem" }}
          />
        </div>
      </section>
    </AppLayout>
  );
}
