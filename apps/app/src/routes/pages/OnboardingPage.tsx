import { useNavigate } from "@tanstack/react-router";
import { OnboardingScreen } from "../../components/onboarding";
import { dismissOnboarding } from "../../lib/onboarding";
import { useShellActions } from "../shell-actions";

export function OnboardingPage() {
  const navigate = useNavigate();
  const { openCreateDialog } = useShellActions();

  function handleDismissOnboarding() {
    dismissOnboarding();
  }

  return (
    <OnboardingScreen
      onCreateSpace={() => {
        handleDismissOnboarding();
        openCreateDialog();
      }}
      onImport={() => {
        handleDismissOnboarding();
        void navigate({ to: "/import" });
      }}
      onSkip={() => {
        handleDismissOnboarding();
        void navigate({ to: "/" });
      }}
    />
  );
}
