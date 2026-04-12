import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MessageSquare, Calendar, Send, Loader2, Bot, User, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { LegalConference } from "@shared/schema";

const spring = { type: "spring" as const, damping: 32, stiffness: 260 };

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  id: string;
}

// ─── Legal Conference Tab ─────────────────────────────────────────────────────

function EventCard({ event }: { event: LegalConference }) {
  const daysLeft = Math.ceil(
    (new Date(event.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  return (
    <div className="p-3 rounded-xl border border-border/60 bg-card hover:border-primary/30 transition-colors relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
      </div>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
          {event.ticker}
        </span>
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-muted-foreground font-medium">{event.date}</span>
          {daysLeft >= 0 && daysLeft <= 14 && (
            <span className="text-[9px] text-primary/70">
              {daysLeft === 0 ? "今日" : `${daysLeft} 天後`}
            </span>
          )}
        </div>
      </div>
      <p className="text-xs font-semibold mb-1 leading-snug">{event.stockName}</p>
      <p className="text-[11px] text-muted-foreground leading-relaxed">{event.description}</p>
      {event.location && (
        <p className="text-[10px] text-muted-foreground/60 mt-1">📍 {event.location}</p>
      )}
    </div>
  );
}

function EventsTab({ events }: { events: LegalConference[] }) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
        <Calendar className="w-8 h-8 mb-2 opacity-30" />
        <p className="text-sm">近期暫無法說會</p>
      </div>
    );
  }
  return (
    <div className="space-y-3 p-4 overflow-y-auto flex-1">
      <p className="text-[10px] text-muted-foreground px-0.5">共 {events.length} 場近期活動</p>
      {events.map((event, i) => (
        <EventCard key={i} event={event} />
      ))}
    </div>
  );
}

// ─── AI Chat Tab ─────────────────────────────────────────────────────────────

const SUGGESTED_QUESTIONS = [
  "台積電近期法人買賣情況如何？",
  "聯發科最新一季 EPS 是多少？",
  "2330 近 30 日股價走勢分析",
  "幫我分析鴻海的月營收趨勢",
];

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring}
      className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}
    >
      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isUser ? "bg-primary/15" : "bg-primary/10"}`}>
        {isUser
          ? <User className="w-3.5 h-3.5 text-primary" />
          : <Bot className="w-3.5 h-3.5 text-primary" />
        }
      </div>
      <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
        isUser
          ? "bg-primary text-primary-foreground rounded-tr-sm"
          : "bg-muted/60 border border-border/50 rounded-tl-sm"
      }`}>
        {/* Render line breaks */}
        {msg.content.split("\n").map((line, i, arr) => (
          <span key={i}>
            {line}
            {i < arr.length - 1 && <br />}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

function ChatTab() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "你好！我是台股情報站的 AI 分析師，可以幫你查詢個股股價、法人買賣超、月營收、財務報表等資料。請問有什麼我可以協助的？",
      id: "init",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = { role: "user", content: trimmed, id: Date.now().toString() };
    const history = messages
      .filter(m => m.id !== "init")
      .map(m => ({ role: m.role, content: m.content }));

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, history }),
      });
      const data = await res.json();
      const reply = res.ok ? (data.reply ?? "（無回應）") : (data.message ?? "發生錯誤，請稍後再試");

      setMessages(prev => [...prev, {
        role: "assistant",
        content: reply,
        id: `ai-${Date.now()}`,
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "連線失敗，請稍後再試。",
        id: `err-${Date.now()}`,
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}

        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2.5">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Bot className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="bg-muted/60 border border-border/50 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
              <div className="flex gap-1 items-center h-4">
                {[0, 0.15, 0.3].map(delay => (
                  <motion.div
                    key={delay}
                    className="w-1.5 h-1.5 rounded-full bg-primary/50"
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Suggested questions (only when no user messages yet) */}
        {messages.length === 1 && !isLoading && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-2">
            <p className="text-[10px] text-muted-foreground pl-8">試試看：</p>
            {SUGGESTED_QUESTIONS.map((q, i) => (
              <button
                key={i}
                onClick={() => sendMessage(q)}
                className="ml-8 block text-left text-xs px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/10 hover:bg-primary/10 hover:border-primary/20 transition-colors text-primary/80"
              >
                {q}
              </button>
            ))}
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border/50">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="詢問股票分析... (Enter 送出)"
            rows={1}
            disabled={isLoading}
            className="flex-1 resize-none rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all disabled:opacity-50 max-h-28 overflow-y-auto leading-relaxed"
            style={{ minHeight: "38px" }}
          />
          <Button
            size="icon"
            className="h-9 w-9 rounded-xl shrink-0"
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
          >
            {isLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />
            }
          </Button>
        </div>
        <p className="text-[9px] text-muted-foreground/50 mt-1.5 px-1">
          資料來源：FinMind + Yahoo Finance。僅供參考，不構成投資建議。
        </p>
      </div>
    </div>
  );
}

// ─── Side Drawer ─────────────────────────────────────────────────────────────

interface SideDrawerProps {
  events: LegalConference[];
}

export function SideDrawer({ events }: SideDrawerProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"chat" | "events">("chat");

  return (
    <>
      {/* Floating toggle button */}
      <motion.button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-shadow"
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        data-testid="button-open-drawer"
      >
        <Sparkles className="w-4 h-4" />
        <span className="text-sm font-semibold">AI 問答</span>
        {events.length > 0 && (
          <span className="ml-0.5 text-[10px] font-bold bg-primary-foreground/20 rounded-full px-1.5 py-0.5">
            {events.length}
          </span>
        )}
      </motion.button>

      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            className="fixed right-0 top-0 h-full w-full sm:w-[400px] z-50 bg-background border-l border-border/60 shadow-2xl flex flex-col"
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-0.5">
                <button
                  onClick={() => setTab("chat")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    tab === "chat" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  AI 問答
                </button>
                <button
                  onClick={() => setTab("events")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    tab === "events" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  法說行事曆
                  {events.length > 0 && (
                    <span className="bg-primary/15 text-primary rounded-full px-1.5 text-[9px] font-bold">
                      {events.length}
                    </span>
                  )}
                </button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full h-8 w-8"
                onClick={() => setOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-hidden">
              <AnimatePresence mode="wait">
                {tab === "chat" ? (
                  <motion.div
                    key="chat"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.15 }}
                    className="h-full"
                  >
                    <ChatTab />
                  </motion.div>
                ) : (
                  <motion.div
                    key="events"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                    className="h-full overflow-y-auto"
                  >
                    <EventsTab events={events} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
