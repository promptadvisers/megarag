import Link from 'next/link';
import { FileText, MessageSquare, Zap, Database, ArrowRight, Sparkles, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components';

export default function Home() {
  return (
    <div className="min-h-screen animated-gradient">
      {/* Navigation */}
      <nav className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-2">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">Dashboard</Button>
            </Link>
            <Link href="/dashboard/chat">
              <Button variant="ghost" size="sm">
                <MessageSquare className="mr-2 h-4 w-4" />
                Chat
              </Button>
            </Link>
            <Link href="/admin">
              <Button size="sm">
                <Settings className="mr-2 h-4 w-4" />
                Admin
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="text-center max-w-4xl mx-auto animate-fade-in">
          <div className="flex justify-center mb-6">
            <Logo size="lg" />
          </div>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Upload <strong>anything</strong>. Query <strong>everything</strong>. Get answers <strong>instantly</strong>.
          </p>
          <p className="text-muted-foreground mb-8">
            A production-ready RAG system with knowledge graph indexing, multi-modal support, and intelligent retrieval.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/dashboard">
              <Button size="lg" className="w-full sm:w-auto group">
                Get Started
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/dashboard/chat">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                <Sparkles className="mr-2 h-5 w-5" />
                Try Chat
              </Button>
            </Link>
          </div>

          {/* File type badges */}
          <div className="flex flex-wrap justify-center gap-2 mt-8">
            {['PDF', 'DOCX', 'PPTX', 'XLSX', 'MP4', 'MP3', 'JPG', 'PNG'].map((type) => (
              <span
                key={type}
                className="px-3 py-1 bg-muted/80 text-muted-foreground text-sm rounded-full"
              >
                {type}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-4">Features</h2>
        <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
          Everything you need to build a production-ready RAG system
        </p>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <Card className="hover-lift animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Multi-Format Support</CardTitle>
              <CardDescription>
                Upload PDFs, Word docs, PowerPoints, Excel files, images, videos, and audio files
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Supports PDF, DOCX, PPTX, XLSX, TXT, MD, MP4, MP3, WAV, JPG, PNG, GIF, and WebP formats.
              </p>
            </CardContent>
          </Card>

          <Card className="hover-lift animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <Database className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Knowledge Graph</CardTitle>
              <CardDescription>
                Automatically extracts entities and relationships from your documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Uses Gemini to identify people, organizations, locations, events, and their connections.
              </p>
            </CardContent>
          </Card>

          <Card className="hover-lift animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Smart Retrieval</CardTitle>
              <CardDescription>
                Multiple query modes for different types of questions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Choose from naive, local, global, hybrid, or mix modes for optimal results.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tech Stack */}
      <div className="container mx-auto px-4 py-16 border-t">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-4">Built With</h2>
          <div className="flex flex-wrap justify-center gap-4 text-muted-foreground">
            <span className="px-4 py-2 bg-muted rounded-lg">Next.js 16</span>
            <span className="px-4 py-2 bg-muted rounded-lg">Supabase + pgvector</span>
            <span className="px-4 py-2 bg-muted rounded-lg">Gemini 2.0 Flash</span>
            <span className="px-4 py-2 bg-muted rounded-lg">Tailwind CSS</span>
            <span className="px-4 py-2 bg-muted rounded-lg">shadcn/ui</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Built with AI, for AI applications</p>
        </div>
      </footer>
    </div>
  );
}
