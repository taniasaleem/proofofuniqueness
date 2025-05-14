import { JSX, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useSnackbar } from "../../hooks/snackbar";
import { createWallet, createwallettres } from "../../utils/api/wallet";
import { AppLayout } from "../../components/layout/AppLayout";
import { MultiLineTextInput, TextInput } from "../../components/global/Inputs";
import { HorizontalDivider } from "../../components/global/Divider";
import { SubmitButton } from "../../components/global/Buttons";
import "../../styles/pages/mywallets/createwallet.scss";

export default function CreateWallet(): JSX.Element {
  const { showsuccesssnack, showerrorsnack } = useSnackbar();

  const [walletName, setWalletName] = useState<string>("");
  const [secretKey, setSecretKey] = useState<string>("");
  const [newWallet, setNewWallet] = useState<createwallettres | null>(null);

  const { mutate: createNewWallet, isPending } = useMutation({
    mutationFn: () =>
      createWallet()
        .then((res) => {
          showsuccesssnack("Your new wallet was created successfully");
          setNewWallet(res);
        })
        .catch(() => {
          showerrorsnack("");
        }),
  });

  const onCreateWallet = () => {
    if (walletName == "" || secretKey == "") {
      showerrorsnack("Please enter a wallet name & address");
    } else {
      createNewWallet();
    }
  };

  return (
    <AppLayout>
      <section id="createwallet">
        {newWallet == null ? (
          <div className="walletform">
            <p className="title">Create a new wallet</p>
            <HorizontalDivider />
            <div className="inputs_ctr">
              <TextInput
                muiLabel="Wallet Name"
                placeholder="wallet name"
                inputType="text"
                inputValue={walletName}
                setInputValue={setWalletName}
              />

              <MultiLineTextInput
                muiLabel="Secret Key"
                placeholder="Choose your secret key min 50, max 150 characters. Make sure you save it securely"
                inputType="text"
                inputValue={secretKey}
                setInputValue={setSecretKey}
              />

              <SubmitButton
                xstyles={{ margin: "1rem 0" }}
                btnText={isPending ? "Creating Wallet..." : "Create"}
                isDisabled={walletName == "" || secretKey == "" || isPending}
                onClickBtn={onCreateWallet}
              />
            </div>
          </div>
        ) : (
          <div className="newwallet">
            <p className="title">Wallet created successfully</p>
            <p className="walletaddres">
              <span>Wallet Address</span> {newWallet?.address}
            </p>
            <SubmitButton
              btnText="Copy Wallet Address"
              isDisabled={false}
              onClickBtn={() => {
                navigator.clipboard.writeText(newWallet?.address);
                showsuccesssnack("Address copied to clipboard");
              }}
              xstyles={{ marginTop: "0.375rem" }}
            />
          </div>
        )}
      </section>
    </AppLayout>
  );
}
