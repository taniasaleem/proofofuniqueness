import React, { useEffect, useState, JSX } from "react";
import {
  Blockchain,
  Node,
  NodeToken,
  Transaction,
  log,
  MasterNode,
} from "./node-token-implementation";
import {
  Box,
  Button,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { AppLayout } from "../components/layout/AppLayout";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { useTokenHash } from "../hooks/useTokenHash";
import { TextInput } from "../components/global/Inputs";
import { SubmitButton } from "../components/global/Buttons";
import { HorizontalDivider } from "../components/global/Divider";

// Initialize blockchain and node
const localBlockchain = new Blockchain();
const masterNode = new MasterNode(localBlockchain);
const userNode = new Node(localBlockchain);

const StyledContainer = styled(Container)(({ theme }) => ({
  padding: theme.spacing(4),
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(3),
}));

const VerificationBox = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginTop: theme.spacing(3),
  backgroundColor: theme.palette.background.default,
  border: `1px solid ${theme.palette.divider}`,
}));

interface VerificationResult {
  valid: boolean;
  verifiedBy: number;
}

const NodeManager = (): JSX.Element => {
  const [nodeName, setNodeName] = useState("");
  const [nodeType, setNodeType] = useState("S");
  const [serialNumber, setSerialNumber] = useState("");
  const [bankID, setBankID] = useState("");
  const [bankTimestamp, setBankTimestamp] = useState<Date | null>(new Date());
  const [generatedToken, setGeneratedToken] = useState<NodeToken | null>(null);
  const [status, setStatus] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [tempToken, setTempToken] = useState<NodeToken | null>(null);
  const [isNodeActive, setIsNodeActive] = useState(false);
  const [verificationResult, setVerificationResult] =
    useState<VerificationResult | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [tokenHash, setTokenHash] = useState<string>("");
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verificationStatus, setVerificationStatus] = useState<string>("");

  const {
    registerTokenHash,
    verifyTokenHash,
    getTokenHash,
    getTokenHashData,
    getVerificationResult,
    getVerificationStatus,
    isConnected,
    status: wsStatus,
    processMessages,
  } = useTokenHash();

  // console.log("isConnected", isConnected);
  // console.log("generatedToken", generatedToken);

  useEffect(() => {
    // Initialize any necessary setup
    log("Node Manager initialized");
    processMessages();
  }, [processMessages]);

  const generateToken = () => {
    try {
      if (!bankID || !bankTimestamp || !serialNumber) {
        setStatus("Please fill in all required fields");
        return;
      }

      // Create a new NodeToken
      const token = new NodeToken(
        serialNumber,
        bankID,
        bankTimestamp.getTime(),
        nodeType
      );

      // Sign the token with the master node's key
      token.signToken(masterNode.masterKeyPair);

      setTempToken(token);
      setShowConfirmation(true);
    } catch (error) {
      setStatus(
        `Error generating token: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  const handleConfirmToken = () => {
    if (!tempToken) return;

    setGeneratedToken(tempToken);
    setTokenHash(tempToken.tokenHash);
    setStatus("Token confirmed and stored");
    setShowConfirmation(false);

    // Register the token hash with the WebSocket server
    registerTokenHash(serialNumber, tempToken.tokenHash);
  };

  const handleCancelToken = () => {
    setTempToken(null);
    setShowConfirmation(false);
    setStatus("Token generation cancelled");
  };

  const verifyToken = async () => {
    if (!generatedToken) {
      setStatus("Please generate a token first");
      return;
    }

    // if (!isConnected) {
    //   setStatus(wsStatus || "WebSocket connection not available. Please try again later.");
    //   console.error('WebSocket connection error:', wsStatus);
    //   return;
    // }

    setStatus("Verifying token...");
    try {
      const isValid = generatedToken.isValid(masterNode.masterPublicKey);
      setVerificationResult({
        valid: isValid,
        verifiedBy: isValid ? 1 : 0,
      });
      setIsNodeActive(isValid);
      setStatus(
        isValid ? "Token verified successfully" : "Token verification failed"
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setStatus(`Error verifying token: ${errorMessage}`);
      console.error("Verification error:", error);
    }
  };

  // Remove the automatic getTokenHash effect
  // Only update UI when token hash data changes
  useEffect(() => {
    if (serialNumber && serialNumber.trim()) {
      const tokenData = getTokenHashData(serialNumber);
      if (tokenData) {
        console.log("Token data updated:", tokenData);
        setIsNodeActive(tokenData.verificationCount > 0);
      }
    }
  }, [serialNumber, getTokenHashData]);

  // Monitor WebSocket connection status
  useEffect(() => {
    if (!isConnected) {
      console.log("WebSocket disconnected:", wsStatus);
    } else {
      console.log("WebSocket connected");
    }
  }, [isConnected, wsStatus]);

  const handleSerialNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSerialNumber(e.target.value);
  };

  // const handleSerialNumberBlur = () => {
  //   // Only fetch token hash when the user has finished entering the serial number
  //   if (serialNumber && serialNumber.trim()) {
  //     console.log('Fetching token hash for serial number:', serialNumber);
  //     getTokenHash(serialNumber);
  //   }
  // };

  return (
    <AppLayout>
      <section id="createtoken">
        <div className="form">
          <p className="title">Create a New Node Token</p>

          <HorizontalDivider sx={{ marginTop: "1rem" }} />

          <TextInput
            muiLabel="Node Name"
            placeholder="Enter Node Name"
            inputType="text"
            inputValue={nodeName}
            setInputValue={setNodeName}
          />

          {/* <TextInput
            muiLabel="Transaction DateTime"
            placeholder="Transaction DateTime"
            inputType="datetime-local"
            inputValue={
              bankTimestamp
                ? new Date(bankTimestamp.getTime() - bankTimestamp.getTimezoneOffset() * 60000)
                    .toISOString()
                    .slice(0, 16)
                : ""
            }
            setInputValue={(value) => {
              if (value && !isNaN(Date.parse(value))) {
                setBankTimestamp(new Date(value));
              } else {
                setBankTimestamp(null);
              }
            }}
          /> */}

          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Bank Timestamp"
              value={bankTimestamp}
              onChange={(newValue) => setBankTimestamp(newValue)}
              sx={{ width: "100%", mt: 2 }}
            />
          </LocalizationProvider>

          <TextInput
            muiLabel="Node Serial #"
            placeholder="Enter Node Serial #"
            inputType="text"
            inputValue={serialNumber}
            setInputValue={(value) =>
              handleSerialNumberChange({
                target: { value },
              } as React.ChangeEvent<HTMLInputElement>)
            }
          />

          <TextInput
            muiLabel="Type"
            placeholder="Type"
            inputType="text"
            inputValue={bankID}
            setInputValue={setBankID}
          />

          <TextInput
            muiLabel="Node Type"
            placeholder="Node Type"
            inputType="text"
            inputValue={nodeType}
            setInputValue={setNodeType}
          />

          <TextInput
            muiLabel="Generated Token Hash"
            placeholder="Generated Token Hash"
            inputType="text"
            inputValue={tokenHash}
            setInputValue={() => {}}
          />

          <SubmitButton
            btnText={"Create"}
            isDisabled={
              !serialNumber ||
              !nodeType ||
              !bankID ||
              !bankTimestamp ||
              !nodeName ||
              tokenHash !== ""
            }
            onClickBtn={() => {
              generateToken();
            }}
            xstyles={{
              marginTop: "1rem",
            }}
          />
        </div>
      </section>
      <Dialog open={showConfirmation} onClose={handleCancelToken}>
        <DialogTitle>Confirm Token</DialogTitle>
        <DialogContent>
          <Typography>Generated Token Hash: {tempToken?.tokenHash}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelToken}>Cancel</Button>
          <Button onClick={handleConfirmToken} variant="contained">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  );

  return (
    <AppLayout>
      <StyledContainer>
        <Typography variant="h4" gutterBottom>
          Node Manager
        </Typography>

        <form>
          <TextField
            fullWidth
            label="Node Name"
            value={nodeName}
            onChange={(e) => setNodeName(e.target.value)}
            margin="normal"
          />

          <TextField
            fullWidth
            label="Serial Number"
            value={serialNumber}
            onChange={handleSerialNumberChange}
            // onBlur={handleSerialNumberBlur}
            margin="normal"
          />

          <TextField
            fullWidth
            label="Type"
            value={bankID}
            onChange={(e) => setBankID(e.target.value)}
            margin="normal"
          />

          <FormControl fullWidth margin="normal">
            <InputLabel>Node Type</InputLabel>
            <Select
              value={nodeType}
              label="Node Type"
              onChange={(e) => setNodeType(e.target.value)}
            >
              <MenuItem value="S">Standard Node</MenuItem>
              <MenuItem value="M">Master Node</MenuItem>
            </Select>
          </FormControl>

          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Bank Timestamp"
              value={bankTimestamp}
              onChange={(newValue) => setBankTimestamp(newValue)}
              sx={{ width: "100%", mt: 2 }}
            />
          </LocalizationProvider>

          <Box sx={{ display: "flex", gap: 2, alignItems: "center", mt: 2 }}>
            <TextField
              fullWidth
              label="Generated Token Hash"
              value={generatedToken?.tokenHash || ""}
              InputProps={{ readOnly: true }}
              margin="normal"
            />
            <Button
              variant="outlined"
              onClick={generateToken}
              sx={{ height: "56px" }}
            >
              Generate Token
            </Button>
          </Box>
        </form>

        <VerificationBox>
          <Typography variant="h6" gutterBottom>
            Verify Node Token
          </Typography>

          <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
            <Button
              variant="contained"
              onClick={verifyToken}
              sx={{
                height: "56px",
                bgcolor: isNodeActive ? "#4caf50" : "#2196f3",
                "&:hover": {
                  bgcolor: isNodeActive ? "#388e3c" : "#1976d2",
                },
              }}
              disabled={!generatedToken}
            >
              {isNodeActive ? "✓ Verified" : "Verify Token"}
            </Button>
          </Box>

          <Typography
            variant="body1"
            sx={{
              mt: 2,
              color: isConnected ? "success.main" : "error.main",
            }}
          >
            {status}
          </Typography>
        </VerificationBox>

        <Dialog open={showConfirmation} onClose={handleCancelToken}>
          <DialogTitle>Confirm Token</DialogTitle>
          <DialogContent>
            <Typography>
              Generated Token Hash: {tempToken?.tokenHash}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCancelToken}>Cancel</Button>
            <Button onClick={handleConfirmToken} variant="contained">
              Confirm
            </Button>
          </DialogActions>
        </Dialog>
      </StyledContainer>
    </AppLayout>
  );
};

export default NodeManager;
