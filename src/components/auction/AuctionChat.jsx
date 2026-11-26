import React, { memo, useEffect, useRef, useState } from "react";
import { useAuctionChat, CHAT_MAX_LENGTH } from "@/lib/queries/auctions";
import { Lock, Send } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * One bubble. Memoised so typing in the box doesn't re-render the whole list.
 * Colours come from admin > Design (.theme-chat-mine / -other in styles.css).
 * The tail corner uses logical radius classes, so it flips in RTL.
 */
const ChatMessage = memo(function ChatMessage({ message, mine }) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 ${
          mine ? "theme-chat-mine rounded-ee-md" : "theme-chat-other rounded-es-md"
        }`}
      >
        {!mine && <p className="text-[10px] font-bold opacity-75 mb-0.5">{message.author_name}</p>}
        <p className="text-sm break-words whitespace-pre-wrap">{message.body}</p>
      </div>
    </div>
  );
});

/**
 * Auction room chat. `closed` (ended / archived / voided auction) turns it
 * read-only: the history stays visible, the input is replaced by a notice,
 * and no realtime channel is opened. The database refuses new messages on a
 * closed auction as well.
 */
export default function AuctionChat({ auctionId, user, closed = false }) {
  const { t } = useI18n();
  const { messages, send: sendMessage, isPending } = useAuctionChat(auctionId, { closed });
  const [text, setText] = useState("");
  const sending = sendMessage.isPending;
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const body = text.trim();
  const canSend = !closed && !!user && !!body && !sending;

  const send = async () => {
    if (!canSend) return;
    // Clear straight away; put the text back if the send fails.
    setText("");
    try {
      await sendMessage.mutateAsync({
        user_id: user.id,
        author_name: user.full_name || user.email || "—",
        body: body.slice(0, CHAT_MAX_LENGTH),
      });
    } catch {
      setText(body);
    }
  };

  // A closed room with no history has nothing to show.
  if (closed && !isPending && messages.length === 0) return null;

  return (
    <div className="native-panel rounded-xl overflow-hidden flex flex-col">
      <div className="p-5 border-b border-border"><h2 className="font-display text-lg font-bold text-foreground">{t.auction.chat}</h2></div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto max-h-72 p-3 space-y-2">
        {messages.length === 0 ? (
          <div className="p-5 text-center text-sm text-muted-foreground">{t.auction.chatPlaceholder}</div>
        ) : messages.map((m) => <ChatMessage key={m.id} message={m} mine={m.user_id === user?.id} />)}
      </div>
      {closed ? (
        <div className="p-3 border-t border-border flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Lock className="w-4 h-4" /> {t.auction.chatClosed}
        </div>
      ) : (
        <div className="p-3 border-t border-border flex gap-2">
          <Input
            value={text}
            maxLength={CHAT_MAX_LENGTH}
            onChange={(e) => setText(e.target.value)}
            // Skip Enter while an IME is composing (Arabic / CJK keyboards).
            onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && send()}
            placeholder={t.auction.chatPlaceholder}
            className="bg-card border-border text-foreground"
          />
          <Button onClick={send} disabled={!canSend} aria-label={t.auction.chatSend} className="px-4"><Send className="w-4 h-4" /></Button>
        </div>
      )}
    </div>
  );
}
