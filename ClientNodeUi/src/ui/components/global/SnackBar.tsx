import { JSX, Fragment } from "react";
import { Snackbar, IconButton } from "@mui/material";
import { useSnackbar } from "../../hooks/snackbar";
import { Check, Warning } from "../../assets/icons/actions";
import { colors } from "../../assets/colors";

export const SnackBar = (): JSX.Element => {
  const { snackbaropen, snackbarmsg, snacksuccess, hidesnackbar } =
    useSnackbar();

  const handleClose = () => {
    hidesnackbar();
  };

  const snackAction: JSX.Element = (
    <Fragment>
      <IconButton size="small" aria-label="close">
        {snacksuccess ? (
          <Check width={24} heigth={24} color={colors.success} />
        ) : (
          <Warning color={colors.danger} />
        )}
      </IconButton>
    </Fragment>
  );

  return (
    <Snackbar
      anchorOrigin={{ vertical: "top", horizontal: "right" }}
      open={snackbaropen}
      message={snackbarmsg}
      autoHideDuration={4000}
      onClose={handleClose}
      action={snackAction}
      slotProps={{
        clickAwayListener: { onClickAway: () => {}, disableReactTree: true },
      }}
      sx={{
        zIndex: 3500,
        "& .MuiSnackbarContent-root": {
          backgroundColor: colors.textprimary,
        },
      }}
    />
  );
};
