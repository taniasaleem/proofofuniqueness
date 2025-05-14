import { JSX, CSSProperties } from "react";
import { Drawer } from "@mui/material";
import { useAppDrawer } from "../../hooks/drawer";
import { NodeDetails } from "../masternode/NodeDetails";
import { colors } from "../../assets/colors";

export const AppDrawer = (): JSX.Element => {
  const { drawerOpen, closeAppDrawer } = useAppDrawer();

  return (
    <Drawer
      anchor={"bottom"}
      elevation={0}
      PaperProps={{ sx: drawerstyles }}
      open={drawerOpen}
      onClose={closeAppDrawer}
    >
      <NodeDetails />
    </Drawer>
  );
};

const drawerstyles: CSSProperties = {
  width: "30vw",
  height: "60vh",
  position: "fixed",
  left: "69vw",
  bottom: "1rem",
  borderRadius: "0.625rem",
  backgroundColor: colors.divider,
  zIndex: 4000,
};
