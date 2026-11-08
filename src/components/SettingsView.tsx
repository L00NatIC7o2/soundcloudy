import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

export type AppTheme = "default" | "midnight" | "light";
type Equalizer = {
  enabled: boolean;
  low: number;
  lowMid: number;
  mid: number;
  highMid: number;
  high: number;
};

const bands = [
  { label: "Sub", frequency: 60, key: "low" },
  { label: "Bass", frequency: 250, key: "lowMid" },
  { label: "Mid", frequency: 1000, key: "mid" },
  { label: "Presence", frequency: 4000, key: "highMid" },
  { label: "Treble", frequency: 12000, key: "high" },
] as const;

const plot = { left: 42, right: 958, top: 28, bottom: 228 };
const gainY = (gain: number) => plot.top + ((12 - gain) / 24) * (plot.bottom - plot.top);
const frequencyX = (frequency: number) =>
  plot.left + (Math.log10(frequency / 20) / 3) * (plot.right - plot.left);
const clampGain = (gain: number) => Math.max(-12, Math.min(12, gain));

function SettingsCheckbox({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <span className={`settings-checkbox ${disabled ? "is-disabled" : ""}`}>
      <input
        className="settings-checkbox-input"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={label}
        disabled={disabled}
      />
      <span className="settings-checkbox-box" aria-hidden="true">
        <img src="https://img.icons8.com/?size=100&id=7l0oBwcrSB6W&format=png&color=000000" alt="" />
      </span>
    </span>
  );
}

function EqualizerGraph({
  equalizer,
  onChange,
  spectrum,
}: {
  equalizer: Equalizer;
  onChange: (value: Equalizer) => void;
  spectrum: number[];
}) {
  const [dragging, setDragging] = useState<keyof Equalizer | null>(null);
  const frequencies = useMemo(
    () => Array.from({ length: 161 }, (_, index) => 20 * 10 ** (index * (3 / 160))),
    [],
  );
  const response = useMemo(() => {
    const smooth = (value: number) => {
      const t = Math.max(0, Math.min(1, value));
      return t * t * (3 - 2 * t);
    };
    const points = frequencies.map((frequency) => {
      const lowShelf = 1 - smooth((Math.log2(frequency / 60) + 1.2) / 2.4);
      const highShelf = smooth((Math.log2(frequency / 12000) + 1.2) / 2.4);
      const bell = (center: number, gain: number) =>
        gain * Math.exp(-0.5 * (Math.log2(frequency / center) / 0.8) ** 2);
      const gain =
        equalizer.low * lowShelf +
        bell(250, equalizer.lowMid) +
        bell(1000, equalizer.mid) +
        bell(4000, equalizer.highMid) +
        equalizer.high * highShelf;
      return { x: frequencyX(frequency), y: gainY(clampGain(gain)) };
    });
    const path = points
      .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
      .join(" ");
    return { path, area: `${path} L${plot.right},${gainY(0)} L${plot.left},${gainY(0)} Z` };
  }, [equalizer, frequencies]);

  const updateFromPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!dragging) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const viewBoxY = ((event.clientY - bounds.top) / bounds.height) * 260;
    const gain = clampGain(12 - ((viewBoxY - plot.top) / (plot.bottom - plot.top)) * 24);
    onChange({ ...equalizer, [dragging]: Math.round(gain) });
  };

  const ticks = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
  const gainTicks = [12, 6, 0, -6, -12];

  return (
    <div className={`settings-eq ${equalizer.enabled ? "is-enabled" : ""}`}>
      <svg
        className="settings-eq-graph"
        viewBox="0 0 1000 260"
        role="group"
        aria-label="Five-band graphic equalizer. Drag a colored control point vertically to adjust its gain."
        onPointerMove={updateFromPointer}
        onPointerUp={() => setDragging(null)}
        onPointerCancel={() => setDragging(null)}
      >
        {gainTicks.map((gain) => (
          <g key={gain}>
            <line x1={plot.left} x2={plot.right} y1={gainY(gain)} y2={gainY(gain)} className={gain === 0 ? "eq-zero-line" : "eq-grid-line"} />
            <text x="8" y={gainY(gain) + 4} className="eq-axis-label" textAnchor="start">{gain > 0 ? "+" : ""}{gain}</text>
            <text x="992" y={gainY(gain) + 4} className="eq-axis-label" textAnchor="end">{gain > 0 ? "+" : ""}{gain} dB</text>
          </g>
        ))}

        {ticks.map((frequency) => {
          const x = frequencyX(frequency);
          const label = frequency >= 1000 ? `${frequency / 1000}k` : String(frequency);
          return (
            <g key={frequency}>
              <line x1={x} x2={x} y1={plot.top} y2={plot.bottom} className="eq-grid-line" />
              <text x={x} y="252" className="eq-axis-label" textAnchor="middle">{label}</text>
            </g>
          );
        })}

        {spectrum.map((level, index) => {
          const count = Math.max(1, spectrum.length);
          const x = plot.left + ((index + 0.5) / count) * (plot.right - plot.left);
          const width = Math.max(2, (plot.right - plot.left) / count - 3);
          const height = Math.max(1, Math.min(82, level * 82));
          return <rect key={index} x={x - width / 2} y={plot.bottom - height} width={width} height={height} rx="2" className="eq-spectrum-bar" />;
        })}

        <path d={response.area} fill="rgba(255,255,255,0.08)" className="eq-response-area" />
        <path d={response.path} fill="none" stroke="rgba(255,255,255,0.94)" strokeWidth="2.5" strokeLinejoin="round" className="eq-response-line" />

        {bands.map((band) => {
          const gain = equalizer[band.key];
          const x = frequencyX(band.frequency);
          const y = gainY(gain);
          return (
            <g key={band.key}>
              <line x1={x} x2={x} y1={gainY(0)} y2={y} stroke="white" strokeOpacity="0.32" strokeDasharray="3 4" />
              <circle
                cx={x}
                cy={y}
                r="8"
                fill="white"
                className="eq-control-point"
                tabIndex={0}
                role="slider"
                aria-label={`${band.label}, ${equalizer[band.key]} decibels`}
                aria-valuemin={-12}
                aria-valuemax={12}
                aria-valuenow={equalizer[band.key]}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setDragging(band.key);
                }}
                onClick={(event) => {
                  if (event.detail < 2) return;
                  event.preventDefault();
                  event.stopPropagation();
                  setDragging(null);
                  onChange({ ...equalizer, [band.key]: 0 });
                }}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setDragging(null);
                  onChange({ ...equalizer, [band.key]: 0 });
                }}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                  event.preventDefault();
                  onChange({ ...equalizer, [band.key]: clampGain(equalizer[band.key] + (event.key === "ArrowUp" ? 1 : -1)) });
                }}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function SettingsView({
  autoplayNext,
  onAutoplayNextChange,
  crossfadeEnabled,
  onCrossfadeEnabledChange,
  crossfadeDuration,
  onCrossfadeDurationChange,
  theme,
  onThemeChange,
  equalizer,
  onEqualizerChange,
  spectrum,
  animateAlbumBackground,
  onAnimateAlbumBackgroundChange,
  staticBackgroundColor,
  onStaticBackgroundColorChange,
  checkUpdatesOnStartup,
  onCheckUpdatesOnStartupChange,
  automaticUpdates,
  onAutomaticUpdatesChange,
  updateStatus,
  onCheckForUpdates,
  onDownloadUpdate,
  onInstallUpdate,
  animateAlbumArtWhenInactive,
  onAnimateAlbumArtWhenInactiveChange,
}: {
  autoplayNext: boolean;
  onAutoplayNextChange: (enabled: boolean) => void;
  crossfadeEnabled: boolean;
  onCrossfadeEnabledChange: (enabled: boolean) => void;
  crossfadeDuration: number;
  onCrossfadeDurationChange: (seconds: number) => void;
  theme: AppTheme;
  onThemeChange: (theme: AppTheme) => void;
  equalizer: Equalizer;
  onEqualizerChange: (equalizer: Equalizer) => void;
  spectrum: number[];
  animateAlbumBackground: boolean;
  onAnimateAlbumBackgroundChange: (enabled: boolean) => void;
  staticBackgroundColor: string;
  onStaticBackgroundColorChange: (color: string) => void;
  checkUpdatesOnStartup: boolean;
  onCheckUpdatesOnStartupChange: (enabled: boolean) => void;
  automaticUpdates: boolean;
  onAutomaticUpdatesChange: (enabled: boolean) => void;
  updateStatus: string;
  onCheckForUpdates: () => void;
  onDownloadUpdate: () => void;
  onInstallUpdate: () => void;
  animateAlbumArtWhenInactive: boolean;
  onAnimateAlbumArtWhenInactiveChange: (enabled: boolean) => void;
}) {
  const staticBackgroundCommitTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  useEffect(
    () => () => {
      if (staticBackgroundCommitTimer.current) {
        clearTimeout(staticBackgroundCommitTimer.current);
      }
    },
    [],
  );

  return (
    <div className="settings-view">
      <header className="settings-header">
        <p className="settings-eyebrow">Personalize your listening</p>
        <h1>Settings</h1>
      </header>

      <section className="settings-card">
        <div className="settings-card-heading">
          <h2>Playback</h2>
          <p>Choose what happens when a track finishes.</p>
        </div>
        <label className="settings-toggle-row">
          <span><strong>Autoplay next track</strong><small>Continue to the next track in your current queue.</small></span>
          <SettingsCheckbox checked={autoplayNext} onChange={onAutoplayNextChange} label="Autoplay next track" />
        </label>
        <div className="settings-disabled-row">
          <span><strong>Crossfade</strong><small>Overlap queued tracks. Requires Autoplay next.</small></span>
          <SettingsCheckbox checked={crossfadeEnabled} onChange={onCrossfadeEnabledChange} label="Enable crossfade" disabled={!autoplayNext} />
        </div>
        <label className={`settings-crossfade-duration ${crossfadeEnabled && autoplayNext ? "" : "is-disabled"}`}>
          <span><strong>Crossfade duration</strong><small>{crossfadeDuration} seconds</small></span>
          <input
            type="range"
            min="1"
            max="12"
            step="1"
            value={crossfadeDuration}
            disabled={!crossfadeEnabled || !autoplayNext}
            aria-label="Crossfade duration in seconds"
            onChange={(event) => onCrossfadeDurationChange(Number(event.target.value))}
          />
        </label>
      </section>

      <section className="settings-card">
        <div className="settings-card-heading">
          <h2>Sound</h2>
          <p>Audio effects and playback integrations.</p>
        </div>
        <div className="settings-disabled-row settings-eq-heading">
          <span><strong>Equalizer</strong><small>Shape the sound across five frequency bands.</small></span>
          <SettingsCheckbox
            checked={equalizer.enabled}
            onChange={(enabled) => onEqualizerChange({ ...equalizer, enabled })}
            label="Enable equalizer"
          />
        </div>
        <EqualizerGraph equalizer={equalizer} onChange={onEqualizerChange} spectrum={spectrum} />
        <div className="settings-disabled-row">
          <span><strong>Scrobbling</strong><small>Send your listening history to Last.fm.</small></span>
          <span className="settings-coming-soon">Coming soon</span>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card-heading">
          <h2>Appearance</h2>
          <p>Choose the color theme and background style for Soundcloudy.</p>
        </div>
        <label className="settings-select-row" htmlFor="settings-theme">
          <span><strong>Theme</strong></span>
          <select id="settings-theme" value={theme} onChange={(event) => onThemeChange(event.target.value as AppTheme)}>
            <option value="default">Soundcloudy</option>
            <option value="midnight">Midnight</option>
            <option value="light">Light</option>
          </select>
        </label>
        <label className="settings-toggle-row">
          <span><strong>Animated album-art background</strong><small>Use the current track artwork as a moving background.</small></span>
          <SettingsCheckbox
            checked={animateAlbumBackground}
            onChange={onAnimateAlbumBackgroundChange}
            label="Animated album-art background"
          />
        </label>
        <label className="settings-select-row" htmlFor="settings-static-background-color">
          <span><strong>Static background color</strong><small>Used when the animated background is off.</small></span>
          <input
            id="settings-static-background-color"
            className="settings-color-input"
            type="color"
            defaultValue={staticBackgroundColor}
            disabled={animateAlbumBackground}
            onChange={(event) => {
              const color = event.currentTarget.value;
              if (staticBackgroundCommitTimer.current) {
                clearTimeout(staticBackgroundCommitTimer.current);
              }
              staticBackgroundCommitTimer.current = setTimeout(() => {
                onStaticBackgroundColorChange(color);
                staticBackgroundCommitTimer.current = null;
              }, 400);
            }}
            onBlur={(event) => {
              if (staticBackgroundCommitTimer.current) {
                clearTimeout(staticBackgroundCommitTimer.current);
                staticBackgroundCommitTimer.current = null;
              }
              const color = event.currentTarget.value;
              if (color !== staticBackgroundColor) {
                onStaticBackgroundColorChange(color);
              }
            }}
            aria-label="Static background color"
          />
        </label>
        <label className="settings-toggle-row">
          <span><strong>Animate album background when inactive</strong><small>Keep the cover background moving while the app is minimized or unfocused.</small></span>
          <SettingsCheckbox
            checked={animateAlbumArtWhenInactive}
            onChange={onAnimateAlbumArtWhenInactiveChange}
            label="Animate album background when inactive"
          />
        </label>
      </section>

      <section className="settings-card">
        <div className="settings-card-heading">
          <h2>Updates</h2>
          <p>Choose how Soundcloudy checks for and installs desktop updates.</p>
        </div>
        <label className="settings-toggle-row">
          <span><strong>Check for updates on startup</strong><small>Check automatically when the desktop app opens.</small></span>
          <SettingsCheckbox
            checked={checkUpdatesOnStartup}
            onChange={onCheckUpdatesOnStartupChange}
            label="Check for updates on startup"
          />
        </label>
        <label className="settings-toggle-row">
          <span><strong>Automatically download updates</strong><small>Download new versions in the background and notify you when they are ready.</small></span>
          <SettingsCheckbox
            checked={automaticUpdates}
            onChange={onAutomaticUpdatesChange}
            label="Automatically download updates"
          />
        </label>
        <div className="settings-update-actions">
          <span className="settings-update-status" role="status">{updateStatus}</span>
          <div className="settings-update-buttons">
            <button
              type="button"
              className="settings-action-button"
              onClick={onCheckForUpdates}
              disabled={updateStatus.startsWith("Checking")}
            >
              Check for updates
            </button>
            {!automaticUpdates && updateStatus.startsWith("Update available") && (
              <button type="button" className="settings-action-button" onClick={onDownloadUpdate}>
                Download
              </button>
            )}
            {updateStatus.startsWith("Update ready") && (
              <button type="button" className="settings-action-button" onClick={onInstallUpdate}>
                Install and restart
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
