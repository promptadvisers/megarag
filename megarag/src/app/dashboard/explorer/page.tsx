'use client';

import Link from 'next/link';
import { ArrowLeft, Microscope, MessageSquare, FileStack, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataExplorer, ThemeToggle } from '@/components';

export default function ExplorerPage() {
  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex-shrink-0 border-b">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Documents
                </Button>
              </Link>
              <div className="h-6 w-px bg-border hidden sm:block" />
              <div className="hidden sm:block">
                <div className="flex items-center gap-2">
                  <Microscope className="h-5 w-5 text-primary" />
                  <h1 className="text-xl font-bold">Data Explorer</h1>
                </div>
                <p className="text-xs text-muted-foreground">
                  X-ray view into chunks, entities, and relationships
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link href="/dashboard/chat">
                <Button variant="outline" size="sm">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Chat
                </Button>
              </Link>
              <Link href="/dashboard" className="hidden sm:block">
                <Button variant="outline" size="sm">
                  <FileStack className="h-4 w-4 mr-2" />
                  Documents
                </Button>
              </Link>
              <Link href="/admin" className="hidden sm:block">
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Admin
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 min-h-0">
        <DataExplorer />
      </main>
    </div>
  );
}
