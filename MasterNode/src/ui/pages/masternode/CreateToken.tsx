import { JSX, useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { AppLayout } from "../../components/layout/AppLayout";
import { HorizontalDivider } from "../../components/global/Divider";
import { TextInput, MultiLineTextInput } from "../../components/global/Inputs";
import { SubmitButton } from "../../components/global/Buttons";
import { useSnackbar } from "../../hooks/snackbar";
import {
  Blockchain,
  NodeToken,
  MasterNode,
} from "../node-token-implementation";
import { useP2P } from "../../hooks/useP2P";
import { P2P_MESSAGE_TYPES } from "../../utils/api/config";
import "../../styles/pages/masternode/createtoken.scss";

// Initialize blockchain and master node
const localBlockchain = new Blockchain();
const masterNode = new MasterNode(localBlockchain);

export default function CreateToken(): JSX.Element {
  const { showerrorsnack, showsuccesssnack } = useSnackbar();
  const { sendMessage, isConnected, status } = useP2P();

  const [nodeName, setNodeName] = useState<string>("");
  const [txDateTime, setTxDateTime] = useState<string>("");
  const [nodeSerial, setNodeSerial] = useState<string>("");
  const [type, setType] = useState<string>("");
  const [nodeType, setNodeType] = useState<string>("S");
  const [address, setAddress] = useState<string>("");
  const [privateKey, setPrivateKey] = useState<string>("");
  const [generatedToken, setGeneratedToken] = useState<NodeToken | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [tempToken, setTempToken] = useState<NodeToken | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<string>("");
  const [isNodeActive, setIsNodeActive] = useState(false);

  // Monitor P2P connection status
  useEffect(() => {
        if (!isConnected) {
          showerrorsnack(
        "P2P connection not available. Please try again later."
          );
        }
  }, [isConnected, showerrorsnack]);

  const generateToken = () => {
    try {
      if (!nodeSerial || !txDateTime || !type) {
        showerrorsnack("Please fill in all required fields");
        return;
      }

      // Create a new NodeToken
      const token = new NodeToken(
        nodeSerial,
        type,
        new Date(txDateTime).getTime(),
        nodeType
      );

      // Sign the token with the master node's key
      token.signToken(masterNode.masterKeyPair);

      setTempToken(token);
      setShowConfirmation(true);
    } catch (error) {
      showerrorsnack(
        `Error generating token: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  const handleConfirmToken = async () => {
    if (!tempToken) return;

    setGeneratedToken(tempToken);
    setShowConfirmation(false);
    setIsVerifying(true);
    setVerificationStatus("Verifying token...");

    try {
      // Register the token hash with the P2P service
      sendMessage({
        type: P2P_MESSAGE_TYPES.TOKEN_HASH_CREATED,
        data: {
        serialNumber: nodeSerial,
        hash: tempToken.tokenHash,
        },
      });

      // Add the node identity (if needed, you can send another P2P message here)
      // sendMessage({
      //   type: P2P_MESSAGE_TYPES.ADD_NODE,
      //   data: {
      //     address,
      //     privateKey,
      //     nodeName,
      //     nodeType,
      //     serialNumber: nodeSerial,
      //   },
      // });

      // Verify the token
      const isValid = tempToken.isValid(masterNode.masterPublicKey);
      setIsNodeActive(isValid);
      setVerificationStatus(
        isValid ? "Token verified successfully" : "Token verification failed"
      );

      // Clear form
      setNodeName("");
      setTxDateTime("");
      setNodeSerial("");
      setType("");
      setNodeType("S");
      setAddress("");
      setPrivateKey("");

      showsuccesssnack("Token created and verified successfully");
    } catch (error) {
      showerrorsnack("Failed to create token, please try again");
      setVerificationStatus("Verification failed");
      throw error;
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCancelToken = () => {
    setTempToken(null);
    setShowConfirmation(false);
    showerrorsnack("Token generation cancelled");
  };

  return (
    <AppLayout>
      <section id="createtoken">
        <div className="form">
          <p className="title">Create a New Node Token</p>

          <HorizontalDivider sx={{ marginTop: "1rem" }} />

          <TextInput
            muiLabel="Node Name"
            placeholder="Enter node name"
            inputType="text"
            inputValue={nodeName}
            setInputValue={setNodeName}
          />

          <TextInput
            muiLabel="Transaction DateTime"
            placeholder="Enter transaction datetime"
            inputType="datetime-local"
            inputValue={txDateTime}
            setInputValue={setTxDateTime}
          />

          <TextInput
            muiLabel="Node Serial"
            placeholder="Enter node serial"
            inputType="text"
            inputValue={nodeSerial}
            setInputValue={setNodeSerial}
          />

          <TextInput
            muiLabel="Type"
            placeholder="Enter type"
            inputType="text"
            inputValue={type}
            setInputValue={setType}
          />

          <TextInput
            muiLabel="Node Type"
            placeholder="Enter node type"
            inputType="text"
            inputValue={nodeType}
            setInputValue={setNodeType}
          />

          <SubmitButton
            btnText={"Create"}
            isDisabled={!nodeSerial || !nodeType}
            onClickBtn={generateToken}
            xstyles={{ marginTop: "1rem" }}
          />
        </div>
      </section>
    </AppLayout>
  );
}
