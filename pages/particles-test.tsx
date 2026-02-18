import Particles from "react-tsparticles";

export default function ParticlesTest() {
  return (
    <div
      style={{
        width: 400,
        height: 400,
        background: "#222",
        position: "relative",
      }}
    >
      <Particles
        id="test-particles"
        options={{
          fullScreen: { enable: false },
          fpsLimit: 60,
          particles: {
            number: { value: 20 },
            shape: { type: "circle" },
            color: { value: "#ff69b4" },
            size: { value: 30 },
            move: { enable: true, speed: 2, direction: "bottom" },
          },
        }}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,255,0.2)",
        }}
      />
    </div>
  );
}
