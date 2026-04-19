import DeviceThumbnailStripContainer from "./DeviceThumbnailStripContainer";
import MainStreamViewContainer from "./MainStreamViewContainer";

export default function DevicePreviewSectionContainer(): JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <DeviceThumbnailStripContainer />
      <MainStreamViewContainer />
    </div>
  );
}
