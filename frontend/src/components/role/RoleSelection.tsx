import type { UserRole } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, HandHelping } from 'lucide-react';

interface RoleSelectionProps {
  onSelectRole: (role: UserRole) => void;
}

export function RoleSelection({ onSelectRole }: RoleSelectionProps) {
  return (
    <div className="h-screen w-full flex flex-col bg-background-primary p-4 overflow-hidden">
      {/* Header */}
      <div className="text-center space-y-3 py-8 shrink-0">
        <h1 className="text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold tracking-tighter bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-300 bg-clip-text text-transparent drop-shadow-2xl">
          Beaconn
        </h1>
        <p className="text-lg md:text-xl lg:text-2xl xl:text-3xl text-neutral-400 font-medium tracking-tight">
          Connect with help during emergencies
        </p>
      </div>

      {/* Role Selection Cards - Takes remaining space */}
      <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0 overflow-hidden px-2 md:px-4">
        {/* Victim Role */}
        <Card className="flex-1 glass-hover cursor-pointer group card-victim overflow-hidden" onClick={() => onSelectRole('victim')}>
          <Button className="w-full h-full p-8 md:p-10 lg:p-12">
            <div className="flex flex-col items-center justify-center h-full w-full">
              <div className="mb-8 md:mb-10 lg:mb-12 p-8 md:p-10 lg:p-14 rounded-full card-victim-icon-bg group-hover:card-victim-icon-bg-hover transition-all duration-300 shrink-0">
                <Heart className="icon-victim transition-transform duration-300 group-hover:scale-110" style={{ height: '96px', width: '96px', color: '#C17A5B' }} />
              </div>
              <h2 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold mb-4 md:mb-6 tracking-tight text-neutral-50 shrink-0">
                I Need Help
              </h2>
              <p className="text-base md:text-lg lg:text-xl xl:text-2xl text-neutral-400 text-center leading-relaxed max-w-md px-6 md:px-8 font-medium">
                Request assistance and access emergency resources
              </p>
            </div>
          </Button>
        </Card>

        {/* Responder Role */}
        <Card className="flex-1 glass-hover cursor-pointer group card-responder overflow-hidden" onClick={() => onSelectRole('responder')}>
          <Button className="w-full h-full p-8 md:p-10 lg:p-12">
            <div className="flex flex-col items-center justify-center h-full w-full">
              <div className="mb-8 md:mb-10 lg:mb-12 p-8 md:p-10 lg:p-14 rounded-full card-responder-icon-bg group-hover:card-responder-icon-bg-hover transition-all duration-300 shrink-0">
                <HandHelping className="icon-responder transition-transform duration-300 group-hover:scale-110" style={{ height: '96px', width: '96px', color: '#8B9B7A' }} />
              </div>
              <h2 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold mb-4 md:mb-6 tracking-tight text-neutral-50 shrink-0">
                I Want to Help
              </h2>
              <p className="text-base md:text-lg lg:text-xl xl:text-2xl text-neutral-400 text-center leading-relaxed max-w-md px-6 md:px-8 font-medium">
                Respond to requests and coordinate relief efforts
              </p>
            </div>
          </Button>
        </Card>
      </div>

      {/* Footer Info */}
      <div className="text-center text-sm md:text-base lg:text-lg text-neutral-500 py-6 shrink-0">
        <p className="font-medium tracking-wide">We are here to help, but call 999 first.</p>
      </div>
    </div>
  );
}
