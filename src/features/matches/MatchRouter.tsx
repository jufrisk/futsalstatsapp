import { Navigate, useParams } from "react-router-dom";
import { useMatch } from "@/app/hooks";
import { Spinner } from "@/components/ui";

/** Sends the user to the right screen for a match based on its status. */
export function MatchRouter() {
  const { matchId } = useParams();
  const match = useMatch(matchId);

  if (match === undefined) return <Spinner />;
  if (!match) return <Navigate to="/" replace />;

  switch (match.status) {
    case "LIVE":
      return <Navigate to={`/matches/${match.id}/live`} replace />;
    case "FINISHED":
      return <Navigate to={`/matches/${match.id}/stats`} replace />;
    default:
      return <Navigate to={`/matches/${match.id}/prepare`} replace />;
  }
}
