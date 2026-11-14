CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications USING btree (user_id, created_date DESC);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON public.notifications USING btree (user_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS wallet_tx_user_created_idx ON public.wallet_transactions USING btree (user_id, created_date DESC);
CREATE INDEX IF NOT EXISTS wallet_tx_auction_idx ON public.wallet_transactions USING btree (auction_id) WHERE auction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS auctions_status_end_idx ON public.auctions USING btree (status, end_time);