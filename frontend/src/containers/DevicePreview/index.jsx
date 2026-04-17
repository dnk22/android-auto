import DevicePreviewView from "../../components/DevicePreview/DevicePreviewView.jsx";
import DeviceThumbnailStripContainer from "./DeviceThumbnailStripContainer.jsx";
import MainStreamViewContainer from "./MainStreamViewContainer.jsx";

export default function DevicePreviewContainer() {
  return (
    <DevicePreviewView>
      <DeviceThumbnailStripContainer />
      <MainStreamViewContainer />
    </DevicePreviewView>
  );
}
