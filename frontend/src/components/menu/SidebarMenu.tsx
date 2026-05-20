import { NavLink } from "react-router-dom";

import { APP_MENUS } from "../../constants/menu.constants";

type SidebarMenuProps = {
  collapsed: boolean;
};

export default function SidebarMenu({ collapsed }: SidebarMenuProps): JSX.Element {
  return (
    <nav className="flex flex-col gap-2 p-2">
      {APP_MENUS.map((item) => (
        <NavLink
          key={item.key}
          to={item.path}
          className={({ isActive }) =>
            [
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors text-white",
              isActive
                ? "bg-slate-900 text-white"
                : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
              collapsed ? "justify-center" : "justify-start",
            ].join(" ")
          }
          title={item.label}
        >
          <span className="text-base" aria-hidden>
            {item.icon}
          </span>
          {!collapsed ? <span>{item.label}</span> : null}
        </NavLink>
      ))}
    </nav>
  );
}
