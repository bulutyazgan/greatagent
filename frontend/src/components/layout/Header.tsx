import type { UserRole, DisasterInfo } from '@/types';
import { Settings, Users, Heart, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface HeaderProps {
  role: UserRole;
  disaster: DisasterInfo;
  onChangeRole: () => void;
}

export function Header({ role, disaster, onChangeRole }: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 glass border-b border-white/5 backdrop-blur-xl">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left: Logo and Disaster Info */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-accent-red/30 to-accent-red/10 rounded-xl flex items-center justify-center border border-accent-red/20 shadow-lg shadow-accent-red/10">
              <Heart className="w-6 h-6 text-accent-red drop-shadow-lg" />
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="font-bold text-lg text-white tracking-tight">Emergency Response</span>
              <span className="text-xs text-gray-400 font-medium">Real-time Disaster Management</span>
            </div>
          </div>

          <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-gradient-to-r from-background-elevated/80 to-background-elevated/40 border border-white/10 shadow-lg backdrop-blur-sm">
            <div className="w-2 h-2 bg-accent-red rounded-full animate-pulse shadow-lg shadow-accent-red/50" />
            <span className="text-sm font-semibold text-white">
              {disaster.name}
            </span>
            <span className="hidden sm:inline text-xs text-gray-500">•</span>
            <span className="hidden sm:inline text-xs text-gray-400 font-medium">
              {format(disaster.date, 'MMM d, yyyy')}
            </span>
            <MapPin className="w-3.5 h-3.5 text-accent-red/70 ml-1" />
          </div>
        </div>

        {/* Right: Role Badge and Settings */}
        <div className="flex items-center gap-4">
          {/* Role Badge */}
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border shadow-lg transition-all duration-200 ${
              role === 'victim'
                ? 'bg-gradient-to-r from-accent-red/20 to-accent-red/10 border-accent-red/30 text-accent-red shadow-accent-red/10'
                : 'bg-gradient-to-r from-accent-green/20 to-accent-green/10 border-accent-green/30 text-accent-green shadow-accent-green/10'
            }`}
          >
            <Users className="w-4 h-4" />
            <span className="text-sm font-semibold capitalize hidden sm:inline">
              {role}
            </span>
          </div>

          {/* Settings Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onChangeRole}
            title="Change Role"
            className="hover:bg-white/5 transition-all duration-200 hover:scale-105"
          >
            <Settings className="w-5 h-5 text-gray-400 hover:text-white transition-colors" />
          </Button>
        </div>
      </div>
    </header>
  );
}
