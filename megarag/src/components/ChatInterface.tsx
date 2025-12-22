'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Sparkles, Plus, HelpCircle, Search, Users, GitBranch, Layers, Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ChatMessage } from './ChatMessage';
import { SourceReferences } from './SourceReferences';
import type { QueryMode, QueryResponse } from '@/types';
import { AVAILABLE_MODELS, type GeminiModelId } from '@/lib/gemini/models';
import { DEFAULT_SYSTEM_PROMPT } from '@/lib/rag/constants';

/**
 * Message type for chat history
 */
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: QueryResponse['sources'];
  entities?: QueryResponse['entities'];
  timestamp: Date;
}

interface ChatInterfaceProps {
  sessionId?: string | null;
  onSessionChange?: (sessionId: string) => void;
  onNewChat?: () => void;
  defaultMode?: QueryMode;
}

/**
 * Query mode descriptions
 */
const MODE_DESCRIPTIONS: Record<QueryMode, string> = {
  naive: 'Vector search on chunks only - best for simple fact lookup',
  local: 'Search entities, get related chunks - best for entity-focused queries',
  global: 'Search relations, traverse graph - best for relationship queries',
  hybrid: 'Combine local + global modes - balanced retrieval',
  mix: 'Full hybrid: chunks + entities + relations - recommended for complex queries',
};

/**
 * ChatInterface component - main chat UI with query mode selector
 */
export function ChatInterface({
  sessionId,
  onSessionChange,
  onNewChat,
  defaultMode = 'mix'
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [queryMode, setQueryMode] = useState<QueryMode>(defaultMode);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(sessionId || null);

  // Chat settings state
  const [systemPrompt, setSystemPrompt] = useState<string>(DEFAULT_SYSTEM_PROMPT);
  const [selectedModel, setSelectedModel] = useState<GeminiModelId>('gemini-2.5-flash');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tempSystemPrompt, setTempSystemPrompt] = useState<string>(DEFAULT_SYSTEM_PROMPT);
  const [tempModel, setTempModel] = useState<GeminiModelId>('gemini-2.5-flash');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load messages when session changes
  useEffect(() => {
    if (sessionId) {
      setCurrentSessionId(sessionId);
      loadSession(sessionId);
    } else {
      setCurrentSessionId(null);
      setMessages([]);
    }
  }, [sessionId]);

  const loadSession = async (sid: string) => {
    try {
      const response = await fetch(`/api/chat/${sid}`);
      if (response.ok) {
        const data = await response.json();
        const loadedMessages: Message[] = data.messages.map((m: {
          id: string;
          role: 'user' | 'assistant';
          content: string;
          sources?: QueryResponse['sources'];
          entities?: QueryResponse['entities'];
          created_at: string;
        }) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          sources: m.sources,
          entities: m.entities,
          timestamp: new Date(m.created_at),
        }));
        setMessages(loadedMessages);

        // Load session settings
        if (data.session) {
          const sessionSystemPrompt = data.session.system_prompt || DEFAULT_SYSTEM_PROMPT;
          const sessionModel = (data.session.model as GeminiModelId) || 'gemini-2.5-flash';
          setSystemPrompt(sessionSystemPrompt);
          setSelectedModel(sessionModel);
          setTempSystemPrompt(sessionSystemPrompt);
          setTempModel(sessionModel);
        }
      }
    } catch (err) {
      console.error('Error loading session:', err);
    }
  };

  const createSession = async (): Promise<string> => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'New Chat',
        system_prompt: systemPrompt !== DEFAULT_SYSTEM_PROMPT ? systemPrompt : null,
        model: selectedModel,
      }),
    });
    const data = await response.json();
    return data.sessionId;
  };

  const saveSettings = async () => {
    setIsSavingSettings(true);
    try {
      // Update local state
      setSystemPrompt(tempSystemPrompt);
      setSelectedModel(tempModel);

      // If we have a session, save to database
      if (currentSessionId) {
        await fetch(`/api/chat/${currentSessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_prompt: tempSystemPrompt !== DEFAULT_SYSTEM_PROMPT ? tempSystemPrompt : null,
            model: tempModel,
          }),
        });
      }

      setSettingsOpen(false);
    } catch (err) {
      console.error('Error saving settings:', err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const resetToDefaults = () => {
    setTempSystemPrompt(DEFAULT_SYSTEM_PROMPT);
    setTempModel('gemini-2.5-flash');
  };

  const saveMessage = async (
    sid: string,
    message: Message,
    queryModeUsed?: string
  ) => {
    try {
      await fetch(`/api/chat/${sid}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: message.role,
          content: message.content,
          sources: message.sources || [],
          entities: message.entities || [],
          query_mode: queryModeUsed,
        }),
      });
    } catch (err) {
      console.error('Error saving message:', err);
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;

    // Create session if none exists
    let sid = currentSessionId;
    if (!sid) {
      sid = await createSession();
      setCurrentSessionId(sid);
      onSessionChange?.(sid);
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setError(null);
    setIsLoading(true);

    // Save user message
    await saveMessage(sid, userMessage, queryMode);

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: userMessage.content,
          mode: queryMode,
          top_k: 10,
          system_prompt: systemPrompt !== DEFAULT_SYSTEM_PROMPT ? systemPrompt : undefined,
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Query failed');
      }

      const data: QueryResponse = await response.json();

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.response,
        sources: data.sources,
        entities: data.entities,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Save assistant message
      await saveMessage(sid, assistantMessage, queryMode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');

      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I encountered an error: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      await saveMessage(sid, errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setSelectedMessage(null);
    setError(null);
    // Reset settings to defaults for new chat
    setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
    setSelectedModel('gemini-2.5-flash');
    setTempSystemPrompt(DEFAULT_SYSTEM_PROMPT);
    setTempModel('gemini-2.5-flash');
    onNewChat?.();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Mode selector header */}
      <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-2">
            <Select value={queryMode} onValueChange={(v) => setQueryMode(v as QueryMode)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mix">
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-3 w-3" />
                    Mix
                  </span>
                </SelectItem>
                <SelectItem value="hybrid">Hybrid</SelectItem>
                <SelectItem value="local">Local</SelectItem>
                <SelectItem value="global">Global</SelectItem>
                <SelectItem value="naive">Naive</SelectItem>
              </SelectContent>
            </Select>

            {/* Help button with dialog */}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Search Modes Explained</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="flex gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold flex items-center gap-2">
                        Mix
                        <Badge variant="secondary" className="text-[10px]">Recommended</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        The most comprehensive search. Looks through your document text,
                        finds relevant people/places/things, and traces their connections.
                        Best for complex questions where you need the full picture.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 p-3 rounded-lg border">
                    <Layers className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold">Hybrid</div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Combines entity search with relationship search. Good balance
                        between speed and thoroughness for most questions.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 p-3 rounded-lg border">
                    <Users className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold">Local</div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Focuses on finding specific entities (people, companies, places).
                        Best for questions like "Tell me about John Smith" or
                        "What do you know about Acme Corp?"
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 p-3 rounded-lg border">
                    <GitBranch className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold">Global</div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Explores connections and relationships between things.
                        Best for questions like "How is X related to Y?" or
                        "What's the connection between these events?"
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 p-3 rounded-lg border">
                    <Search className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold">Naive</div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Simple text search through your documents. Fast but less
                        intelligent. Good for quick fact lookups like
                        "What date did X happen?"
                      </p>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex items-center gap-2">
            {/* Settings button */}
            <Dialog open={settingsOpen} onOpenChange={(open) => {
              setSettingsOpen(open);
              if (open) {
                setTempSystemPrompt(systemPrompt);
                setTempModel(selectedModel);
              }
            }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-1" />
                  Settings
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Chat Settings</DialogTitle>
                  <DialogDescription>
                    Customize how the AI responds. These settings are saved per chat session.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                  {/* Model Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="model">AI Model</Label>
                    <Select value={tempModel} onValueChange={(v) => setTempModel(v as GeminiModelId)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(AVAILABLE_MODELS).map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            <div className="flex flex-col items-start">
                              <span>{model.name}</span>
                              <span className="text-xs text-muted-foreground">{model.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Choose the model for generating responses. Pro models are more capable but slower.
                    </p>
                  </div>

                  {/* System Prompt */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="system-prompt">System Prompt</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={resetToDefaults}
                        className="text-xs"
                      >
                        Reset to Default
                      </Button>
                    </div>
                    <Textarea
                      id="system-prompt"
                      value={tempSystemPrompt}
                      onChange={(e) => setTempSystemPrompt(e.target.value)}
                      placeholder="Enter custom instructions for the AI..."
                      className="min-h-[200px] font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      The system prompt controls how the AI behaves and responds. Customize to change
                      tone, format, or add specific instructions.
                    </p>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setSettingsOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={saveSettings} disabled={isSavingSettings}>
                    {isSavingSettings ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Settings'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button variant="outline" size="sm" onClick={handleNewChat}>
              <Plus className="h-4 w-4 mr-1" />
              New Chat
            </Button>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Ask about your documents</h3>
            <p className="text-muted-foreground max-w-md">
              I can answer questions about your uploaded documents using RAG (Retrieval-Augmented Generation).
              Try asking about specific topics, entities, or relationships.
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              <Badge variant="outline">Entities</Badge>
              <Badge variant="outline">Relationships</Badge>
              <Badge variant="outline">Source Citations</Badge>
            </div>
          </div>
        ) : (
          <div className="divide-y">
            {messages.map((message) => (
              <div
                key={message.id}
                onClick={() => message.role === 'assistant' && message.sources?.length ? setSelectedMessage(message) : null}
                className={message.role === 'assistant' && message.sources?.length ? 'cursor-pointer' : ''}
              >
                <ChatMessage
                  role={message.role}
                  content={message.content}
                  sources={message.sources}
                  timestamp={message.timestamp}
                />
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="p-4 flex items-center gap-3 bg-muted/30">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Searching documents and generating response...
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Source panel (side panel when message is selected) */}
      {selectedMessage && selectedMessage.sources && selectedMessage.sources.length > 0 && (
        <div className="flex-shrink-0 border-t max-h-[300px] overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Detailed Sources</span>
              <Button variant="ghost" size="sm" onClick={() => setSelectedMessage(null)}>
                Close
              </Button>
            </div>
            <SourceReferences sources={selectedMessage.sources} />
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="flex-shrink-0 border-t bg-background p-4">
        {error && (
          <div className="mb-3 p-2 bg-destructive/10 text-destructive text-sm rounded">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your documents..."
            className="min-h-[44px] max-h-[200px] resize-none"
            disabled={isLoading}
            rows={1}
          />
          <Button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="flex-shrink-0 h-[44px] w-[44px]"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
