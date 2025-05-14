import { createContext, useContext, useState, ReactNode, JSX } from "react";

interface snackbarctxtype {
  snackbaropen: boolean;
  snackbarmsg: string;
  snacksuccess: boolean;
  showsuccesssnack: (snackmsg: string) => void;
  showerrorsnack: (snackmsg: string) => void;
  hidesnackbar: () => void;
}

const snackbarcontext = createContext<snackbarctxtype>({} as snackbarctxtype);

interface providerProps {
  children: ReactNode;
}

export const SnackBarProvider = ({ children }: providerProps): JSX.Element => {
  const [snackbaropen, setsnackbaropen] = useState<boolean>(false);
  const [snackbarmsg, setsnackbarmsg] = useState<string>("");
  const [snacksuccess, setsnacksuccess] = useState<boolean>(false);

  const showsuccesssnack = (snackmsg: string): void => {
    setsnackbaropen(true);
    setsnackbarmsg(snackmsg);
    setsnacksuccess(true);
  };

  const showerrorsnack = (snackmsg: string): void => {
    setsnackbaropen(true);
    setsnackbarmsg(snackmsg);
    setsnacksuccess(false);
  };

  const hidesnackbar = (): void => {
    setsnackbaropen(false);
    setsnackbarmsg("");
    setsnacksuccess(false);
  };

  const ctxvalue = {
    snackbaropen,
    setsnackbaropen,
    snackbarmsg,
    snacksuccess,
    showsuccesssnack,
    showerrorsnack,
    hidesnackbar,
  };

  return (
    <snackbarcontext.Provider value={ctxvalue}>
      {children}
    </snackbarcontext.Provider>
  );
};

export const useSnackbar = () => useContext<snackbarctxtype>(snackbarcontext);
