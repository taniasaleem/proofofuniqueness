import { JSX } from "react";
import { HashRouter, Routes, Route } from "react-router";
import { AppDrawerProvider } from "./hooks/drawer";
import { SnackBarProvider } from "./hooks/snackbar";
import Dashboard from "./pages/Dashboard";
import MyNode from "./pages/MyNode";
import MyWallets from "./pages/MyWallets";
import Settings from "./pages/Settings";
import CreateToken from "./pages/masternode/CreateToken";
import MyNodeStatus from "./pages/mynode/Status";
import NetworkActivity from "./pages/mynode/NetworkActivity";
import VerifyHashes from "./pages/mynode/VerifyHashes";
import Ledgers from "./pages/mynode/Ledgers";
import MyNodeSettings from "./pages/mynode/Settings";
import CreateWallet from "./pages/mywallets/CreateWallet";
import MyWalletLedgers from "./pages/mywallets/Ledgers";
import Messages from "./pages/masternode/Messages";
import { AppDrawer } from "./components/global/Appdrawer";
import { SnackBar } from "./components/global/SnackBar";

function App(): JSX.Element {
  return (
    <AppDrawerProvider>
      <SnackBarProvider>
        <HashRouter>
          <Routes>
            <Route path="" index element={<Dashboard />} />
            <Route path="my-node" index element={<MyNode />} />
            <Route
              path="my-node/create-token"
              index
              element={<CreateToken />}
            />
            <Route path="my-node/status" index element={<MyNodeStatus />} />
            <Route path="my-node/messages" index element={<Messages />} />
            <Route
              path="my-node/network-activity"
              index
              element={<NetworkActivity />}
            />
            <Route path="my-node/verify" index element={<VerifyHashes />} />
            <Route path="my-node/ledgers" index element={<Ledgers />} />
            <Route path="my-node/settings" index element={<MyNodeSettings />} />
            <Route path="my-wallets" index element={<MyWallets />} />
            <Route path="my-wallets/create" index element={<CreateWallet />} />
            <Route
              path="my-wallets/ledgers"
              index
              element={<MyWalletLedgers />}
            />
            <Route path="settings" index element={<Settings />} />
          </Routes>

          <AppDrawer />
        </HashRouter>

        <SnackBar />
      </SnackBarProvider>
    </AppDrawerProvider>
  );
}

export default App;
