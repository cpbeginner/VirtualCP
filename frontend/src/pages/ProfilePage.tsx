import { useQuery } from "@tanstack/react-query";
import { apiAchievements, apiLeaderboard, apiProfile } from "../api/profile";
import { Alert } from "../components/ui/Alert";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { Table } from "../components/ui/Table";
import { timeAgoFromUnixSeconds } from "../utils/time";

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

export function ProfilePage() {
  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: apiProfile, retry: false });
  const achievementsQuery = useQuery({
    queryKey: ["achievements"],
    queryFn: apiAchievements,
    retry: false,
  });
  const leaderboardQuery = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => await apiLeaderboard(20),
    retry: false,
  });

  if (profileQuery.isLoading) return <div className="p-6 text-sm text-gray-600">Loading...</div>;
  if (profileQuery.isError || !profileQuery.data) {
    return <div className="p-6 text-sm text-gray-700">Failed to load profile</div>;
  }

  const profile = profileQuery.data;
  const xp = profile.stats.xp ?? 0;
  const levelInfo = profile.level;
  const level = levelInfo.level;
  const progress = clamp01((xp - levelInfo.levelStartXp) / (levelInfo.nextLevelXp - levelInfo.levelStartXp));

  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  const unlocked = profile.stats.achievements ?? {};

  return (
    <div className="space-y-6 page-enter">
      <div className="rounded-3xl border border-[var(--stroke)] bg-[var(--card)]/85 p-6 shadow-[0_20px_50px_var(--shadow)] backdrop-blur">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[var(--muted)]">
            VirtualCP
          </div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ink)] font-display">
            Profile
          </div>
          <div className="mt-2 text-sm text-[var(--muted)]">Stats, achievements, and leaderboard</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card title="Level">
          <div className="flex items-center gap-6">
            <div className="relative h-28 w-28">
              <svg viewBox="0 0 120 120" className="h-full w-full">
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="none"
                  stroke="rgba(15,27,31,0.12)"
                  strokeWidth="10"
                />
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="none"
                  stroke="rgba(31,111,139,0.95)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${circumference} ${circumference}`}
                  strokeDashoffset={dashOffset}
                  transform="rotate(-90 60 60)"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-xs text-[var(--muted)]">Level</div>
                <div className="text-2xl font-semibold text-[var(--ink)]">{level}</div>
              </div>
            </div>
            <div className="space-y-1 text-sm text-[var(--muted)]">
              <div>
                <span className="font-semibold text-[var(--ink)]">{xp}</span> XP
              </div>
              <div>
                Next level at{" "}
                <span className="font-semibold text-[var(--ink)]">{levelInfo.nextLevelXp}</span> XP
              </div>
              <div>
                Total solved{" "}
                <span className="font-semibold text-[var(--ink)]">{profile.stats.totalSolved}</span>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Leaderboard">
          {leaderboardQuery.isError ? (
            <Alert variant="error" className="mb-4">
              Failed to load leaderboard
            </Alert>
          ) : null}
          <Table headers={["Rank", "User", "Level", "XP", "Solved"]} className="shadow-none">
            {(leaderboardQuery.data ?? []).map((e, idx) => (
              <tr key={e.userId} className="transition hover:bg-[rgba(31,111,139,0.06)]">
                <td className="px-3 py-3 font-medium text-[var(--ink)]">{idx + 1}</td>
                <td className="px-3 py-3 text-[var(--ink)]">{e.username}</td>
                <td className="px-3 py-3 text-[var(--muted)]">{e.level}</td>
                <td className="px-3 py-3 text-[var(--muted)]">{e.xp}</td>
                <td className="px-3 py-3 text-[var(--muted)]">{e.totalSolved}</td>
              </tr>
            ))}
            {(leaderboardQuery.data ?? []).length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-[var(--muted)]" colSpan={5}>
                  No users yet
                </td>
              </tr>
            ) : null}
          </Table>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card title="Achievements">
          {achievementsQuery.isError ? (
            <Alert variant="error" className="mb-4">
              Failed to load achievements
            </Alert>
          ) : null}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {(achievementsQuery.data ?? []).map((a) => {
              const isUnlocked = !!unlocked[a.id];
              return (
                <div
                  key={a.id}
                  className={[
                    "rounded-2xl border border-[var(--stroke)] p-4",
                    isUnlocked ? "bg-[rgba(44,157,107,0.10)]" : "bg-[rgba(255,255,255,0.65)]",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-[var(--ink)]">{a.title}</div>
                      <div className="mt-1 text-sm text-[var(--muted)]">{a.description}</div>
                    </div>
                    <Badge variant={isUnlocked ? "success" : "neutral"}>
                      {isUnlocked ? "UNLOCKED" : "LOCKED"}
                    </Badge>
                  </div>
                  <div className="mt-3 text-xs text-[var(--muted)]">
                    Rarity: <span className="font-semibold text-[var(--ink)]">{a.rarity}</span>
                    {isUnlocked && unlocked[a.id]?.unlockedAt ? (
                      <>
                        {" "}
                        · Unlocked {timeAgoFromUnixSeconds(unlocked[a.id].unlockedAt)}
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Recent activity">
          <div className="stagger space-y-3">
            {profile.recentActivity.map((a) => (
              <div
                key={a.id}
                className="rounded-2xl border border-[var(--stroke)] bg-[rgba(255,255,255,0.65)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-semibold text-[var(--ink)]">{a.message}</div>
                  <div className="text-xs text-[var(--muted)]">{timeAgoFromUnixSeconds(a.t)}</div>
                </div>
                <div className="mt-2 text-xs text-[var(--muted)]">
                  Kind: <span className="font-semibold text-[var(--ink)]">{a.kind}</span>
                </div>
              </div>
            ))}
            {profile.recentActivity.length === 0 ? (
              <div className="text-sm text-[var(--muted)]">No activity yet</div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}

