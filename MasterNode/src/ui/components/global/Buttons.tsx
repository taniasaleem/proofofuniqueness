import { CSSProperties, JSX, ReactNode, useState } from "react";
import { colors } from "../../assets/colors";

interface props {
  btnText: string;
  btnIcon?: ReactNode;
  isDisabled: boolean;
  onClickBtn: () => void | Promise<void>;
  xstyles?: CSSProperties;
}

export const SubmitButton = ({
  btnText,
  btnIcon,
  isDisabled,
  onClickBtn,
  xstyles,
}: props): JSX.Element => {
  const [isClicked, setIsClicked] = useState(false);

  const handleClick = async () => {
    if (isDisabled) return;

    setIsClicked(true);
    setTimeout(() => setIsClicked(false), 200); // Reset the click state after 200ms

    await onClickBtn(); // Ensure the button action is executed
  };

  return (
    <button
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        width: "100%",
        padding: "0.75rem",
        border: 0,
        borderRadius: "0.25rem",
        outline: "none",
        outlineColor: "transparent",
        fontSize: "1rem",
        fontWeight: "bold",
        color: isDisabled ? colors.textsecondary : colors.primary,
        backgroundColor: isDisabled
          ? colors.divider
          : isClicked
          ? colors.divider 
          : colors.accent,
        transition: "all ease-in-out 0.25s",
        cursor: isDisabled ? "not-allowed" : "pointer",
        ...xstyles,
      }}
      disabled={isDisabled}
      onClick={handleClick}
    >
      {btnText}
      {btnIcon}
    </button>
  );
};
