import { useEffect } from "react";

import SidebarContainer from "../containers/Sidebar/index.jsx";
import DashboardMainContainer from "../containers/DashboardMain/index.jsx";
import DevicePreviewContainer from "../containers/DevicePreview/index.jsx";
import { useStore } from "../store/useStore.js";
import { listDevices } from "../services/api.js";

export default function Dashboard() {
  const setDevices = useStore((state) => state.setDevices);
  const selectedDevice = useStore((state) => state.selectedDevice);
  const setSelectedDevice = useStore((state) => state.setSelectedDevice);

  useEffect(() => {
    const loadDevices = async () => {
      try {
        const response = await listDevices();
        const nextDevices = response.devices || [];
        setDevices(nextDevices);

        if (!selectedDevice) {
          const connectedDevice = nextDevices.find((device) => device.connected);
          if (connectedDevice) {
            setSelectedDevice(connectedDevice.id);
          }
        }
      } catch (error) {
        setDevices([]);
      }
    };
    loadDevices();
  }, [selectedDevice, setDevices, setSelectedDevice]);

  return (
    <div className="app-shell min-h-screen w-full p-4">
      <div className="grid min-h-[calc(100vh-2rem)] w-full grid-cols-1 gap-4 lg:grid-cols-[15%_55%_28%]">
        <div className="flex h-full w-full">
          <SidebarContainer />
        </div>
        <DashboardMainContainer />
        <div className="flex h-full w-full">
          <DevicePreviewContainer />
        </div>
      </div>
    </div>
  );
}
