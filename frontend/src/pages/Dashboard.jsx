import SidebarContainer from "../containers/Sidebar/index.jsx";
import DashboardMainContainer from "../containers/DashboardMain/index.jsx";
import DeviceWorkspaceContainer from "../containers/DeviceWorkspace/index.jsx";

export default function Dashboard() {
  return (
    <div className="app-shell min-h-screen w-full p-4">
      <div className="grid min-h-[calc(100vh-2rem)] w-full grid-cols-1 gap-4 lg:grid-cols-[15%_55%_28%]">
        <div className="flex h-full w-full">
          <SidebarContainer />
        </div>
        <DashboardMainContainer />
        <div className="flex h-full min-h-0 w-full max-h-full overflow-hidden">
          <DeviceWorkspaceContainer />
        </div>
      </div>
    </div>
  );
}
