import type { StudySettings } from "@pupil/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import {
  exportDatabaseCopy,
  exportReviewLogsCsv,
  getSettingsDataSummary,
} from "../../lib/data-actions";
import { toAppError } from "../../lib/errors";
import { isTauriRuntime } from "../../lib/runtime";
import { CopyIcon, DownloadIcon, TrashIcon } from "../icons/SettingsIcons";
import { AppearanceSettingsCard } from "./AppearanceSettingsCard";
import styles from "./Settings.module.css";
import { SettingsAboutCard } from "./SettingsAboutCard";
import { SettingsConnectionStatus } from "./SettingsConnectionStatus";
import { SettingsDataCard } from "./SettingsDataCard";
import { SettingsNav, type SettingsSectionId } from "./SettingsNav";
import { SettingsShortcutsGrid } from "./SettingsShortcutsGrid";
import { StudySettingsCard } from "./StudySettingsCard";

type SettingsScreenProps = {
  cardsCount: number;
  isSavingStudySettings: boolean;
  onResetAllData: () => Promise<void>;
  onSaveStudySettings: (newCardsLimit: number | null) => Promise<void>;
  spacesCount: number;
  studySettings: StudySettings;
};

const SHORTCUTS = [
  { keys: ["Space"], label: "Reveal card" },
  { keys: ["1"], label: "Rate: Again" },
  { keys: ["2"], label: "Rate: Hard" },
  { keys: ["3"], label: "Rate: Good" },
  { keys: ["4"], label: "Rate: Easy" },
  { keys: ["⌘", "N"], label: "New card" },
  { keys: ["⌘", "K"], label: "Search" },
  { keys: ["⌘", ","], label: "Settings" },
];

export function SettingsScreen({
  cardsCount,
  isSavingStudySettings,
  onResetAllData,
  onSaveStudySettings,
  spacesCount,
  studySettings,
}: SettingsScreenProps) {
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("general");
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [databasePath, setDatabasePath] = useState("Loading database path…");
  const [reviewLogCount, setReviewLogCount] = useState(0);
  const [isExportingDatabase, setIsExportingDatabase] = useState(false);
  const [isExportingReviewLogs, setIsExportingReviewLogs] = useState(false);
  const [isResettingData, setIsResettingData] = useState(false);
  const [dataStatus, setDataStatus] = useState<{
    detail?: string;
    kind: "idle" | "success" | "error";
    label: string;
  }>({ detail: "Database and review exports land on this device.", kind: "idle", label: "Ready" });

  useEffect(() => {
    let cancelled = false;
    void getSettingsDataSummary()
      .then((summary) => {
        if (!cancelled) {
          setDatabasePath(summary.databasePath);
          setReviewLogCount(summary.reviewLogCount);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setDataStatus({
            detail: toAppError(error, "Failed to load data actions.").message,
            kind: "error",
            label: "Load failed",
          });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (copyState !== "copied") return;
    const timeout = window.setTimeout(() => setCopyState("idle"), 1500);
    return () => window.clearTimeout(timeout);
  }, [copyState]);
  function handleSelectSection(section: SettingsSectionId) {
    setActiveSection(section);
    window.scrollTo(0, 0);
  }
  async function handleCopyPath() {
    try {
      await navigator.clipboard.writeText(databasePath);
      setCopyState("copied");
    } catch {
      setCopyState("idle");
    }
  }
  async function handleExportDatabase() {
    setIsExportingDatabase(true);
    try {
      const result = await exportDatabaseCopy();
      setDataStatus({ detail: result.path, kind: "success", label: "Collection exported" });
    } catch (error: unknown) {
      setDataStatus({
        detail: toAppError(error, "Collection export failed.").message,
        kind: "error",
        label: "Export failed",
      });
    } finally {
      setIsExportingDatabase(false);
    }
  }
  async function handleExportReviewLogs() {
    setIsExportingReviewLogs(true);
    try {
      const result = await exportReviewLogsCsv();
      setDataStatus({
        detail:
          result.recordCount > 0
            ? `${result.recordCount} rows · ${result.path}`
            : `No review rows yet · ${result.path}`,
        kind: "success",
        label: "Review logs exported",
      });
    } catch (error: unknown) {
      setDataStatus({
        detail: toAppError(error, "Review log export failed.").message,
        kind: "error",
        label: "Export failed",
      });
    } finally {
      setIsExportingReviewLogs(false);
    }
  }
  async function handleReset() {
    if (!window.confirm("Reset all local data? This removes spaces, cards, and review history."))
      return;
    setIsResettingData(true);
    try {
      await onResetAllData();
      const summary = await getSettingsDataSummary();
      setDatabasePath(summary.databasePath);
      setReviewLogCount(summary.reviewLogCount);
      setDataStatus({
        detail: "Local study data was cleared.",
        kind: "success",
        label: "Reset complete",
      });
    } catch (error: unknown) {
      setDataStatus({
        detail: toAppError(error, "Reset failed.").message,
        kind: "error",
        label: "Reset failed",
      });
    } finally {
      setIsResettingData(false);
    }
  }
  function handleOpenExternal(kind: "docs" | "github" | "issues") {
    const urls = {
      docs: "https://github.com/balazsotakomaiya/pupil/wiki",
      github: "https://github.com/balazsotakomaiya/pupil",
      issues: "https://github.com/balazsotakomaiya/pupil/issues",
    };
    void openUrl(urls[kind]);
  }
  async function handleSaveStudySettings(limit: number | null) {
    await onSaveStudySettings(limit);
  }

  return (
    <div className={`page ${styles.settingsPage}`}>
      <section className={styles.settingsHeader}>
        <h1 className={styles.settingsTitle}>Settings</h1>
        <p className={styles.settingsDesc}>Make Pupil yours.</p>
      </section>

      <SettingsNav activeSection={activeSection} onSelect={handleSelectSection} />

      <div
        role="tabpanel"
        id="settings-panel-general"
        aria-labelledby="settings-tab-general"
        hidden={activeSection !== "general"}
      >
        <section className={styles.settingsSection} id="appearance">
          <div className={styles.settingsSectionHead}>
            <div className={styles.settingsSectionTitle}>Appearance</div>
            <div className={styles.settingsSectionDesc}>Set the tone for your study sessions.</div>
          </div>

          <AppearanceSettingsCard />
        </section>

        <div className="ruler-divider" />

        <section className={styles.settingsSection} id="study">
          <div className={styles.settingsSectionHead}>
            <div className={styles.settingsSectionTitle}>New Cards Per Day</div>
            <div className={styles.settingsSectionDesc}>
              Set your daily pace. Due reviews always stay in the queue.
            </div>
          </div>

          <StudySettingsCard
            isSaving={isSavingStudySettings}
            onSave={handleSaveStudySettings}
            settings={studySettings}
          />
        </section>

        <div className="ruler-divider" />

        <section className={styles.settingsSection} id="shortcuts">
          <div className={styles.settingsSectionHead}>
            <div className={styles.settingsSectionTitle}>Keyboard Shortcuts</div>
            <div className={styles.settingsSectionDesc}>
              Active during study sessions and general navigation.
            </div>
          </div>

          <SettingsShortcutsGrid items={SHORTCUTS} />
        </section>
      </div>

      <div
        role="tabpanel"
        id="settings-panel-data"
        aria-labelledby="settings-tab-data"
        hidden={activeSection !== "data"}
      >
        <section className={styles.settingsSection} id="data">
          <div className={styles.settingsSectionHead}>
            <div className={styles.settingsSectionTitle}>Data</div>
            <div className={styles.settingsSectionDesc}>
              Back up your collection or export your review history.
            </div>
          </div>

          <div className={styles.settingsDataSectionBody}>
            <div className={styles.settingsDataCards}>
              <SettingsDataCard
                action={
                  <button
                    className={styles.settingsDataBtn}
                    disabled={isExportingDatabase}
                    onClick={() => void handleExportDatabase()}
                    type="button"
                  >
                    <DownloadIcon />
                    {isExportingDatabase ? "Exporting…" : "Export"}
                  </button>
                }
                description={
                  isTauriRuntime()
                    ? "A complete SQLite backup of your collection and study progress."
                    : "A JSON backup of your spaces, cards, and study progress."
                }
                title="Collection backup"
                value={
                  <>
                    <strong>{spacesCount}</strong> spaces · <strong>{cardsCount}</strong> cards
                  </>
                }
              />

              <SettingsDataCard
                action={
                  <button
                    className={styles.settingsDataBtn}
                    disabled={isExportingReviewLogs}
                    onClick={() => void handleExportReviewLogs()}
                    type="button"
                  >
                    <DownloadIcon />
                    {isExportingReviewLogs ? "Exporting…" : "Export CSV"}
                  </button>
                }
                description="One CSV row per review, ready for your own analysis."
                title="Review history"
                value={
                  <>
                    <strong>{reviewLogCount}</strong> reviews
                  </>
                }
              />

              <SettingsDataCard
                action={
                  isTauriRuntime() ? (
                    <button
                      className={styles.settingsDataBtn}
                      onClick={() => void handleCopyPath()}
                      type="button"
                    >
                      <CopyIcon />
                      {copyState === "copied" ? "Copied" : "Copy"}
                    </button>
                  ) : null
                }
                description={
                  <span className={styles.settingsDataCardDescPath}>{databasePath}</span>
                }
                title="Storage location"
              />

              <SettingsDataCard
                action={
                  <button
                    className={`${styles.settingsDataBtn} ${styles.danger}`}
                    disabled={isResettingData}
                    onClick={() => void handleReset()}
                    type="button"
                  >
                    <TrashIcon />
                    {isResettingData ? "Resetting…" : "Reset"}
                  </button>
                }
                description="Delete all spaces, cards, and review history from this device."
                title="Reset this device"
                tone="danger"
              />
            </div>

            {dataStatus.kind !== "idle" && (
              <SettingsConnectionStatus
                detail={dataStatus.detail}
                kind={dataStatus.kind}
                label={dataStatus.label}
              />
            )}
          </div>
        </section>
      </div>

      <div
        role="tabpanel"
        id="settings-panel-about"
        aria-labelledby="settings-tab-about"
        hidden={activeSection !== "about"}
      >
        <section className={styles.settingsSection} id="about">
          <div className={styles.settingsSectionHead}>
            <div className={styles.settingsSectionTitle}>About</div>
          </div>

          <SettingsAboutCard
            onOpenDocs={() => handleOpenExternal("docs")}
            onOpenGithub={() => handleOpenExternal("github")}
            onOpenIssues={() => handleOpenExternal("issues")}
          />
        </section>
      </div>

      <div className="page-end" />
    </div>
  );
}
