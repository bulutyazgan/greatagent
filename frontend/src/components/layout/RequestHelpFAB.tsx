import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RequestHelpFABProps {
  onClick: () => void;
}

export function RequestHelpFAB({ onClick }: RequestHelpFABProps) {
  console.log('🔴 RequestHelpFAB component is rendering!');
  return (
    <div className="fixed bottom-8 right-8 z-[9999] group" style={{ position: 'fixed', bottom: '32px', right: '32px', zIndex: 9999 }}>
      {/* Pulsing ring animation - warm brown tones */}
      <div
        className="absolute inset-0 rounded-full animate-ping"
        style={{ backgroundColor: 'rgba(162, 92, 65, 0.3)' }}
      />
      <div
        className="absolute inset-0 rounded-full animate-pulse"
        style={{ backgroundColor: 'rgba(162, 92, 65, 0.2)' }}
      />

      {/* Main button - warm brown gradient */}
      <Button
        onClick={onClick}
        size="lg"
        className="relative h-16 w-16 rounded-full shadow-2xl border-2 hover:scale-110 transition-all duration-300"
        style={{
          background: 'linear-gradient(135deg, #A67C52 0%, #8B5E34 100%)',
          borderColor: 'rgba(245, 241, 235, 0.3)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4), 0 0 30px rgba(166, 124, 82, 0.3)'
        }}
        title="Request Help"
      >
        <AlertCircle className="w-7 h-7 text-white drop-shadow-lg" />
      </Button>

      {/* Tooltip on hover - brown theme */}
      <div className="absolute bottom-full right-0 mb-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
        <div
          className="px-4 py-2 rounded-lg shadow-xl backdrop-blur-xl whitespace-nowrap"
          style={{
            background: 'linear-gradient(135deg, rgba(42, 32, 25, 0.95) 0%, rgba(61, 49, 40, 0.98) 100%)',
            border: '1px solid rgba(196, 181, 163, 0.2)'
          }}
        >
          <p className="text-sm font-semibold" style={{ color: '#F5F1EB' }}>Request Emergency Help</p>
        </div>
      </div>
    </div>
  );
}
