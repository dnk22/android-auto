export type AppMenuItem = {
  key: string;
  label: string;
  path: string;
  icon: string;
};

export const APP_MENUS: AppMenuItem[] = [
  {
    key: "dashboard",
    label: "Trang chủ",
    path: "/dashboard",
    icon: "📊",
  },
  {
    key: "devices",
    label: "Thiết bị",
    path: "/devices",
    icon: "📱",
  },
  {
    key: "file",
    label: "Tệp tin",
    path: "/file",
    icon: "📁",
  },
];
