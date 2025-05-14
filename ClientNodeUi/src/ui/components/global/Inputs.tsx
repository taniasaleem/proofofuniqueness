import {
  CSSProperties,
  Dispatch,
  JSX,
  SetStateAction,
  HTMLInputTypeAttribute,
} from "react";
import { TextField } from "@mui/material";
import { colors } from "../../assets/colors";

interface props {
  muiLabel: string;
  placeholder: string;
  inputValue: string;
  setInputValue: Dispatch<SetStateAction<string>>;
  inputType: HTMLInputTypeAttribute;
  isDisabled?: boolean;
  xstyles?: CSSProperties;
}

export const TextInput = ({
  muiLabel,
  placeholder,
  inputValue,
  setInputValue,
  inputType,
  isDisabled,
  xstyles,
}: props): JSX.Element => {
  return (
    <TextField
      value={inputValue}
      onChange={(ev) => setInputValue(ev.target.value)}
      label={muiLabel}
      placeholder={placeholder}
      fullWidth
      variant="outlined"
      autoComplete="off"
      type={inputType}
      disabled={isDisabled}
      sx={{
        "& .MuiOutlinedInput-root": {
          "& fieldset": {
            borderColor: colors.divider,
          },
          "& input": {
            color: colors.textprimary,
          },
          "&::placeholder": {
            color: colors.textsecondary,
            opacity: 1,
          },
        },
        "& .MuiInputLabel-root": {
          color: colors.textsecondary,
          fontSize: "0.875rem",
        },
        "& .MuiInputLabel-root.Mui-focused": {
          color: colors.accent,
        },
        marginTop: "1rem",
        ...xstyles,
      }}
    />
  );
};

export const MultiLineTextInput = ({
  muiLabel,
  placeholder,
  inputValue,
  setInputValue,
  inputType,
  isDisabled,
  xstyles,
}: props): JSX.Element => {
  return (
    <TextField
      value={inputValue}
      onChange={(ev) => setInputValue(ev.target.value)}
      label={muiLabel}
      placeholder={placeholder}
      fullWidth
      variant="outlined"
      autoComplete="off"
      type={inputType}
      disabled={isDisabled}
      multiline
      rows={8}
      sx={{
        "& .MuiOutlinedInput-root": {
          "& fieldset": {
            borderColor: colors.divider,
          },
          "& textarea": {
            color: colors.textprimary,
          },
          "& .MuiOutlinedInput-input::placeholder": {
            color: colors.textsecondary,
            opacity: 1,
          },
        },
        "& .MuiInputLabel-root": {
          color: colors.textsecondary,
          fontSize: "0.875rem",
        },
        "& .MuiInputLabel-root.Mui-focused": {
          color: colors.accent,
        },
        marginTop: "1rem",
        resize: "none",
        ...xstyles,
      }}
    />
  );
};
