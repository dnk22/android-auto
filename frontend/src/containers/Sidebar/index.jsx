import SidebarView from "../../components/Sidebar/SidebarView.jsx";
import { useSidebarController } from "./hooks/useSidebarController.js";

export default function SidebarContainer() {
  const sidebarProps = useSidebarController();

  return <SidebarView {...sidebarProps} />;
}
