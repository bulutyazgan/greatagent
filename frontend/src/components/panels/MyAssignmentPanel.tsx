import { useState, useEffect, useCallback } from 'react';
import { FileText, Shield, Send, Clock, Maximize2, Minimize2, MapPin, Users, AlertTriangle, Navigation } from 'lucide-react';
import { getHelperGuide, type HelperGuide, type Case, getCase, getAssignment, type Assignment } from '@/services/api';
import { RouteMap } from '@/components/map/RouteMap';
import type { Location, HelpRequest } from '@/types';

interface MyAssignmentPanelProps {
  assignmentId: number;
}

interface ChatMessage {
  id: string;
  text: string;
  timestamp: Date;
  sender: 'user' | 'hero_agent';
}

export function MyAssignmentPanel({ assignmentId }: MyAssignmentPanelProps) {
  const [guide, setGuide] = useState<HelperGuide | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [updateText, setUpdateText] = useState('');
  const [submittingUpdate, setSubmittingUpdate] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [routeDistance, setRouteDistance] = useState<string>('');
  const [routeDuration, setRouteDuration] = useState<string>('');

  // Draggable panel state
  const [panelPosition, setPanelPosition] = useState<'top' | 'bottom'>('top');
  const [dragStartY, setDragStartY] = useState<number>(0);
  const [currentY, setCurrentY] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);

  // Travel mode state
  const [travelMode, setTravelMode] = useState<'DRIVING' | 'WALKING'>('DRIVING');

  // Fetch helper's latest location from database
  const [helperLocation, setHelperLocation] = useState<Location | null>(null);

  useEffect(() => {
    const fetchHelperLocation = async () => {
      const userId = localStorage.getItem('beacon_user_id');
      if (!userId) return;

      try {
        const response = await fetch(`http://localhost:8000/api/users/${userId}/location-history?limit=1`);
        const data = await response.json();

        if (data.locations && data.locations.length > 0) {
          const latestLocation = data.locations[0];
          setHelperLocation({
            lat: latestLocation.latitude,
            lng: latestLocation.longitude
          });
        }
      } catch (err) {
        console.error('Failed to fetch helper location:', err);
      }
    };

    fetchHelperLocation();

    // Poll for location updates every 2 seconds
    const interval = setInterval(fetchHelperLocation, 2000);
    return () => clearInterval(interval);
  }, []);

  // Fetch assignment data
  useEffect(() => {
    const fetchAssignment = async () => {
      try {
        console.log('[MyAssignmentPanel] Fetching assignment:', assignmentId);
        const assignmentResponse = await getAssignment(assignmentId);
        console.log('[MyAssignmentPanel] Assignment response:', assignmentResponse);
        setAssignment(assignmentResponse);

        // Fetch the case data
        console.log('[MyAssignmentPanel] Fetching case:', assignmentResponse.case_id);
        const caseResponse = await getCase(assignmentResponse.case_id);
        console.log('[MyAssignmentPanel] Case response:', caseResponse);
        setCaseData(caseResponse);
      } catch (err) {
        console.error('[MyAssignmentPanel] Failed to fetch assignment or case:', err);
      }
    };

    fetchAssignment();
  }, [assignmentId]);

  // Fetch Hero Agent guide
  useEffect(() => {
    const fetchGuide = async () => {
      try {
        const response = await getHelperGuide(assignmentId);
        if (response.status !== 'processing') {
          setGuide(response);
          setLoading(false);

          // Add Hero Agent recommendation to chat
          if (response.guide_text && chatMessages.length === 0) {
            const heroMessage: ChatMessage = {
              id: 'hero-initial',
              text: response.guide_text,
              timestamp: new Date(),
              sender: 'hero_agent',
            };
            setChatMessages([heroMessage]);
          }
        }
      } catch (err) {
        console.error('Failed to fetch guide:', err);
        setLoading(false);
      }
    };

    fetchGuide();
    // Poll every 5 seconds if still loading
    const interval = setInterval(() => {
      if (loading) fetchGuide();
    }, 5000);

    return () => clearInterval(interval);
  }, [assignmentId, loading, chatMessages.length]);

  const handleSubmitUpdate = async () => {
    if (!updateText.trim()) return;

    setSubmittingUpdate(true);
    try {
      // TODO: Call API to submit update
      // await submitHelperUpdate(assignmentId, updateText);

      // Simulate API call for now
      await new Promise(resolve => setTimeout(resolve, 500));

      // Add user message to chat
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        text: updateText,
        timestamp: new Date(),
        sender: 'user',
      };

      // Generate relevant Hero Agent follow-up question based on update
      const generateFollowUpQuestion = (update: string): string => {
        const lowerUpdate = update.toLowerCase();

        if (lowerUpdate.includes('arrived') || lowerUpdate.includes('location')) {
          return "Great! You've arrived at the location. Can you confirm visual contact with the person in need? What's the current situation?";
        } else if (lowerUpdate.includes('problem') || lowerUpdate.includes('issue') || lowerUpdate.includes('difficult')) {
          return "I understand there are new challenges. Should we request additional helpers nearby to assist you? What specific resources do you need?";
        } else if (lowerUpdate.includes('more info') || lowerUpdate.includes('unclear') || lowerUpdate.includes('question')) {
          return "I'll help you get more information from the caller. What specific details do you need to proceed safely?";
        } else if (lowerUpdate.includes('complete') || lowerUpdate.includes('done') || lowerUpdate.includes('resolved')) {
          return "Excellent work! Can you confirm the person is now safe? Do they need any follow-up assistance or medical attention?";
        } else if (lowerUpdate.includes('medical') || lowerUpdate.includes('injury') || lowerUpdate.includes('hurt')) {
          return "Medical situation noted. Do you need emergency medical services dispatched? Should I request helpers with medical training nearby?";
        } else if (lowerUpdate.includes('multiple') || lowerUpdate.includes('more people') || lowerUpdate.includes('group')) {
          return "Multiple people detected. This may require additional support. Should we request more helpers to assist with the increased number of people?";
        } else {
          return "Thank you for the update. Your situation has been logged. Is there anything specific you need assistance with right now?";
        }
      };

      // Simulate Hero Agent response with contextual follow-up
      const heroResponse: ChatMessage = {
        id: `hero-${Date.now()}`,
        text: generateFollowUpQuestion(updateText),
        timestamp: new Date(),
        sender: 'hero_agent',
      };

      setChatMessages(prev => [...prev, userMessage, heroResponse]);

      // Clear input
      setUpdateText('');

    } catch (err) {
      console.error('Failed to submit update:', err);
      alert('Failed to submit update. Please try again.');
    } finally {
      setSubmittingUpdate(false);
    }
  };

  // Quick action buttons for common status updates
  const quickActions = [
    { label: "Arrived at Location", value: "I have arrived at the person's location." },
    { label: "Request More Info", value: "I need more information from the caller to proceed safely." },
    { label: "Request Nearby Helpers", value: "The situation requires additional helpers. Can you find helpers nearby to assist?" },
    { label: "Assistance Complete", value: "I have successfully provided assistance. The person is now safe." },
  ];

  const generateContextualResponse = (actionValue: string): ChatMessage => {
    const lowerAction = actionValue.toLowerCase();

    if (lowerAction.includes('arrived')) {
      return {
        id: `hero-${Date.now()}`,
        text: "Great! You've arrived. Please assess the immediate situation and select what you observe:",
        timestamp: new Date(),
        sender: 'hero_agent',
      };
    } else if (lowerAction.includes('more info')) {
      return {
        id: `hero-${Date.now()}`,
        text: "I'll contact the caller for additional details. What specific information do you need most urgently?",
        timestamp: new Date(),
        sender: 'hero_agent',
      };
    } else if (lowerAction.includes('additional helpers')) {
      return {
        id: `hero-${Date.now()}`,
        text: "Understood. I'm searching for nearby helpers with relevant skills. What specific assistance do you need?",
        timestamp: new Date(),
        sender: 'hero_agent',
      };
    } else if (lowerAction.includes('complete') || lowerAction.includes('safe')) {
      return {
        id: `hero-${Date.now()}`,
        text: "Excellent work! Please confirm the final status before we close this case:",
        timestamp: new Date(),
        sender: 'hero_agent',
      };
    } else {
      return {
        id: `hero-${Date.now()}`,
        text: "Update received. Continue following the guidance provided. Let me know if the situation changes.",
        timestamp: new Date(),
        sender: 'hero_agent',
      };
    }
  };

  const handleQuickAction = async (actionValue: string, actionLabel: string) => {
    setSubmittingUpdate(true);
    try {
      // Immediately send the quick action
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        text: actionLabel,
        timestamp: new Date(),
        sender: 'user',
      };

      // Generate contextual response
      const heroResponse = generateContextualResponse(actionValue);

      setChatMessages(prev => [...prev, userMessage, heroResponse]);

    } catch (err) {
      console.error('Failed to submit update:', err);
    } finally {
      setSubmittingUpdate(false);
    }
  };

  const caseLocation: Location | null = caseData ? {
    lat: caseData.location.latitude,
    lng: caseData.location.longitude
  } : null;

  const helpRequest: HelpRequest | null = caseData ? {
    id: caseData.case_id.toString(),
    disasterId: 'default-testing',
    userId: caseData.caller_user_id?.toString() || 'anonymous',
    userName: 'Victim',
    type: 'medical',
    location: { lat: caseData.location.latitude, lng: caseData.location.longitude },
    peopleCount: caseData.people_count || 0,
    urgency: caseData.urgency,
    status: caseData.status === 'assigned' || caseData.status === 'in_progress' ? 'in_progress' : caseData.status === 'resolved' || caseData.status === 'closed' ? 'resolved' : 'pending',
    description: caseData.description || caseData.raw_problem_description,
    createdAt: new Date(caseData.created_at),
    vulnerabilityFactors: caseData.vulnerability_factors || [],
    mobilityStatus: caseData.mobility_status || undefined,
    timestamp: caseData.created_at,
  } : null;

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return 'text-red-400 bg-red-500/20 border-red-500/30';
      case 'high':
        return 'text-orange-400 bg-orange-500/20 border-orange-500/30';
      case 'medium':
        return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      default:
        return 'text-green-400 bg-green-500/20 border-green-500/30';
    }
  };

  // Drag handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setDragStartY(e.touches[0].clientY);
    setCurrentY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    setCurrentY(e.touches[0].clientY);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const deltaY = currentY - dragStartY;
    const threshold = 100; // Minimum drag distance to trigger position change

    if (panelPosition === 'top' && deltaY > threshold) {
      setPanelPosition('bottom');
    } else if (panelPosition === 'bottom' && deltaY < -threshold) {
      setPanelPosition('top');
    }

    setCurrentY(0);
    setDragStartY(0);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStartY(e.clientY);
    setCurrentY(e.clientY);
  };

  // Add mouse move/up listeners
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setCurrentY(e.clientY);
    };

    const handleMouseUp = () => {
      setIsDragging(false);

      const deltaY = currentY - dragStartY;
      const threshold = 100;

      if (panelPosition === 'top' && deltaY > threshold) {
        setPanelPosition('bottom');
      } else if (panelPosition === 'bottom' && deltaY < -threshold) {
        setPanelPosition('top');
      }

      setCurrentY(0);
      setDragStartY(0);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, currentY, dragStartY, panelPosition]);

  // Stable callback for route calculation
  const handleRouteCalculated = useCallback((distance: string, duration: string) => {
    setRouteDistance(distance);
    setRouteDuration(duration);
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col">
      {/* Full Screen Map */}
      <div className="flex-1 relative">
        {caseLocation ? (
          <>
            <RouteMap
              helperLocation={helperLocation}
              victimLocation={caseLocation}
              onRouteCalculated={handleRouteCalculated}
              travelMode={travelMode}
            />

            {/* Assignment Status Bar - Top horizontal */}
            <div className="absolute top-4 left-4 right-4 z-10">
              <div className="glass rounded-2xl p-4 border border-white/10 shadow-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-sm text-white font-semibold">Active Assignment #{assignmentId}</span>
                  </div>
                  {caseData && (
                    <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs ${getUrgencyColor(caseData.urgency)}`}>
                      <AlertTriangle className="w-3 h-3" />
                      <span className="font-semibold uppercase">{caseData.urgency}</span>
                    </div>
                  )}
                </div>
                {caseData && (routeDistance || caseData.people_count) && (
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/10">
                    {routeDistance && routeDuration && (
                      <>
                        <div className="flex items-center gap-1.5 text-xs text-gray-300">
                          <Navigation className="w-3.5 h-3.5 text-blue-400" />
                          <span className="font-semibold">{routeDistance}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-300">
                          <Clock className="w-3.5 h-3.5 text-blue-400" />
                          <span className="font-semibold">{routeDuration}</span>
                        </div>
                      </>
                    )}
                    {caseData.people_count > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-300">
                        <Users className="w-3.5 h-3.5 text-gray-400" />
                        <span className="font-semibold">{caseData.people_count} people</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Travel Mode Selector - Top Right below status */}
            <div className="absolute top-36 right-4 z-10 flex gap-2">
              <button
                onClick={() => setTravelMode('DRIVING')}
                className={`
                  w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 p-2
                  ${travelMode === 'DRIVING'
                    ? 'bg-blue-500/80 border-2 border-blue-300 shadow-lg shadow-blue-500/50'
                    : 'glass border border-white/20 hover:border-white/40'
                  }
                `}
                title="Driving"
              >
                <img src="/assets/car.png" alt="Car" className="w-full h-full object-contain" />
              </button>
              <button
                onClick={() => setTravelMode('WALKING')}
                className={`
                  w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 p-2
                  ${travelMode === 'WALKING'
                    ? 'bg-blue-500/80 border-2 border-blue-300 shadow-lg shadow-blue-500/50'
                    : 'glass border border-white/20 hover:border-white/40'
                  }
                `}
                title="Walking"
              >
                <img src="/assets/walk.png" alt="Walk" className="w-full h-full object-contain" />
              </button>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 bg-background-primary flex items-center justify-center">
            <div className="glass p-6 rounded-lg">
              <p className="text-gray-400">Loading case location...</p>
            </div>
          </div>
        )}
      </div>

      {/* Draggable Info Panel */}
      <div
        className={`
          fixed left-0 right-0 z-20 glass flex flex-col transition-all duration-300 ease-out
          ${panelPosition === 'top' ? 'top-[30vh]' : 'top-[calc(100vh-120px)]'}
        `}
        style={{
          height: 'calc(100vh - 30vh)',
          transform: isDragging ? `translateY(${currentY - dragStartY}px)` : 'translateY(0)',
          transition: isDragging ? 'none' : 'all 0.3s ease-out',
        }}
      >
        {/* Apple-style Pull Handle */}
        <div
          className="flex-shrink-0 flex flex-col items-center py-2 cursor-grab active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
        >
          <div className="w-10 h-1.5 rounded-full bg-gray-400/40 mb-2" />
        </div>

        {/* Case Details Section */}
        {caseData && (
          <div className="p-4 border-b border-white/10 flex-shrink-0 bg-white/5">
            <h3 className="text-sm font-semibold text-white mb-2">Case Details</h3>
            <p className="text-sm text-gray-300 mb-2">{caseData.description || caseData.raw_problem_description}</p>
            {caseData.vulnerability_factors && caseData.vulnerability_factors.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {caseData.vulnerability_factors.map((factor, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-orange-500/20 border border-orange-500/30 rounded text-xs text-orange-200"
                  >
                    {factor}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Hero Agent Guidance - Full Width Markdown */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && chatMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full">
              <Clock className="w-8 h-8 text-blue-400 animate-pulse mb-3" />
              <p className="text-white font-medium">Hero Agent is analyzing the case...</p>
              <p className="text-gray-400 text-sm mt-1">Generating personalized guidance for responders</p>
            </div>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/10">
                <Shield className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-semibold text-white m-0">Hero Agent Guidance</h3>
              </div>
              {chatMessages.map((message, index) => (
                <div key={message.id} className="mb-4">
                  {message.sender === 'hero_agent' ? (
                    <div className="text-gray-200 leading-relaxed whitespace-pre-wrap">
                      {message.text}
                    </div>
                  ) : (
                    <div className="my-4 pl-4 border-l-2 border-green-500/50 bg-green-500/5 py-2">
                      <div className="text-xs text-green-400 font-semibold mb-1">Your Update</div>
                      <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                        {message.text}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  )}
                  {index < chatMessages.length - 1 && message.sender === 'hero_agent' && chatMessages[index + 1]?.sender === 'hero_agent' && (
                    <div className="my-3 h-px bg-white/10" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions Section - Instant Send Buttons */}
        <div className="p-3 border-t border-white/10 flex-shrink-0 bg-background-elevated/50">
          <p className="text-xs text-gray-400 mb-2">Quick Actions - Click to send instantly</p>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={() => handleQuickAction(action.value, action.label)}
                disabled={submittingUpdate}
                className="px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 disabled:bg-white/5 border border-blue-500/30 disabled:border-white/10 rounded-lg text-xs text-blue-300 disabled:text-gray-500 transition-all hover:scale-105 active:scale-95 font-medium disabled:cursor-not-allowed"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input Area - Bottom of chat */}
        <div className="p-4 border-t border-white/10 flex-shrink-0 bg-background-elevated/50">
          <p className="text-xs text-gray-400 mb-2">
            Send status update to Hero Agent
          </p>
          <div className="flex gap-2">
            <textarea
              value={updateText}
              onChange={(e) => setUpdateText(e.target.value)}
              placeholder="E.g., 'I've arrived at the location' or 'Need medical supplies'"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
              rows={2}
              disabled={submittingUpdate}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmitUpdate();
                }
              }}
            />
            <button
              onClick={handleSubmitUpdate}
              disabled={!updateText.trim() || submittingUpdate}
              className="px-4 h-auto bg-green-500/20 hover:bg-green-500/30 disabled:bg-white/5 border border-green-500/30 disabled:border-white/10 rounded-lg font-medium text-green-300 disabled:text-gray-500 transition-colors disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submittingUpdate ? (
                <Clock className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
