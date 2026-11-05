CREATE INDEX "player_careers_stat_games" ON "player_careers" USING btree ("sport","stat_games" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "player_careers_stat_goals" ON "player_careers" USING btree ("sport","stat_goals" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "player_careers_assists" ON "player_careers" USING btree ("sport","assists" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "player_careers_tackles" ON "player_careers" USING btree ("sport","tackles" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "player_careers_saves" ON "player_careers" USING btree ("sport","saves" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "players_stat_games" ON "players" USING btree ("sport","stat_games" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "players_stat_goals" ON "players" USING btree ("sport","stat_goals" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "players_assists" ON "players" USING btree ("sport","assists" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "players_tackles" ON "players" USING btree ("sport","tackles" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "players_saves" ON "players" USING btree ("sport","saves" DESC NULLS LAST);