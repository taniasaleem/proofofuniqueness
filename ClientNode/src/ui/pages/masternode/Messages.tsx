import { JSX, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useSnackbar } from "../../hooks/snackbar";
import {
  createTransaction,
  transactionres,
} from "../../utils/api/transactions";
import { AppLayout } from "../../components/layout/AppLayout";
import { MultiLineTextInput, TextInput } from "../../components/global/Inputs";
import { HorizontalDivider } from "../../components/global/Divider";
import { SubmitButton } from "../../components/global/Buttons";
import "../../styles/pages/masternode/messages.scss";

export default function Messages(): JSX.Element {
  const { showerrorsnack, showsuccesssnack } = useSnackbar();

  const [fromAddress, setFromAddres] = useState<string>("");
  const [toAddress, setToAddres] = useState<string>("");
  const [txAmount, setTxAmount] = useState<string>("");
  const [txFee, setTxFee] = useState<string>("");
  const [privateKey, setPrivateKey] = useState<string>("");
  const [txMessage, setTxMessage] = useState<string>("");
  const [_txResponse, setTxResponse] = useState<transactionres | null>(null);

  const { mutate: performTransaction, isPending } = useMutation({
    mutationFn: () =>
      createTransaction(
        fromAddress,
        toAddress,
        Number(txAmount),
        Number(txFee),
        privateKey,
        txMessage
      )
        .then((res) => {
          setTxResponse(res);
          setFromAddres("");
          setToAddres("");
          setTxAmount("");
          setTxFee("");
          setPrivateKey("");
          setTxMessage("");
          showsuccesssnack("The transaction was completed successfully");
        })
        .catch(() => {
          showerrorsnack(
            "The transaction could not be completed, please try again"
          );
        }),
  });

  const onPerformTransaction = () => {
    if (Number(txFee) < 0.001) {
      showerrorsnack("Transaction Fee Minimum is 0.001");
    } else {
      showsuccesssnack("Please wait");
      performTransaction();
    }
  };

  return (
    <AppLayout>
      <section id="messages">
        <div className="messagges_form">
          <div className="inputs_ctr">
            <p className="title">Create A Transaction</p>
            <HorizontalDivider sx={{ marginTop: "1rem" }} />

            <TextInput
              muiLabel="Your Address"
              placeholder="0x42..."
              inputType="text"
              inputValue={fromAddress}
              setInputValue={setFromAddres}
              xstyles={{ width: "90%" }}
            />

            <TextInput
              muiLabel="Receiver's Address"
              placeholder="0x42..."
              inputType="text"
              inputValue={toAddress}
              setInputValue={setToAddres}
              xstyles={{ width: "90%" }}
            />

            <TextInput
              muiLabel="Amount"
              placeholder="50"
              inputType="number"
              inputValue={txAmount}
              setInputValue={setTxAmount}
              xstyles={{ width: "90%" }}
            />

            <TextInput
              muiLabel="Fee"
              placeholder="Min 0.001"
              inputType="number"
              inputValue={txFee}
              setInputValue={setTxFee}
              xstyles={{ width: "90%" }}
            />

            <MultiLineTextInput
              muiLabel="Private Key"
              placeholder="Use your private key to sign the transaction"
              inputType="text"
              inputValue={privateKey}
              setInputValue={setPrivateKey}
              xstyles={{ width: "90%" }}
            />

            <TextInput
              muiLabel="Message"
              placeholder="message"
              inputType="text"
              inputValue={txMessage}
              setInputValue={setTxMessage}
              xstyles={{ width: "90%" }}
            />
          </div>

          <SubmitButton
            btnText={isPending ? "Sending, Please wait..." : "Send"}
            isDisabled={
              fromAddress == "" ||
              toAddress == "" ||
              txAmount == "" ||
              txFee == "" ||
              txMessage == "" ||
              isPending
            }
            onClickBtn={onPerformTransaction}
            xstyles={{ width: "90%", marginTop: "0.5rem" }}
          />
        </div>
      </section>
    </AppLayout>
  );
}
