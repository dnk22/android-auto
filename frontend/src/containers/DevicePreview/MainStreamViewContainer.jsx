import MainStreamView from "../../components/DevicePreview/MainStreamView.jsx";
import { useMainStreamController } from "./hooks/useMainStreamController.js";

export default function MainStreamViewContainer() {
  const mainStreamProps = useMainStreamController();

  return <MainStreamView {...mainStreamProps} />;
}
