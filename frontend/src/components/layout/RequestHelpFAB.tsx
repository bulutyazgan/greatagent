import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RequestHelpFABProps {
  onClick: () => void;
}

export function RequestHelpFAB({ onClick }: RequestHelpFABProps) {
  return (
    <div className="fixed bottom-8 right-8 z-50 group">
      {/* Pulsing ring animation */}
      <div className="absolute inset-0 rounded-full bg-accent-red/30 animate-ping" />
      <div className="absolute inset-0 rounded-full bg-accent-red/20 animate-pulse" />

      {/* Main button */}
      <Button
        onClick={onClick}
        size="lg"
        className="relative h-16 w-16 rounded-full shadow-2xl bg-gradient-to-br from-accent-red to-accent-red/80 hover:from-accent-red/90 hover:to-accent-red/70 border-2 border-white/20 hover:scale-110 transition-all duration-300 hover:shadow-accent-red/50"
        title="Request Help"
      >
        <AlertCircle className="w-7 h-7 text-white drop-shadow-lg" />
      </Button>

      {/* Tooltip on hover */}
      <div className="absolute bottom-full right-0 mb-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
        <div className="glass px-4 py-2 rounded-lg border border-white/20 shadow-xl backdrop-blur-xl whitespace-nowrap">
          <p className="text-sm font-semibold text-white">Request Emergency Help</p>
        </div>
      </div>
    </div>
  );
}
