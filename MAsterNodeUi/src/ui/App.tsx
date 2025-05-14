import { JSX } from "react";
import { HashRouter, Routes, Route } from "react-router";
import { AppDrawerProvider } from "./hooks/drawer";
import { SnackBarProvider } from "./hooks/snackbar";
import MasterNode from "./pages/MasterNode";
import MasterNodeSettings from "./pages/masternode/Settings";
import UploadVersion from "./pages/masternode/UploadVersion";
import Messages from "./pages/masternode/Messages";
import TreasuryWallet from "./pages/masternode/TreasuryWallet";
import NodeManager from "./pages/NodeManager";
import { AppDrawer } from "./components/global/Appdrawer";
import { SnackBar } from "./components/global/SnackBar";

function App(): JSX.Element {
  return (
    <AppDrawerProvider>
      <SnackBarProvider>
        <HashRouter>
          <Routes>
            <Route path="" index element={<MasterNode />} />
            <Route
              path="master-node/settings"
              index
              element={<MasterNodeSettings />}
            />
            <Route
              path="master-node/upload"
              index
              element={<UploadVersion />}
            />
            <Route
              path="master-node/treasury"
              index
              element={<TreasuryWallet />}
            />
            <Route path="master-node/messages" index element={<Messages />} />
            <Route path="node-manager" index element={<NodeManager />} />
          </Routes>

          <AppDrawer />
        </HashRouter>

        <SnackBar />
      </SnackBarProvider>
    </AppDrawerProvider>
  );
}

export default App;
