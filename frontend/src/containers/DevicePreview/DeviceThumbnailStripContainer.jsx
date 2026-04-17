import DeviceThumbnailStrip from "../../components/DevicePreview/DeviceThumbnailStrip.jsx";
import { useDeviceThumbnailStripController } from "./hooks/useDeviceThumbnailStripController.js";

export default function DeviceThumbnailStripContainer() {
  const thumbnailProps = useDeviceThumbnailStripController();

  return <DeviceThumbnailStrip {...thumbnailProps} />;
}
