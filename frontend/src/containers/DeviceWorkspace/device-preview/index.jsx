import DeviceThumbnailStripContainer from "./DeviceThumbnailStripContainer.jsx";
import MainStreamViewContainer from "./MainStreamViewContainer.jsx";

export default function DevicePreviewSectionContainer() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <DeviceThumbnailStripContainer />
      <MainStreamViewContainer />
    </div>
  );
}
