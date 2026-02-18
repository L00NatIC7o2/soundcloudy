"use client";

import { useCallback, useState, useRef, useMemo, useEffect } from "react";
import ReactDOM from "react-dom";
import Particles from "react-tsparticles";
import React from "react";
import { loadFull } from "tsparticles";
import type { Engine } from "tsparticles-engine";
import styles from "../src/styles/girlfriend-login.module.css";
import { useRouter } from "next/router";

const particlesInit = async (engine: Engine) => {
  await loadFull(engine);
};

const particlesOptions = {
  fullScreen: { enable: true, zIndex: 0 },
  fpsLimit: 60,
  interactivity: {
    events: {
      onHover: {
        enable: true,
        mode: "repulse",
      },
      resize: true,
    },
    modes: {
      repulse: {
        distance: 45,
        duration: 0.8,
        speed: 0.7,
      },
    },
  },
  particles: {
    number: {
      value: 90,
      density: { enable: true, area: 1200 },
    },
    shape: {
      type: ["image"],
      image: [
        { src: "/petal 1.png", width: 32, height: 32 },
        { src: "/petal 2.png", width: 32, height: 32 },
        { src: "/petal 3.png", width: 32, height: 32 },
        { src: "/petal 4.png", width: 32, height: 32 },
        { src: "/petal 5.png", width: 32, height: 32 },
      ],
    },
    opacity: {
      value: 0.95,
      random: { enable: true, minimumValue: 0.7 },
      animation: {
        enable: true,
        speed: 0.7,
        startValue: "min" as const,
        sync: false,
      },
    },
    size: {
      value: 90,
      random: { enable: true, minimumValue: 36 },
    },
    move: {
      enable: true,
      speed: 2.2,
      direction: "bottom" as const,
      straight: false,
      outModes: { default: "out" as const },
      gravity: { enable: false },
      angle: { value: 0, offset: 0 },
    },
    rotate: {
      value: 0,
      random: { enable: true, minimumValue: 0, maximumValue: 360 },
      animation: { enable: true, speed: 8, sync: false },
    },
  },
  detectRetina: true,
};

const PetalBackgroundPortal = React.memo(function PetalBackgroundPortal({
  show,
}: {
  show: boolean;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof window === "undefined") return null;

  return ReactDOM.createPortal(
    <div
      style={{
        opacity: show ? 1 : 0,
        pointerEvents: "none",
        position: "fixed",
        inset: 0,
        zIndex: 2,
        transition: "opacity 2s ease-in-out",
      }}
    >
      <Particles
        id="roses-particles"
        init={particlesInit}
        options={particlesOptions}
        style={{
          width: "100vw",
          height: "100vh",
          pointerEvents: "none",
        }}
      />
    </div>,
    document.body,
  );
});

interface GirlfriendUIProps {
  showWait: boolean;
  waitGlow: boolean;
  rosesOpacity: number;
  uiTransitioned: boolean;
  setUiTransitioned: React.Dispatch<React.SetStateAction<boolean>>;
  showQuestion: boolean;
  setShowQuestion: React.Dispatch<React.SetStateAction<boolean>>;
  showButtons: boolean;
  setShowButtons: React.Dispatch<React.SetStateAction<boolean>>;
  setShowWait: React.Dispatch<React.SetStateAction<boolean>>;
  setPetalsActive: React.Dispatch<React.SetStateAction<boolean>>;
  setLoginFadeOut: React.Dispatch<React.SetStateAction<boolean>>;
  loginFadeOut: boolean;
  router: any;
}

function GirlfriendUI({
  showWait,
  waitGlow,
  uiTransitioned,
  setUiTransitioned,
  showQuestion,
  setShowQuestion,
  showButtons,
  setShowButtons,
  setShowWait,
  setPetalsActive,
  setLoginFadeOut,
  loginFadeOut,
  router,
}: GirlfriendUIProps) {
  // --- State Hooks ---
  const [noDisintegrate, setNoDisintegrate] = useState(false);
  const [showAnniversary, setShowAnniversary] = useState(false);
  const [anniversaryInput, setAnniversaryInput] = useState({
    month: "",
    day: "",
    year: "",
  });
  const [anniversaryError, setAnniversaryError] = useState(false);
  const [petalsVisible, setPetalsVisible] = useState(true);
  const [audioVolume, setAudioVolume] = useState(0.5);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [showDialogue, setShowDialogue] = useState(false);
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [builtLines, setBuiltLines] = useState(0);
  const [isSpeedUp, setIsSpeedUp] = useState(false);
  const [dialogueFadeIn, setDialogueFadeIn] = useState(false);
  const [lineCharCounts, setLineCharCounts] = useState([0, 0]);
  const buildTimeout = useRef<NodeJS.Timeout | null>(null);
  const [showValentine, setShowValentine] = useState(false);
  const [showValentineConfirm, setShowValentineConfirm] = useState(false);
  const [thankYouLine, setThankYouLine] = useState(0);
  const [valentineAnswered, setValentineAnswered] = useState<null | boolean>(
    null,
  );
  const [showFinal, setShowFinal] = useState(false);
  const [showLoveScreen, setShowLoveScreen] = useState(false);
  const [showRegularLogin, setShowRegularLogin] = useState(false);

  // New states for the single-line typewriter and skip feature
  const [confirmCharIdx, setConfirmCharIdx] = useState(0);
  const [finalCharIdx, setFinalCharIdx] = useState(0);

  const dialogueLines = useMemo(
    () => [
      "Harleen...",
      "You are my most prized posession, there isnt a value that I would apply to you.",
      "Your are like no one else in this world, you are you.",
      "A girl who shouldn't had gone through so much.",
      "A girl who should've been treated better by those she loved.",
      "A girl whose love and understanding is above all.",
      "A girl who is so beautiful inside and out, is above her class in every way, wants a future, and most importantly has a pure heart and soul.",
      "A girl who set her struggles aside to give a boy a chance.",
      "For a boy who fell in love with a girl.",
      "A boy who wanted to learn everything about this girl because it seemed right.",
      "A boy that felt she wouldn't had loved him becuase of who he was.",
      "A boy that knew that he was different to the rest, but always offered his complete attention and care in ways that maybe would've meant more.",
      "This boy knew she deserved the world but would overthink things because he was scared of failure.",
      "But this girl made him realize that she will be there for him for every attempt.",
      "This girl only wants this boy in her future.",
      "So I say this from the deepest part of me, thank you",
      "You are unlike any other woman in my life.",
      "We were strangers just a year ago, just friends a few months ago, and now you are the person who believes in me the most.",
      "The person who loves me the most.",
      "I am sorry for not trusting in myself more for you.",
      "Im sorry for not making you feel more loved.",
      "Im sorry for not making you feel like the woman you are.",
      "I will be the man you want me to be, the man I should be.",
      "For us, I love you so much.",
    ],
    [],
  );

  const confirmationLines = useMemo(
    () => [
      "Thank you.",
      "This will be the worse valentines.",
      "Only because each one after this will be even better.",
      "I will have your gift in a few days.",
      "But. A hint is what has been playing throughout the whole time. :)",
    ],
    [],
  );

  const finalLoveText =
    "I looooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooovvvvvvvvvvvvvvvvvvvvvvveeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee youuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu sooooooooooooooooooooooooooooooooooooooooooooooooooo muchhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh.";

  // --- Effects ---
  useEffect(() => {
    if (showWait && !showRegularLogin) {
      if (audioRef.current) {
        audioRef.current.volume = audioVolume;
        audioRef.current.play().catch(() => {});
      }
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  }, [showWait, showRegularLogin, audioVolume]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = audioVolume;
    }
  }, [audioVolume]);

  // Main Dialogue Typewriter
  useEffect(() => {
    if (!showDialogue) return;
    if (builtLines >= 2) return;
    if (buildTimeout.current) clearTimeout(buildTimeout.current);
    const idx = dialogueIndex + builtLines;
    if (idx >= dialogueLines.length) return;
    const line = dialogueLines[idx];
    const charCount = lineCharCounts[builtLines];
    if (charCount < line.length) {
      buildTimeout.current = setTimeout(
        () => {
          setLineCharCounts((prev) => {
            const next = [...prev];
            next[builtLines] = prev[builtLines] + 1;
            return next;
          });
        },
        isSpeedUp ? 12 : 38,
      );
    } else {
      buildTimeout.current = setTimeout(
        () => {
          setBuiltLines((prev) => Math.min(prev + 1, 2));
        },
        isSpeedUp ? 200 : 500,
      );
    }
    return () => {
      if (buildTimeout.current) clearTimeout(buildTimeout.current);
    };
  }, [
    showDialogue,
    builtLines,
    isSpeedUp,
    dialogueIndex,
    lineCharCounts,
    dialogueLines,
  ]);

  // Typewriter for Confirmation Screen (Black Screen)
  useEffect(() => {
    if (!showValentineConfirm) return;
    const currentLineText = confirmationLines[thankYouLine];
    if (confirmCharIdx < currentLineText.length) {
      const timeout = setTimeout(() => {
        setConfirmCharIdx((prev) => prev + 1);
      }, 40);
      return () => clearTimeout(timeout);
    }
  }, [showValentineConfirm, thankYouLine, confirmCharIdx, confirmationLines]);

  // Typewriter for Final "I Love You" Screen
  useEffect(() => {
    if (!showFinal) return;
    if (finalCharIdx < finalLoveText.length) {
      const timeout = setTimeout(() => {
        setFinalCharIdx((prev) => prev + 1);
      }, 30);
      return () => clearTimeout(timeout);
    }
  }, [showFinal, finalCharIdx]);

  // --- Handlers ---
  const handleLoginClick = () => {
    setLoginFadeOut(true);
    setShowWait(true);
    setPetalsActive(true);
  };

  const handleWaitClick = () => {
    if (!waitGlow) return;
    setUiTransitioned(true);
    setShowQuestion(true);
    setTimeout(() => setShowButtons(true), 900);
  };

  const handleYesClick = () => {
    setShowAnniversary(true);
    setShowQuestion(false);
    setShowButtons(false);
  };

  const handleAnniversarySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { month, day, year } = anniversaryInput;
    if (month === "07" && day === "02" && year === "2025") {
      setAnniversaryError(false);
      setShowAnniversary(false);
      setShowDialogue(true);
      setDialogueIndex(0);
      setBuiltLines(0);
      setDialogueFadeIn(false);
      setLineCharCounts([0, 0]);
      setTimeout(() => setDialogueFadeIn(true), 50);
    } else {
      setAnniversaryError(true);
      setPetalsVisible(false);
    }
  };

  const handleDialogueClick = () => {
    if (showValentine || showFinal) return;
    if (lineCharCounts[0] < (dialogueLines[dialogueIndex] || "").length) return;
    if (
      builtLines > 1 &&
      lineCharCounts[1] < (dialogueLines[dialogueIndex + 1] || "").length
    )
      return;

    if (dialogueIndex + builtLines >= dialogueLines.length) {
      setShowDialogue(false);
      setShowValentine(true);
      return;
    }
    setDialogueIndex((prev) => prev + builtLines);
    setBuiltLines(0);
    setLineCharCounts([0, 0]);
  };

  return (
    <>
      <audio
        ref={audioRef}
        src="/Love In The Sky.mp3"
        loop
        style={{ display: "none" }}
        preload="auto"
      />

      {/* Volume slider */}
      {showWait && !showRegularLogin && (
        <div
          style={{
            position: "fixed",
            bottom: 32,
            left: 32,
            zIndex: 200,
            background: "rgba(0,0,0,0.7)",
            borderRadius: 16,
            padding: "0.7rem 1.6rem",
            display: "flex",
            alignItems: "center",
            gap: 12,
            boxShadow: "0 0 12px #d14b7a",
          }}
        >
          <span
            style={{
              color: "#d14b7a",
              fontWeight: 600,
              fontSize: 16,
              marginRight: 8,
            }}
          >
            Volume
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={audioVolume}
            onChange={(e) => setAudioVolume(Number(e.target.value))}
            style={{ width: 120 }}
          />
        </div>
      )}

      {/* Final Love Screen - I Looooove You */}
      {showFinal && !showLoveScreen && !showRegularLogin && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 100,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            background: "rgba(0,0,0,0.9)",
            textAlign: "center",
            cursor: "pointer",
            padding: "0 20px",
          }}
          onClick={() => {
            if (finalCharIdx < finalLoveText.length) {
              setFinalCharIdx(finalLoveText.length);
            }
          }}
        >
          <div
            style={{
              marginBottom: 32,
              maxWidth: "800px",
              fontSize: "1.8rem",
              fontWeight: 600,
              wordWrap: "break-word",
            }}
          >
            {finalLoveText.substring(0, finalCharIdx)}
          </div>
          {finalCharIdx >= finalLoveText.length && (
            <button
              className={styles.glassLoginBtn}
              style={{ fontSize: "1.3rem", padding: "0.8rem 2.2rem" }}
              onClick={(e) => {
                e.stopPropagation();
                setShowFinal(false);
                setShowLoveScreen(true);
                router.replace("/login");
              }}
            >
              Continue
            </button>
          )}
        </div>
      )}

      {/* Dialogue step */}
      {showDialogue &&
        !showValentine &&
        !showFinal &&
        !showLoveScreen &&
        !showRegularLogin && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100vw",
              minHeight: "100vh",
              zIndex: 10,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: "1.5rem",
              fontWeight: 500,
              background: "rgba(0,0,0,0.2)",
              cursor: "pointer",
              transition: "opacity 0.7s cubic-bezier(.4,0,.2,1)",
              opacity: dialogueFadeIn ? 1 : 0,
            }}
            onClick={handleDialogueClick}
          >
            <div
              style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}
            >
              {Array.from({ length: 2 }).map((_, i) => {
                const line = dialogueLines[dialogueIndex + i];
                if (!line) return null;
                return (
                  <div key={i} style={{ marginBottom: 16 }}>
                    {line.slice(0, lineCharCounts[i])}
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 24, fontSize: 18, color: "#d14b7a" }}>
              {dialogueIndex + builtLines >= dialogueLines.length - 1 &&
              builtLines >= 1
                ? "Click to continue"
                : ""}
            </div>
          </div>
        )}

      {/* Valentine step */}
      {showValentine &&
        !showValentineConfirm &&
        !showFinal &&
        !showLoveScreen &&
        !showRegularLogin && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100vw",
              minHeight: "100vh",
              zIndex: 10,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: "2rem",
              fontWeight: 600,
              background: "rgba(0,0,0,0.2)",
              textAlign: "center",
            }}
          >
            <div style={{ marginBottom: 32 }}>Will you be my valentine?</div>
            <div style={{ display: "flex", gap: 32 }}>
              <button
                className={styles.glassLoginBtn}
                style={{ fontSize: "1.3rem", padding: "0.8rem 2.2rem" }}
                onClick={() => {
                  setValentineAnswered(true);
                  setShowValentineConfirm(true);
                  setShowValentine(false);
                  setThankYouLine(0);
                  setConfirmCharIdx(0);
                }}
              >
                Yes
              </button>
              <button
                className={styles.glassLoginBtn}
                style={{ fontSize: "1.3rem", padding: "0.8rem 2.2rem" }}
                onClick={() => {
                  setValentineAnswered(false);
                  setShowValentineConfirm(true);
                  setShowValentine(false);
                  setThankYouLine(0);
                  setConfirmCharIdx(0);
                }}
              >
                No
              </button>
            </div>
          </div>
        )}

      {/* Valentine confirmation step (Black Screen - One line at a time + skip) */}
      {showValentineConfirm &&
        !showFinal &&
        !showLoveScreen &&
        !showRegularLogin && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              zIndex: 100,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: "2rem",
              fontWeight: 600,
              background: "#000",
              textAlign: "center",
              cursor: "pointer",
              padding: "20px",
            }}
            onClick={() => {
              const currentLineText = confirmationLines[thankYouLine];
              // If current line isn't finished, skip typing to the end
              if (confirmCharIdx < currentLineText.length) {
                setConfirmCharIdx(currentLineText.length);
              } else {
                // If line IS finished, go to next line or finish
                if (thankYouLine < confirmationLines.length - 1) {
                  setThankYouLine(thankYouLine + 1);
                  setConfirmCharIdx(0);
                } else {
                  setShowValentineConfirm(false);
                  setShowFinal(true);
                }
              }
            }}
          >
            <div style={{ maxWidth: "800px", lineHeight: "1.4" }}>
              {confirmationLines[thankYouLine].substring(0, confirmCharIdx)}
            </div>

            {confirmCharIdx >= confirmationLines[thankYouLine].length && (
              <div
                style={{
                  fontSize: "1.1rem",
                  color: "#d14b7a",
                  marginTop: 40,
                }}
              >
                Click to continue
              </div>
            )}
          </div>
        )}

      {/* Login button */}
      {!showQuestion &&
        !showWait &&
        !showAnniversary &&
        !anniversaryError &&
        !showDialogue &&
        !showValentine &&
        !showFinal &&
        !showLoveScreen &&
        !showRegularLogin && (
          <button
            className={styles.glassLoginBtn}
            style={{
              position: "relative",
              opacity: loginFadeOut ? 0 : 1,
              transition:
                "opacity 0.7s cubic-bezier(.4,0,.2,1), background 0.4s cubic-bezier(.4,0,.2,1), color 0.4s cubic-bezier(.4,0,.2,1), box-shadow 0.4s cubic-bezier(.4,0,.2,1)",
            }}
            onClick={handleLoginClick}
          >
            Login
          </button>
        )}

      {/* Wait text */}
      {!showQuestion &&
        showWait &&
        !showAnniversary &&
        !anniversaryError &&
        !showDialogue &&
        !showValentine &&
        !showFinal &&
        !showLoveScreen &&
        !showRegularLogin && (
          <div
            style={{
              position: "relative",
              color: "#fff",
              fontSize: "1.4rem",
              fontWeight: 500,
              marginTop: "2rem",
              cursor: waitGlow ? "pointer" : "default",
              textShadow: waitGlow
                ? "0 0 32px #d14b7a, 0 0 24px #d14b7a, 0 2px 16px #d14b7a, 0 1px 2px #000"
                : "0 2px 16px #d14b7a, 0 1px 2px #000",
              transition: "text-shadow 0.7s cubic-bezier(.4,0,.2,1)",
            }}
            onClick={waitGlow ? handleWaitClick : undefined}
          >
            wait
          </div>
        )}

      {/* Question */}
      {showQuestion &&
        !showAnniversary &&
        !anniversaryError &&
        !showDialogue &&
        !showValentine &&
        !showFinal &&
        !showLoveScreen &&
        !showRegularLogin && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "100vh",
              position: "absolute",
              top: 0,
              left: 0,
              width: "100vw",
              zIndex: 3,
            }}
          >
            <div
              style={{
                opacity: showQuestion ? 1 : 0,
                fontSize: "2.2rem",
                color: "#fff",
                marginBottom: "2rem",
                fontWeight: 600,
                textShadow: "0 2px 16px #d14b7a, 0 1px 2px #000",
              }}
            >
              Are you my girlfriend?
            </div>
            <div style={{ display: "flex", gap: "2rem", minHeight: "56px" }}>
              <button
                className={styles.glassLoginBtn}
                style={{
                  fontSize: "1.2rem",
                  padding: "0.8rem 2.2rem",
                  opacity: showButtons ? 1 : 0,
                }}
                disabled={!showButtons}
                onClick={handleYesClick}
              >
                Yes
              </button>
              <button
                className={styles.glassLoginBtn}
                style={{
                  fontSize: "1.2rem",
                  padding: "0.8rem 2.2rem",
                  opacity: showButtons ? (noDisintegrate ? 0 : 1) : 0,
                  transform: noDisintegrate
                    ? "scale(1.2) rotate(-12deg) skewX(8deg)"
                    : "none",
                  pointerEvents:
                    showButtons && !noDisintegrate ? "auto" : "none",
                  transition: "all 0.7s cubic-bezier(.4,0,.2,1)",
                }}
                onMouseEnter={() => {
                  if (showButtons && !noDisintegrate) {
                    setTimeout(() => setNoDisintegrate(true), 10);
                  }
                }}
                disabled={!showButtons || noDisintegrate}
              >
                No
              </button>
            </div>
          </div>
        )}

      {/* Anniversary form */}
      {showAnniversary &&
        !anniversaryError &&
        !showDialogue &&
        !showValentine &&
        !showFinal &&
        !showLoveScreen && (
          <form
            onSubmit={handleAnniversarySubmit}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "100vh",
              position: "absolute",
              top: 0,
              left: 0,
              width: "100vw",
              zIndex: 3,
              color: "#fff",
            }}
          >
            <div
              style={{
                fontSize: "2rem",
                marginBottom: "1.5rem",
                fontWeight: 600,
              }}
            >
              When's our anniversary?
            </div>
            <div
              style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}
            >
              <input
                type="text"
                placeholder="MM"
                maxLength={2}
                value={anniversaryInput.month}
                onChange={(e) =>
                  setAnniversaryInput({
                    ...anniversaryInput,
                    month: e.target.value,
                  })
                }
                style={{
                  width: 40,
                  textAlign: "center",
                  fontSize: "1.2rem",
                  borderRadius: 8,
                  border: "1px solid #d14b7a",
                  padding: 6,
                  color: "#000",
                }}
                required
              />
              <span style={{ fontSize: "1.2rem" }}>/</span>
              <input
                type="text"
                placeholder="DD"
                maxLength={2}
                value={anniversaryInput.day}
                onChange={(e) =>
                  setAnniversaryInput({
                    ...anniversaryInput,
                    day: e.target.value,
                  })
                }
                style={{
                  width: 40,
                  textAlign: "center",
                  fontSize: "1.2rem",
                  borderRadius: 8,
                  border: "1px solid #d14b7a",
                  padding: 6,
                  color: "#000",
                }}
                required
              />
              <span style={{ fontSize: "1.2rem" }}>/</span>
              <input
                type="text"
                placeholder="YYYY"
                maxLength={4}
                value={anniversaryInput.year}
                onChange={(e) =>
                  setAnniversaryInput({
                    ...anniversaryInput,
                    year: e.target.value,
                  })
                }
                style={{
                  width: 70,
                  textAlign: "center",
                  fontSize: "1.2rem",
                  borderRadius: 8,
                  border: "1px solid #d14b7a",
                  padding: 6,
                  color: "#000",
                }}
                required
              />
            </div>
            <button
              type="submit"
              className={styles.glassLoginBtn}
              style={{
                fontSize: "1.1rem",
                padding: "0.7rem 2rem",
                marginTop: 8,
              }}
            >
              Submit
            </button>
          </form>
        )}
    </>
  );
}

export default function GirlfriendLogin({ onDone }: { onDone?: () => void }) {
  const [uiTransitioned, setUiTransitioned] = useState(false);
  const [showWait, setShowWait] = useState(false);
  const [waitGlow, setWaitGlow] = useState(false);
  const [petalsActive, setPetalsActive] = useState(false);
  const [showQuestion, setShowQuestion] = useState(false);
  const [showButtons, setShowButtons] = useState(false);
  const [loginFadeOut, setLoginFadeOut] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (showWait) {
      const glowTimeout = setTimeout(() => {
        setWaitGlow(true);
      }, 3000);
      return () => clearTimeout(glowTimeout);
    }
  }, [showWait]);

  return (
    <>
      <PetalBackgroundPortal show={petalsActive} />
      <div
        className={styles.bgBlackFull}
        style={{
          background: "#000",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <GirlfriendUI
          showWait={showWait}
          waitGlow={waitGlow}
          rosesOpacity={0}
          uiTransitioned={uiTransitioned}
          setUiTransitioned={setUiTransitioned}
          showQuestion={showQuestion}
          setShowQuestion={setShowQuestion}
          showButtons={showButtons}
          setShowButtons={setShowButtons}
          setShowWait={setShowWait}
          setPetalsActive={setPetalsActive}
          setLoginFadeOut={setLoginFadeOut}
          loginFadeOut={loginFadeOut}
          router={router}
        />
      </div>
    </>
  );
}
