import DashboardMainView from "../../components/DashboardMain/DashboardMainView.jsx";
import { useDashboardMainController } from "./hooks/useDashboardMainController.js";

export default function DashboardMainContainer() {
  const dashboardMainProps = useDashboardMainController();

  return <DashboardMainView {...dashboardMainProps} />;
}
