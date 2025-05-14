import { JSX, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useSnackbar } from "../../hooks/snackbar";
import {
  transactionInfo,
  blcokhashInfo,
  verifyTransactionWithHash,
  verifyBlockWithHash,
} from "../../utils/api/transactions";
import { AppLayout } from "../../components/layout/AppLayout";
import { TextInput } from "../../components/global/Inputs";
import { HorizontalDivider } from "../../components/global/Divider";
import { SubmitButton } from "../../components/global/Buttons";
import "../../styles/pages/mynodes/verifyhashes.scss";

export default function VerifyHashes(): JSX.Element {
  const { showerrorsnack, showsuccesssnack } = useSnackbar();

  const [inputHash, setInputHash] = useState<string>("");
  const [transactionhash, settransactionhash] =
    useState<transactionInfo | null>(null);
  const [blockhash, setblockhash] = useState<blcokhashInfo | null>(null);
  const [filter, setFilter] = useState<"block" | "transaction">("transaction");

  const { mutate: mutateTxHash, isPending: txhashpending } = useMutation({
    mutationKey: ["verifytxhash"],
    mutationFn: () =>
      verifyTransactionWithHash(inputHash)
        .then((res) => {
          showsuccesssnack("Transaction Hash verified successfully");
          settransactionhash(res);
        })
        .catch(() => {
          showerrorsnack("Unable to verify hash, please try again");
        }),
  });

  const { mutate: mutateBlockHash, isPending: blockhashpending } = useMutation({
    mutationKey: ["verifyblockhash"],
    mutationFn: () =>
      verifyBlockWithHash(inputHash)
        .then((res) => {
          showsuccesssnack("Block Hash verified successfully");
          setblockhash(res);
        })
        .catch(() => {
          showerrorsnack("Unable to verify hash, please try again");
        }),
  });

  const onVerifyHash = () => {
    settransactionhash(null);
    setblockhash(null);

    if (filter == "transaction") {
      mutateTxHash();
    } else {
      mutateBlockHash();
    }
  };

  return (
    <AppLayout>
      <section id="verifyhashes">
        <div className="form">
          <p className="title">Verify Hash</p>

          <HorizontalDivider sx={{ marginTop: "1rem" }} />

          <div className="filters">
            <button
              className={filter == "transaction" ? "active" : ""}
              onClick={() => setFilter("transaction")}
            >
              Transaction
            </button>
            <button
              className={filter == "block" ? "active" : ""}
              onClick={() => setFilter("block")}
            >
              Block
            </button>
          </div>

          <TextInput
            muiLabel="Hash"
            placeholder={`${filter} hash`}
            inputType="text"
            inputValue={inputHash}
            setInputValue={setInputHash}
            xstyles={{ width: "90%" }}
          />

          <SubmitButton
            btnText="Verify"
            isDisabled={inputHash == "" || txhashpending || blockhashpending}
            onClickBtn={onVerifyHash}
            xstyles={{ width: "90%", marginTop: "1rem" }}
          />
        </div>

        {filter == "transaction" && transactionhash !== null && (
          <div className="verifier">
            <p className="type">Transaction</p>
            <p>
              <span>From:</span> {transactionhash?.transaction?.fromAddress}
            </p>
            <p>
              <span>To:</span> {transactionhash?.transaction?.toAddress}
            </p>
            <p>
              <span>Amount:</span> {transactionhash?.transaction?.amount}
            </p>
            <p>
              <span>Fee:</span> {transactionhash?.transaction?.fee}
            </p>
            <p>
              <span>Block no:</span> {transactionhash?.blockHeight}
            </p>
            <p>
              <span>Signature</span> {transactionhash?.transaction?.signature}
            </p>
            <p>
              <span>Hash:</span> {transactionhash?.transaction?.hash}
            </p>
            <p>
              <span>Timestamp:</span> {transactionhash?.transaction?.timestamp}
            </p>
            <p>
              <span>Confirmations:</span> {transactionhash?.confirmations}
            </p>
            <p>
              <span>Status:</span> {transactionhash?.status}
            </p>
          </div>
        )}
        {filter == "block" && blockhash !== null && (
          <div className="verifier">
            <p className="type">Block</p>
            <p>
              <span>Hash:</span> {blockhash?.data?.hash}
            </p>
            <p>
              <span>Previous Hash:</span> {blockhash?.data?.previousHash}
            </p>
            <p>
              <span>Proposer:</span> {blockhash?.data?.proposer}
            </p>
            <p>
              <span>Timestamp:</span> {blockhash?.data?.timestamp}
            </p>
            <p>
              <span>Transactions:</span> {blockhash?.data?.transactionCount}
            </p>
          </div>
        )}
      </section>
    </AppLayout>
  );
}
