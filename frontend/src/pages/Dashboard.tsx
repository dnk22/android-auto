import DashboardMainContainer from "../containers/DashboardMain";
// import DeviceWorkspaceContainer from "../containers/DeviceWorkspace";

export default function Dashboard(): JSX.Element {
  return (
    <div className="app-shell h-screen w-full overflow-hidden p-2">
      <div className="grid h-[calc(100vh-1rem)] w-full grid-cols-1 gap-4">
        <div className="flex h-full w-full min-h-0 overflow-hidden">
          <DashboardMainContainer />
        </div>
        {/* <div className="flex h-full w-full min-h-0 overflow-hidden">
          <DeviceWorkspaceContainer />
        </div> */}
      </div>
    </div>
  );
}
