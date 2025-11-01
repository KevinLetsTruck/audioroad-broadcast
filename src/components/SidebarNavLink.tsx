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
      className={`flex items-center gap-3 px-4 py-3 rounded-lg mx-2 transition-all ${
        isActive
          ? 'bg-primary/10 text-primary font-semibold'
          : 'text-body dark:text-body-dark hover:bg-gray-2 dark:hover:bg-dark-3 hover:text-dark dark:hover:text-white'
      } ${collapsed ? 'justify-center' : ''}`}
      title={collapsed ? label : undefined}
      aria-label={label}
    >
      <span className="text-lg">{icon}</span>
      {!collapsed && <span className="font-medium">{label}</span>}
    </Link>
  );
}

