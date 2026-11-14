import React, { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AuctionChat({ auctionId, user }) {
  const { t } = useI18n();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  const load = () => {
    // Newest 50, then shown oldest-first so the latest messages are always present.
    base44.entities.AuctionMessage.filter({ auction_id: auctionId }, "-created_date", 50)
      .then((rows) => setMessages([...(rows || [])].reverse()))
      .catch(() => {});
  };

  useEffect(() => {
    load();
    const unsub = base44.entities.AuctionMessage.subscribe((ev) => {
      if (ev.type === "create" && ev.data?.auction_id === auctionId) load();
    });
    return unsub;
  }, [auctionId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    if (!text.trim() || !user) return;
    setSending(true);
    try {
      await base44.entities.AuctionMessage.create({
        user_id: user.id,
        author_name: user.full_name || user.email || "—",
        body: text.trim(),
        auction_id: auctionId,
      });
      setText("");
      load();
    } catch {
      /* ignore */
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="native-panel rounded-xl overflow-hidden flex flex-col">
      <div className="p-5 border-b border-border"><h2 className="font-display text-lg font-bold text-foreground">{t.auction.chat}</h2></div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto max-h-72 divide-y divide-border">
        {messages.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">{t.auction.chatPlaceholder}</div>
        ) : messages.map((m) => {
          const mine = m.user_id === user?.id;
          return (
            <div key={m.id} className={`p-3 flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${mine ? "bg-accent text-accent-foreground" : "bg-muted text-foreground"}`}>
                <p className="text-[10px] font-bold opacity-70 mb-0.5">{m.author_name}</p>
                <p className="text-sm break-words">{m.body}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="p-3 border-t border-border flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={t.auction.chatPlaceholder}
          className="bg-card border-border text-foreground"
        />
        <Button onClick={send} disabled={sending} className="px-4"><Send className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}