export default function DevicePreviewView({ children }) {
  return (
    <aside className="card fade-in flex h-full w-full flex-col gap-5 p-6">
      <div className="flex items-center gap-3">
        <h3 className="font-display text-xl">Device Preview</h3>
      </div>
      {children}
    </aside>
  );
}
