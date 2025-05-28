import React, { useEffect, useState, JSX } from "react";
import {
  Blockchain,
  // Node,
  NodeToken,
  // Transaction,
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
// import { TextInput } from "../components/global/Inputs";
// import { SubmitButton } from "../components/global/Buttons";
// import { HorizontalDivider } from "../components/global/Divider";
// import { registerTokenHash, TokenHashRegistrationResponse } from "../utils/api/masternode";

// Initialize blockchain and node
const localBlockchain = new Blockchain();
const masterNode = new MasterNode(localBlockchain);
// const userNode = new Node(localBlockchain);

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
  // const [tokenHash, setTokenHash] = useState<string>("");

  const {
    registerTokenHash,
    verifyTokenHash,
    // getTokenHash,
    getTokenHashData,
    getVerificationResult,
    // getVerificationStatus,
    isConnected,
    status: p2pStatus,
    isLoading,
    error: p2pError
  } = useTokenHash();

  useEffect(() => {
    // Initialize P2P connection
    log("Node Manager initialized");
    
    // Monitor P2P connection status
    if (!isConnected) {
      console.log("P2P disconnected:", p2pStatus);
      setStatus(p2pError || "P2P connection lost. Please check your connection.");
    } else {
      console.log("P2P connected");
      setStatus("Connected to P2P network");
    }
  }, [isConnected, p2pStatus, p2pError]);

  // Update UI when token hash data changes
  useEffect(() => {
    if (serialNumber) {
      const tokenData = getTokenHashData(serialNumber);
      if (tokenData) {
        console.log("Token data updated:", tokenData);
        setIsNodeActive(tokenData.verificationCount ? tokenData.verificationCount > 0 : false);
      }
    }
  }, [serialNumber, getTokenHashData]);

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
      const sig = token.signToken(masterNode.masterKeyPair);
      console.log("Signature:", sig);

      setTempToken(token);
      setSerialNumber(token.serialNumber);
      setShowConfirmation(true);
    } catch (error) {
      setStatus(
        `Error generating token: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  const handleConfirmToken = async () => {
    if (!tempToken) return;

    try {
      setStatus("Registering token hash...");
      
      // Register the token hash with the P2P network
      await registerTokenHash(serialNumber, tempToken.tokenHash);
      
      
      
        setGeneratedToken(tempToken);
        // setTokenHash(tempToken.tokenHash);
        setStatus("Token confirmed and registered successfully");
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setStatus(`Error registering token hash: ${errorMessage}`);
      console.error("Token hash registration error:", error);
    }
    
    setShowConfirmation(false);
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

    if (!isConnected) {
      setStatus(p2pError || "P2P connection not available. Please try again later.");
      console.error('P2P connection error:', p2pError);
      return;
    }

    setStatus("Verifying token...");
    try {
      // First verify locally
      const isValid = generatedToken.isValid(masterNode.masterPublicKey);
      
      // Then verify through P2P network
      await verifyTokenHash(serialNumber, generatedToken.tokenHash);
      
      // Get verification result from P2P network
      const result = getVerificationResult(serialNumber);
      
      setVerificationResult({
        valid: isValid && (result?.valid || false),
        verifiedBy: result?.verifiedBy || 0
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

  const handleSerialNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSerialNumber(e.target.value);
  };

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
              disabled={isLoading}
            >
              {isLoading ? "Generating..." : "Generate Token"}
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
              disabled={!generatedToken || !isConnected || isLoading}
            >
              {isLoading ? "Verifying..." : isNodeActive ? "✓ Verified" : "Verify Token"}
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

          {verificationResult && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2">
                Verification Status: {verificationResult.valid ? "Valid" : "Invalid"}
              </Typography>
              <Typography variant="body2">
                Verified By: {verificationResult.verifiedBy} nodes
              </Typography>
            </Box>
          )}
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
