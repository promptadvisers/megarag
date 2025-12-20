'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileStack, History, PanelLeftClose, PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatInterface, ChatHistory, ThemeToggle, Logo } from '@/components';

export default function ChatPage() {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showSidebar, setShowSidebar] = useState(true);

  const handleSessionChange = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId);
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const handleNewChat = useCallback(() => {
    setCurrentSessionId(null);
  }, []);

  const handleDeleteSession = useCallback((deletedId: string) => {
    if (currentSessionId === deletedId) {
      setCurrentSessionId(null);
    }
  }, [currentSessionId]);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex-shrink-0 border-b bg-background/80 backdrop-blur-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSidebar(!showSidebar)}
                className="md:hidden"
              >
                {showSidebar ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
              </Button>
              <Link href="/dashboard" className="flex items-center gap-2">
                <Logo size="sm" showText={false} />
                <Button variant="ghost" size="sm" className="px-2">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              </Link>
              <div className="h-6 w-px bg-border hidden sm:block" />
              <div className="hidden sm:block">
                <h1 className="text-xl font-bold">Chat with Documents</h1>
                <p className="text-xs text-muted-foreground">
                  Ask questions about your uploaded documents
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link href="/dashboard" className="hidden sm:block">
                <Button variant="outline" size="sm">
                  <FileStack className="h-4 w-4 mr-2" />
                  Manage Documents
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main content with sidebar */}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar - Chat History */}
        <aside
          className={`
            ${showSidebar ? 'w-64' : 'w-0'}
            flex-shrink-0 border-r bg-muted/30 transition-all duration-200 overflow-hidden
            hidden md:block
          `}
        >
          <div className="h-full flex flex-col w-64">
            <div className="p-3 border-b flex items-center gap-2">
              <History className="h-4 w-4" />
              <span className="font-medium text-sm">Chat History</span>
            </div>
            <div className="flex-1 min-h-0">
              <ChatHistory
                currentSessionId={currentSessionId}
                onSelectSession={setCurrentSessionId}
                onDeleteSession={handleDeleteSession}
                refreshTrigger={refreshTrigger}
              />
            </div>
          </div>
        </aside>

        {/* Chat Interface */}
        <main className="flex-1 min-h-0">
          <div className="h-full">
            <ChatInterface
              sessionId={currentSessionId}
              onSessionChange={handleSessionChange}
              onNewChat={handleNewChat}
              defaultMode="mix"
            />
          </div>
        </main>
      </div>
    </div>
  );
}
