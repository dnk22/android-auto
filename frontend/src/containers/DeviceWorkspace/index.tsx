import DevicePreviewSectionContainer from "./device-preview";

export default function DeviceWorkspaceContainer(): JSX.Element {
  return (
    <aside className="card fade-in flex h-full max-h-full min-h-0 w-full flex-col gap-4 overflow-hidden p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-xl">Device Preview</h3>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DevicePreviewSectionContainer />
      </div>
    </aside>
  );
}
