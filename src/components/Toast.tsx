import { useEffect, useState } from "react";
import styles from "../styles/toast.module.css";

interface ToastProps {
  playlistName: string;
  playlistArtwork: string;
  isVisible: boolean;
  onDismiss: () => void;
  action?: "add" | "remove";
  message?: string;
  artwork?: string;
}

const Toast = ({
  playlistName,
  playlistArtwork,
  isVisible,
  onDismiss,
  action = "add",
  message,
  artwork,
}: ToastProps) => {
  const [showToast, setShowToast] = useState(isVisible);
  const actionText = action === "add" ? "Added to" : "Removed from";
  const displayText = message || `${actionText} "${playlistName}"`;
  const displayArtwork = artwork || playlistArtwork;

  useEffect(() => {
    setShowToast(isVisible);

    if (isVisible) {
      // 0.4s fade in + 3s visible + 0.4s fade out = 3.8s total
      const timer = setTimeout(() => {
        setShowToast(false);
        onDismiss();
      }, 3800);

      return () => clearTimeout(timer);
    }
  }, [isVisible, onDismiss]);

  if (!showToast) return null;

  return (
    <div className={`${styles.toast} ${showToast ? styles.visible : ""}`}>
      <div className={styles.content}>
        <span className={styles.text}>{displayText}</span>
        {displayArtwork ? (
          <img
            src={displayArtwork}
            alt={playlistName || "Toast artwork"}
            className={styles.artwork}
          />
        ) : null}
      </div>
    </div>
  );
};

export default Toast;
