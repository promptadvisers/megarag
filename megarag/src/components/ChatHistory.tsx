'use client';

import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Trash2, Clock, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ChatHistoryProps {
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  refreshTrigger?: number;
}

export function ChatHistory({
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  refreshTrigger,
}: ChatHistoryProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/chat?limit=20');
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions);
      }
    } catch (err) {
      console.error('Error fetching chat sessions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [refreshTrigger]);

  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();

    try {
      const response = await fetch(`/api/chat/${sessionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        onDeleteSession?.(sessionId);
      }
    } catch (err) {
      console.error('Error deleting session:', err);
    }
  };

  const startEditing = (e: React.MouseEvent, session: ChatSession) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditTitle(session.title);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const cancelEditing = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingId(null);
    setEditTitle('');
  };

  const handleRename = async (e: React.MouseEvent | React.FormEvent, sessionId: string) => {
    e.stopPropagation();
    e.preventDefault();

    if (!editTitle.trim()) {
      cancelEditing();
      return;
    }

    try {
      const response = await fetch(`/api/chat/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle.trim() }),
      });

      if (response.ok) {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId ? { ...s, title: editTitle.trim() } : s
          )
        );
      }
    } catch (err) {
      console.error('Error renaming session:', err);
    } finally {
      setEditingId(null);
      setEditTitle('');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        Loading chats...
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="p-4 text-center">
        <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No chat history yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Start a conversation to see it here
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-1">
        {sessions.map((session) => (
          <div
            key={session.id}
            onClick={() => editingId !== session.id && onSelectSession(session.id)}
            className={cn(
              'group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors',
              currentSessionId === session.id
                ? 'bg-primary/10 text-primary'
                : 'hover:bg-muted'
            )}
          >
            <MessageSquare className="h-4 w-4 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              {editingId === session.id ? (
                <form onSubmit={(e) => handleRename(e, session.id)} className="flex items-center gap-1">
                  <Input
                    ref={inputRef}
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') cancelEditing();
                    }}
                    className="h-6 text-sm py-0 px-1"
                    autoFocus
                  />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0"
                    onClick={(e) => handleRename(e, session.id)}
                  >
                    <Check className="h-3 w-3 text-green-500" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0"
                    onClick={cancelEditing}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </form>
              ) : (
                <>
                  <p className="text-sm font-medium truncate">{session.title}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDate(session.updated_at)}
                  </p>
                </>
              )}
            </div>
            {editingId !== session.id && (
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => startEditing(e, session)}
                  title="Rename"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => handleDelete(e, session.id)}
                  title="Delete"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
