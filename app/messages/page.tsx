'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  MessageSquare, Mail, Send, TrendingUp, ArrowDown,
  Search, X, Phone, RefreshCw, Loader2, CheckCircle2,
  Circle
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/dashboard/StatCard';

const BUSINESS_ID = 'ab445992-80fd-46d0-bec0-138a86e1d607';

interface Message {
  id: string;
  client_id: string;
  client_name: string;
  client_phone?: string;
  channel: 'sms' | 'email';
  direction: 'outbound' | 'inbound';
  message_type: string;
  content: string;
  sent_at: string;
  status: 'sent' | 'delivered' | 'failed' | 'replied';
  sentiment?: 'positive' | 'negative' | 'neutral';
}

interface Thread {
  client_id: string;
  client_name: string;
  client_phone: string;
  last_message: string;
  last_time: string;
  unread: boolean;
  channel: 'sms' | 'email';
  messages: Message[];
}

const MSG_TYPES = ['Confirmation', 'Follow-up', 'Review Request', 'Reactivation', 'Nurture'];

const TYPE_COLORS: Record<string, string> = {
  confirmation: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  followup: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  follow_up: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  review_request: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  reactivation: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  nurture: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
};

const QUICK_TEMPLATES = [
  { label: 'Appt Reminder', text: 'Hi {name}! Reminder about your appointment tomorrow. Reply CONFIRM to confirm or call to reschedule.' },
  { label: 'Follow-up', text: "Hi {name}! Following up after your recent visit — how are you feeling? We're here if you have questions." },
  { label: 'Review Request', text: 'Hi {name}! Thank you for visiting us. Could you leave us a quick Google review? It helps so much: {link}' },
  { label: 'Reactivation', text: "Hi {name}! We miss you! It's been a while since your last visit. Book now and get priority scheduling this week." },
  { label: 'Special Offer', text: 'Hi {name}! We have a special running this week just for you. Reply or call to book before spots are gone.' },
];

export default function MessagesPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<'all' | 'sms' | 'email'>('all');

  const [composeTo, setComposeTo] = useState('');
  const [composeContent, setComposeContent] = useState('');
  const [composeChannel, setComposeChannel] = useState<'sms' | 'email'>('sms');
  const [composeName, setComposeName] = useState('');
  const [composeSending, setComposeSending] = useState(false);
  const [composeSent, setComposeSent] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/messages/send?businessId=${BUSINESS_ID}&limit=200`);
      const data = await res.json();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msgs: Message[] = (data.messages || []).map((m: any) => ({
        id: m.id,
        client_id: m.client_id || '',
        client_name: m.clients ? `${m.clients.first_name || ''} ${m.clients.last_name || ''}`.trim() : 'Unknown',
        client_phone: m.clients?.phone || m.to_number || '',
        channel: m.channel as 'sms' | 'email',
        direction: m.direction as 'outbound' | 'inbound',
        message_type: m.message_type || 'nurture',
        content: m.content,
        sent_at: m.sent_at || m.created_at,
        status: m.status || 'sent',
        sentiment: m.sentiment || 'neutral',
      }));

      setAllMessages(msgs);

      const threadMap: Record<string, Thread> = {};
      msgs.forEach(msg => {
        const key = msg.client_id || msg.client_name;
        if (!threadMap[key]) {
          threadMap[key] = {
            client_id: msg.client_id,
            client_name: msg.client_name,
            client_phone: msg.client_phone || '',
            last_message: msg.content,
            last_time: msg.sent_at,
            unread: msg.direction === 'inbound',
            channel: msg.channel,
            messages: [],
          };
        }
        threadMap[key].messages.push(msg);
        if (new Date(msg.sent_at) > new Date(threadMap[key].last_time)) {
          threadMap[key].last_message = msg.content;
          threadMap[key].last_time = msg.sent_at;
          if (msg.direction === 'inbound') threadMap[key].unread = true;
        }
      });

      const sorted = Object.values(threadMap).sort(
        (a, b) => new Date(b.last_time).getTime() - new Date(a.last_time).getTime()
      );

      setThreads(sorted.length > 0 ? sorted : MOCK_THREADS);
      if (sorted.length === 0) setAllMessages(MOCK_THREADS.flatMap(t => t.messages));
    } catch {
      setThreads(MOCK_THREADS);
      setAllMessages(MOCK_THREADS.flatMap(t => t.messages));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);
  useEffect(() => {
    if (selectedThread) setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, [selectedThread?.client_id]);

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedThread) return;
    setReplySending(true);
    try {
      await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: selectedThread.channel,
          to: selectedThread.client_phone,
          content: replyText,
          clientId: selectedThread.client_id,
          messageType: 'nurture',
        }),
      });
      const newMsg: Message = {
        id: Date.now().toString(),
        client_id: selectedThread.client_id,
        client_name: selectedThread.client_name,
        channel: selectedThread.channel,
        direction: 'outbound',
        message_type: 'nurture',
        content: replyText,
        sent_at: new Date().toISOString(),
        status: 'sent',
      };
      setSelectedThread(prev => prev ? { ...prev, messages: [...prev.messages, newMsg] } : prev);
      setReplyText('');
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } finally {
      setReplySending(false);
    }
  };

  const handleComposeSend = async () => {
    if (!composeTo.trim() || !composeContent.trim()) return;
    setComposeSending(true);
    try {
      await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: composeChannel,
          to: composeTo,
          content: composeContent,
          messageType: 'nurture',
        }),
      });
      setComposeSent(true);
      setComposeTo('');
      setComposeContent('');
      setComposeName('');
      setTimeout(() => { setComposeSent(false); setShowCompose(false); }, 2500);
      fetchMessages();
    } finally {
      setComposeSending(false);
    }
  };

  const applyTemplate = (tpl: { text: string }) => {
    const txt = tpl.text
      .replace('{name}', composeName || 'there')
      .replace('{link}', 'https://g.page/r/review');
    setComposeContent(txt);
  };

  const applyReplyTemplate = (tpl: { text: string }) => {
    if (!selectedThread) return;
    const txt = tpl.text
      .replace('{name}', selectedThread.client_name.split(' ')[0])
      .replace('{link}', 'https://g.page/r/review');
    setReplyText(txt);
  };

  const filteredThreads = threads.filter(t => {
    if (channelFilter !== 'all' && t.channel !== channelFilter) return false;
    if (searchQuery && !t.client_name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !t.last_message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const totalSent = allMessages.filter(m => m.direction === 'outbound').length;
  const delivered = allMessages.filter(m => ['delivered', 'replied'].includes(m.status)).length;
  const replied = allMessages.filter(m => m.status === 'replied').length;
  const inbound = allMessages.filter(m => m.direction === 'inbound').length;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* ── Thread Sidebar ─────────────────────────────────────────────── */}
      <div className="w-72 flex-shrink-0 border-r border-border flex flex-col bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl">
        <div className="p-4 border-b border-border space-y-2">
          <div className="flex items-center justify-between">
            <h1 className="text-base font-semibold">Messages</h1>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={fetchMessages}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" className="h-7 gap-1 text-xs px-2.5" onClick={() => setShowCompose(true)}>
                <Send className="h-3 w-3" /> New
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              className="w-full h-8 pl-8 pr-3 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Search..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-1">
            {(['all', 'sms', 'email'] as const).map(ch => (
              <button
                key={ch}
                onClick={() => setChannelFilter(ch)}
                className={`flex-1 h-6 text-xs rounded-md font-medium transition-colors ${
                  channelFilter === ch ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                {ch === 'all' ? 'All' : ch.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : filteredThreads.length === 0 ? (
            <p className="text-center py-8 text-sm text-muted-foreground">No threads</p>
          ) : filteredThreads.map(thread => (
            <button
              key={thread.client_id || thread.client_name}
              onClick={() => setSelectedThread(thread)}
              className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left border-b border-border/40 ${
                selectedThread?.client_id === thread.client_id ? 'bg-primary/5 border-l-2 border-l-primary' : ''
              }`}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                thread.unread ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                {thread.client_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className={`text-sm ${thread.unread ? 'font-semibold' : 'font-medium'} truncate`}>{thread.client_name}</p>
                  <p className="text-xs text-muted-foreground ml-1 flex-shrink-0">
                    {formatDistanceToNow(new Date(thread.last_time), { addSuffix: false })}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {thread.channel === 'sms'
                    ? <MessageSquare className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    : <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  }
                  <p className="text-xs text-muted-foreground truncate">{thread.last_message}</p>
                </div>
              </div>
              {thread.unread && <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />}
            </button>
          ))}
        </div>

        {/* Footer stats */}
        <div className="grid grid-cols-3 gap-0 border-t border-border text-center py-2">
          {[['Sent', totalSent], ['Replies', replied], ['Inbox', inbound]].map(([label, val]) => (
            <div key={label as string} className="py-1">
              <p className="text-xs font-semibold">{val}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Chat / Dashboard ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-muted/20">
        {selectedThread ? (
          <>
            {/* Chat header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                  {selectedThread.client_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold">{selectedThread.client_name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    {selectedThread.channel === 'sms' ? <Phone className="h-2.5 w-2.5" /> : <Mail className="h-2.5 w-2.5" />}
                    {selectedThread.client_phone || 'No contact'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={`text-xs border-0 ${selectedThread.channel === 'sms' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-violet-100 text-violet-700'}`}>
                  {selectedThread.channel.toUpperCase()}
                </Badge>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setSelectedThread(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {selectedThread.messages
                .sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime())
                .map(msg => (
                  <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl shadow-sm ${
                      msg.direction === 'outbound'
                        ? 'bg-primary text-primary-foreground rounded-tr-sm'
                        : 'bg-white dark:bg-gray-800 border border-border rounded-tl-sm'
                    }`}>
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                      <div className={`flex items-center gap-1.5 mt-1 ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                        <span className={`text-xs ${msg.direction === 'outbound' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          {format(new Date(msg.sent_at), 'h:mm a')}
                        </span>
                        {msg.direction === 'outbound' && (
                          ['delivered', 'replied'].includes(msg.status)
                            ? <CheckCircle2 className="h-3 w-3 text-primary-foreground/70" />
                            : <Circle className="h-3 w-3 text-primary-foreground/40" />
                        )}
                        {msg.message_type && msg.message_type !== 'nurture' && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            msg.direction === 'outbound'
                              ? 'bg-white/20 text-primary-foreground/70'
                              : (TYPE_COLORS[msg.message_type] || 'bg-muted text-muted-foreground')
                          }`}>
                            {msg.message_type.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              <div ref={chatEndRef} />
            </div>

            {/* Reply */}
            <div className="p-4 border-t border-border bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm">
              <div className="flex gap-1.5 flex-wrap mb-2">
                {QUICK_TEMPLATES.map(tpl => (
                  <button
                    key={tpl.label}
                    onClick={() => applyReplyTemplate(tpl)}
                    className="text-xs px-2 py-1 bg-muted/60 hover:bg-primary/10 hover:text-primary rounded-full transition-colors"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="flex-1 h-10 px-4 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder={`Reply via ${selectedThread.channel.toUpperCase()}...`}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                />
                <Button onClick={handleSendReply} disabled={replySending || !replyText.trim()} className="h-10 gap-1.5">
                  {replySending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </>
        ) : (
          /* No thread selected — stats view */
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Communication Hub</h2>
              <p className="text-sm text-muted-foreground mt-1">All SMS and email conversations in one place</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard title="Total Sent" value={totalSent} icon={Send} variant="primary" />
              <StatCard title="Delivery Rate" value={totalSent > 0 ? `${((delivered / totalSent) * 100).toFixed(0)}%` : '—'} icon={TrendingUp} variant="success" />
              <StatCard title="Reply Rate" value={totalSent > 0 ? `${((replied / totalSent) * 100).toFixed(0)}%` : '—'} icon={MessageSquare} variant="info" />
              <StatCard title="Inbound" value={inbound} icon={ArrowDown} variant="warning" />
            </div>
            <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-xl border-white/20 dark:border-gray-700/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Message Types</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap">
                  {MSG_TYPES.map(type => {
                    const key = type.toLowerCase().replace(/ /g, '_').replace(/-/g, '_');
                    const count = allMessages.filter(m => m.message_type === key || m.message_type === type.toLowerCase()).length;
                    return (
                      <div key={type} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${TYPE_COLORS[key] || 'bg-muted text-muted-foreground'}`}>
                        <span className="font-medium">{type}</span>
                        <span className="font-semibold">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Select a conversation or compose a new message</p>
              <Button className="mt-4 gap-2" onClick={() => setShowCompose(true)}>
                <Send className="h-4 w-4" /> Compose Message
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Compose Modal ──────────────────────────────────────────────── */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg border border-border">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-base font-semibold">New Message</h3>
              <button onClick={() => setShowCompose(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-2">
                {(['sms', 'email'] as const).map(ch => (
                  <button
                    key={ch}
                    onClick={() => setComposeChannel(ch)}
                    className={`flex-1 flex items-center justify-center gap-2 h-9 rounded-lg text-sm font-medium transition-colors ${
                      composeChannel === ch ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {ch === 'sms' ? <MessageSquare className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                    {ch.toUpperCase()}
                  </button>
                ))}
              </div>
              <input
                className="w-full h-10 px-4 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Client first name (for personalization)"
                value={composeName}
                onChange={e => setComposeName(e.target.value)}
              />
              <input
                className="w-full h-10 px-4 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder={composeChannel === 'sms' ? 'Phone: +1 555 000 0000' : 'Email address'}
                value={composeTo}
                onChange={e => setComposeTo(e.target.value)}
              />
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Templates:</p>
                <div className="flex gap-1.5 flex-wrap">
                  {QUICK_TEMPLATES.map(tpl => (
                    <button key={tpl.label} onClick={() => applyTemplate(tpl)} className="text-xs px-2.5 py-1 bg-muted/60 hover:bg-primary/10 hover:text-primary rounded-full transition-colors">
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                className="w-full h-28 px-4 py-3 text-sm bg-muted/50 border border-border rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Type your message..."
                value={composeContent}
                onChange={e => setComposeContent(e.target.value)}
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{composeContent.length} chars</p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowCompose(false)}>Cancel</Button>
                  <Button onClick={handleComposeSend} disabled={composeSending || !composeTo.trim() || !composeContent.trim()} className="gap-2">
                    {composeSending ? <Loader2 className="h-4 w-4 animate-spin" /> : composeSent ? <CheckCircle2 className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                    {composeSent ? 'Sent!' : `Send ${composeChannel.toUpperCase()}`}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Mock fallback ─────────────────────────────────────────────────────────────
const MOCK_THREADS: Thread[] = [
  {
    client_id: 'c1', client_name: 'Sarah M.', client_phone: '+15551234567',
    last_message: 'CONFIRM — thanks! See you tomorrow.', last_time: new Date(Date.now() - 1800000).toISOString(),
    unread: true, channel: 'sms',
    messages: [
      { id: 'm1', client_id: 'c1', client_name: 'Sarah M.', channel: 'sms', direction: 'outbound', message_type: 'confirmation', content: 'Hi Sarah! Reminder about your Botox appointment tomorrow at 2pm. Reply CONFIRM to confirm.', sent_at: new Date(Date.now() - 7200000).toISOString(), status: 'delivered' },
      { id: 'm2', client_id: 'c1', client_name: 'Sarah M.', channel: 'sms', direction: 'inbound', message_type: 'nurture', content: 'CONFIRM — thanks! See you tomorrow.', sent_at: new Date(Date.now() - 1800000).toISOString(), status: 'replied', sentiment: 'positive' },
    ],
  },
  {
    client_id: 'c2', client_name: 'Marcus W.', client_phone: '+15553210987',
    last_message: 'Following up after your treatment — how are you feeling?', last_time: new Date(Date.now() - 3600000).toISOString(),
    unread: false, channel: 'sms',
    messages: [
      { id: 'm3', client_id: 'c2', client_name: 'Marcus W.', channel: 'sms', direction: 'outbound', message_type: 'followup', content: 'Hi Marcus! Following up after your treatment — how are you feeling?', sent_at: new Date(Date.now() - 3600000).toISOString(), status: 'sent' },
    ],
  },
  {
    client_id: 'c3', client_name: 'Lisa K.', client_phone: 'lisa@email.com',
    last_message: 'Your service report and invoice are attached — $420.', last_time: new Date(Date.now() - 86400000).toISOString(),
    unread: false, channel: 'email',
    messages: [
      { id: 'm4', client_id: 'c3', client_name: 'Lisa K.', channel: 'email', direction: 'outbound', message_type: 'followup', content: 'Hi Lisa! Your service report and invoice are attached — $420. Thank you for choosing us!', sent_at: new Date(Date.now() - 86400000).toISOString(), status: 'delivered' },
    ],
  },
];
