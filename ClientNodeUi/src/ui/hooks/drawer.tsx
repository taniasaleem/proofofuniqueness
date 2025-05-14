import { createContext, useContext, useState, ReactNode, JSX } from "react";

export type draweraction = "nodeinfo";

interface draerctxtype {
  action: draweraction;
  drawerOpen: boolean;
  drawerInfo?: any;
  openAppDrawer: (drawerAction: draweraction) => void;
  openAppDrawerWithInfo: (drawerAction: draweraction, drawerInfo?: any) => void;
  closeAppDrawer: () => void;
}

const appdrawerctx = createContext<draerctxtype>({} as draerctxtype);

interface providerProps {
  children: ReactNode;
}

export const AppDrawerProvider = ({ children }: providerProps): JSX.Element => {
  const [drawerAction, setDrawerAction] = useState<draweraction>("nodeinfo");
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [drawerInfo, setDrawerInfo] = useState<any>();

  const openAppDrawer = (drawerAction: draweraction) => {
    setDrawerAction(drawerAction);
    setDrawerOpen(true);
  };

  const openAppDrawerWithInfo = (
    drawerAction: draweraction,
    drawerInfo?: any
  ) => {
    setDrawerAction(drawerAction);
    setDrawerInfo(drawerInfo);
    setDrawerOpen(true);
  };

  const closeAppDrawer = () => {
    setDrawerOpen(false);
  };

  const ctxvalue = {
    action: drawerAction,
    drawerOpen: drawerOpen,
    drawerInfo,
    openAppDrawer,
    openAppDrawerWithInfo,
    closeAppDrawer,
  };

  return (
    <appdrawerctx.Provider value={ctxvalue}>{children}</appdrawerctx.Provider>
  );
};

export const useAppDrawer = () => useContext<draerctxtype>(appdrawerctx);
