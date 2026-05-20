export type AppMenuItem = {
  key: string;
  label: string;
  path: string;
  icon: string;
};

export const APP_MENUS: AppMenuItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    path: "/dashboard",
    icon: "📊",
  },
  {
    key: "devices",
    label: "Devices",
    path: "/devices",
    icon: "📱",
  },
  {
    key: "file",
    label: "File",
    path: "/file",
    icon: "📁",
  },
];
