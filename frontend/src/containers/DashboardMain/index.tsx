import DashboardSummarySection from "./components/DashboardSummarySection";
import DashboardLogSection from "./components/DashboardLogSection";

export default function DashboardMainContainer(): JSX.Element {
  return (
    <main className="flex h-full w-full min-h-0 flex-col gap-4 overflow-hidden">
      <DashboardSummarySection />
      <DashboardLogSection />
    </main>
  );
}
