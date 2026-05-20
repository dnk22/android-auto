import DashboardMainContainer from "../containers/DashboardMain/index";
import DeviceWorkspaceContainer from "../containers/DeviceWorkspace/index";
import { useStorage, useStorageEvents } from "../automation/hooks/useStorage";

export default function Dashboard(): JSX.Element {
  const { wsUrl } = useStorage();
  useStorageEvents(wsUrl);

  return (
    <div className="app-shell h-screen w-full overflow-hidden p-2">
      <div className="grid h-[calc(100vh-1rem)] w-full grid-cols-1 gap-4 lg:grid-cols-[68%_30%]">
        <div className="flex h-full w-full min-h-0 overflow-hidden">
          <DashboardMainContainer />
        </div>
        <div className="flex h-full w-full min-h-0 overflow-hidden">
          <DeviceWorkspaceContainer />
        </div>
      </div>
    </div>
  );
}
