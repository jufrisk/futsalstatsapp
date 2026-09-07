import { Navigate, Route, Routes } from "react-router-dom";
import { ToastProvider } from "./toast";
import { AdminAuthProvider } from "./adminAuth";
import { useBootstrap } from "./hooks";
import { AppLayout } from "./AppLayout";
import { Spinner } from "@/components/ui";
import { MatchesPage } from "@/features/matches/MatchesPage";
import { MatchRouter } from "@/features/matches/MatchRouter";
import { MatchPrepPage } from "@/features/matches/MatchPrepPage";
import { LiveMatchPage } from "@/features/liveMatch/LiveMatchPage";
import { MatchViewPage } from "@/features/matchReview/MatchViewPage";
import { PlayersPage } from "@/features/players/PlayersPage";
import { PlayerSeasonPage } from "@/features/players/PlayerSeasonPage";
import { SeasonPage } from "@/features/season/SeasonPage";
import { SettingsPage } from "@/features/settings/SettingsPage";

export default function App() {
  const ready = useBootstrap();

  return (
    <ToastProvider>
      <AdminAuthProvider>
      {!ready ? (
        <Spinner label="Alustetaan sovellusta…" />
      ) : (
        <Routes>
          {/* Live match runs full-screen without the app chrome. */}
          <Route path="/matches/:matchId/live" element={<LiveMatchPage />} />

          <Route element={<AppLayout />}>
            <Route path="/" element={<MatchesPage />} />
            <Route path="/matches/:matchId" element={<MatchRouter />} />
            <Route path="/matches/:matchId/prepare" element={<MatchPrepPage />} />
            <Route path="/matches/:matchId/stats" element={<MatchViewPage />} />
            <Route path="/players" element={<PlayersPage />} />
            <Route path="/players/:playerId" element={<PlayerSeasonPage />} />
            <Route path="/season" element={<SeasonPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      )}
      </AdminAuthProvider>
    </ToastProvider>
  );
}
