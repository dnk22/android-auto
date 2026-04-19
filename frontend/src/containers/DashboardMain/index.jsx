import { useDashboardMainController } from "./hooks/useDashboardMainController.js";
import DashboardSummarySection from "./components/DashboardSummarySection.jsx";
import DashboardLogSection from "./components/DashboardLogSection.jsx";
import { AutomationPage } from "../../automation/components/AutomationPage";

export default function DashboardMainContainer() {
  const {
    selectedDevice,
    selectedDeviceInfo,
    isTestingU2,
    handleRefreshDevices,
    handleTestU2OpenSettings,
  } = useDashboardMainController();

  return (
    <main className="flex h-full w-full flex-col gap-4">
      {/* <DashboardSummarySection selectedDeviceInfo={selectedDeviceInfo} /> */}
      <AutomationPage />
      {/* <DashboardLogSection /> */}
    </main>
  );
}
