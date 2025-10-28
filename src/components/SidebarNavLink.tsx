import { Link, useLocation } from 'react-router-dom';

interface SidebarNavLinkProps {
  to: string;
  icon: string;
  label: string;
  collapsed?: boolean;
}

export default function SidebarNavLink({ to, icon, label, collapsed }: SidebarNavLinkProps) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-4 py-3 transition-all ${
        isActive
          ? 'bg-gray-700 text-green-400 border-l-4 border-green-500'
          : 'text-gray-300 hover:bg-gray-700/50 hover:text-white border-l-4 border-transparent'
      } ${collapsed ? 'justify-center' : ''}`}
      title={collapsed ? label : undefined}
    >
      <span className="text-lg">{icon}</span>
      {!collapsed && <span className="font-medium">{label}</span>}
    </Link>
  );
}

