import { useUser, UserButton } from '@clerk/clerk-react';
import SidebarNavLink from './SidebarNavLink';
import { DarkModeToggle } from './ui/DarkModeToggle';

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export default function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const { user } = useUser();
  const userRole = user?.publicMetadata?.role as string | undefined;

  const isScreener = userRole === 'screener' || userRole === 'admin';
  const isHost = userRole === 'host' || userRole === 'admin';
  const isProducer = userRole === 'producer' || userRole === 'admin';

  return (
    <aside className={`bg-white dark:bg-gray-dark border-r border-stroke dark:border-dark-3 h-screen sticky top-0 flex flex-col transition-all duration-300 shadow-2 ${
      collapsed ? 'w-16' : 'w-60'
    }`}>
      {/* TailAdmin Logo & User Info */}
      <div className="p-4 border-b border-stroke dark:border-dark-3">
        {!collapsed ? (
          <>
            <h1 className="text-xl font-bold text-dark dark:text-white mb-1">
              🎙️ AudioRoad
            </h1>
            <p className="text-xs text-body dark:text-body-dark">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-body dark:text-body-dark">
              {userRole || 'user'}
            </p>
          </>
        ) : (
          <div className="text-2xl text-center">🎙️</div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {/* TailAdmin BROADCAST Section */}
        {!collapsed && (
          <div className="px-4 mb-2">
            <h3 className="text-xs font-semibold text-body dark:text-body-dark uppercase tracking-wider">
              Broadcast
            </h3>
          </div>
        )}
        
        {isHost && (
          <>
            <SidebarNavLink to="/" icon="🎚️" label="Control" collapsed={collapsed} />
            <SidebarNavLink to="/host-dashboard" icon="📊" label="Dashboard" collapsed={collapsed} />
          </>
        )}
        
        {isScreener && (
          <SidebarNavLink to="/screening-room" icon="📞" label="Screening" collapsed={collapsed} />
        )}
        
        <SidebarNavLink to="/recordings" icon="📁" label="Recordings" collapsed={collapsed} />

        {/* CONTENT Section */}
        {(isHost || isProducer) && (
          <>
            {!collapsed && (
              <div className="px-4 mb-2 mt-6">
                <h3 className="text-xs font-semibold text-body dark:text-body-dark uppercase tracking-wider">
                  Content
                </h3>
              </div>
            )}
            
            <SidebarNavLink to="/commercials" icon="🎬" label="Commercials" collapsed={collapsed} />
            <SidebarNavLink to="/content" icon="📱" label="Social Media" collapsed={collapsed} />
            <SidebarNavLink to="/autodj" icon="🎵" label="Auto DJ" collapsed={collapsed} />
          </>
        )}

        {/* TailAdmin SETTINGS Section */}
        {!collapsed && (
          <div className="px-4 mb-2 mt-6">
            <h3 className="text-xs font-semibold text-body dark:text-body-dark uppercase tracking-wider">
              Settings
            </h3>
          </div>
        )}
        
        <SidebarNavLink to="/platforms" icon="📡" label="Streaming Platforms" collapsed={collapsed} />
        <SidebarNavLink to="/podcast" icon="🎙️" label="Podcast Distribution" collapsed={collapsed} />
        <SidebarNavLink to="/settings" icon="⚙️" label="Show Settings" collapsed={collapsed} />
      </nav>

      {/* TailAdmin Bottom Section with Dark Mode */}
      <div className="p-4 border-t border-stroke dark:border-dark-3">
        {!collapsed ? (
          <div className="space-y-3">
            <DarkModeToggle />
            <div className="flex items-center justify-between">
              <UserButton 
                afterSignOutUrl="/sign-in"
                appearance={{
                  elements: {
                    avatarBox: "w-8 h-8"
                  }
                }}
              />
              <button
                onClick={onToggle}
                className="p-2 text-body dark:text-body-dark hover:text-dark dark:hover:text-white hover:bg-gray-2 dark:hover:bg-dark-3 rounded transition-colors"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                ◀
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <DarkModeToggle />
            <UserButton 
              afterSignOutUrl="/sign-in"
              appearance={{
                elements: {
                  avatarBox: "w-8 h-8"
                }
              }}
            />
            <button
              onClick={onToggle}
              className="p-2 text-body dark:text-body-dark hover:text-dark dark:hover:text-white hover:bg-gray-2 dark:hover:bg-dark-3 rounded transition-colors"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              ▶
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

