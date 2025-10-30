import { useUser, UserButton } from '@clerk/clerk-react';
import SidebarNavLink from './SidebarNavLink';

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
    <aside className={`bg-gray-800 border-r border-gray-700 h-screen sticky top-0 flex flex-col transition-all duration-300 ${
      collapsed ? 'w-16' : 'w-60'
    }`}>
      {/* Logo & User Info */}
      <div className="p-4 border-b border-gray-700">
        {!collapsed ? (
          <>
            <h1 className="text-xl font-bold text-white mb-1">
              🎙️ AudioRoad
            </h1>
            <p className="text-xs text-gray-400">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-gray-500">
              {userRole || 'user'}
            </p>
          </>
        ) : (
          <div className="text-2xl text-center">🎙️</div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {/* BROADCAST Section */}
        {!collapsed && (
          <div className="px-4 mb-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
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
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Content
                </h3>
              </div>
            )}
            
            <SidebarNavLink to="/commercials" icon="🎬" label="Commercials" collapsed={collapsed} />
            <SidebarNavLink to="/content" icon="📱" label="Social Media" collapsed={collapsed} />
            <SidebarNavLink to="/autodj" icon="🎵" label="Auto DJ" collapsed={collapsed} />
          </>
        )}

        {/* SETTINGS Section */}
        {!collapsed && (
          <div className="px-4 mb-2 mt-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Settings
            </h3>
          </div>
        )}
        
        <SidebarNavLink to="/platforms" icon="📡" label="Streaming Platforms" collapsed={collapsed} />
        <SidebarNavLink to="/settings" icon="⚙️" label="Show Settings" collapsed={collapsed} />
      </nav>

      {/* Bottom Section */}
      <div className="p-4 border-t border-gray-700">
        {!collapsed ? (
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
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
              title="Collapse sidebar"
            >
              ◀
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
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
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
              title="Expand sidebar"
            >
              ▶
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

