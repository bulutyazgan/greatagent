import { useState } from 'react';
import type { UserRole } from '@/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Bell, Newspaper, MapPin } from 'lucide-react';
import { AlertsTab } from './AlertsTab';
import { NewsTab } from './NewsTab';
import { ResourcesTab } from './ResourcesTab';

interface LeftPanelProps {
  role: UserRole;
}

export function LeftPanel({ }: LeftPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Toggle Button */}
      <Button
        variant="glass"
        size="icon"
        className="fixed left-6 top-24 z-40 bg-gradient-to-br from-background-elevated/90 to-background-elevated/60 border border-white/10 shadow-xl hover:shadow-2xl hover:scale-110 transition-all duration-200 backdrop-blur-xl"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          <ChevronLeft className="w-5 h-5 text-white" />
        ) : (
          <ChevronRight className="w-5 h-5 text-accent-blue" />
        )}
      </Button>

      {/* Panel */}
      <div
        className={`fixed left-0 top-20 bottom-0 z-30 w-96 glass border-r border-white/5 transform transition-all duration-300 backdrop-blur-2xl shadow-2xl ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Tabs defaultValue="alerts" className="h-full flex flex-col p-6">
          <TabsList className="grid grid-cols-3 w-full bg-background-elevated/40 border border-white/10 p-1 rounded-xl shadow-lg">
            <TabsTrigger
              value="alerts"
              className="text-sm font-medium data-[state=active]:bg-gradient-to-r data-[state=active]:from-accent-orange/30 data-[state=active]:to-accent-orange/10 data-[state=active]:text-accent-orange data-[state=active]:shadow-lg data-[state=active]:border data-[state=active]:border-accent-orange/30 rounded-lg transition-all duration-200"
            >
              <Bell className="w-4 h-4 mr-2" />
              Alerts
            </TabsTrigger>
            <TabsTrigger
              value="news"
              className="text-sm font-medium data-[state=active]:bg-gradient-to-r data-[state=active]:from-accent-blue/30 data-[state=active]:to-accent-blue/10 data-[state=active]:text-accent-blue data-[state=active]:shadow-lg data-[state=active]:border data-[state=active]:border-accent-blue/30 rounded-lg transition-all duration-200"
            >
              <Newspaper className="w-4 h-4 mr-2" />
              News
            </TabsTrigger>
            <TabsTrigger
              value="resources"
              className="text-sm font-medium data-[state=active]:bg-gradient-to-r data-[state=active]:from-accent-green/30 data-[state=active]:to-accent-green/10 data-[state=active]:text-accent-green data-[state=active]:shadow-lg data-[state=active]:border data-[state=active]:border-accent-green/30 rounded-lg transition-all duration-200"
            >
              <MapPin className="w-4 h-4 mr-2" />
              Resources
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-6 pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            <TabsContent value="alerts" className="m-0">
              <AlertsTab />
            </TabsContent>

            <TabsContent value="news" className="m-0">
              <NewsTab />
            </TabsContent>

            <TabsContent value="resources" className="m-0">
              <ResourcesTab />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </>
  );
}
