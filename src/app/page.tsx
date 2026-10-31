
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/library/supabase/client";

type Gender = "boys" | "girls";
type Tab = "overview" | "players" | "teams";

type Player = {
  id: string;
  name: string;
  branch: string;
  year: string;
  category: string;
  basePrice: number;
  status: "available" | "live" | "sold" | "unsold";
  soldPrice?: number;
  soldTo?: string;
};

type Team = {
  id: string;
  name: string;
  captain: string;
  remaining: number;
  players: number;
};

type AuctionData = {
  id: string;
  name: string;
  gender: Gender;
  starting_budget: number;
  minimum_bid: number;
  status: string;
};

export default function Home() {
  const supabase = useMemo(() => createClient(), []);

  const [gender, setGender] = useState<Gender>("boys");
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [auction, setAuction] = useState<AuctionData | null>(null);

  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  const [selectedTeam, setSelectedTeam] = useState("");
  const [isAdminPreview, setIsAdminPreview] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function loadAuctionData() {
      setLoading(true);
      setDbError("");

      const { data: auctionData, error: auctionError } = await supabase
        .from("auctions")
        .select("*")
        .eq("gender", gender)
        .single();

      if (cancelled) return;

      if (auctionError || !auctionData) {
        setAuction(null);
        setTeams([]);
        setPlayers([]);
        setDbError(auctionError?.message || "Auction not found.");
        setLoading(false);
        return;
      }

      const [
        { data: teamRows, error: teamError },
        { data: playerRows, error: playerError },
        { data: purchaseRows, error: purchaseError },
      ] = await Promise.all([
        supabase
          .from("teams")
          .select("*")
          .eq("auction_id", auctionData.id)
          .order("created_at", { ascending: true }),

        supabase
          .from("players")
          .select("*")
          .eq("auction_id", auctionData.id)
          .order("created_at", { ascending: true }),

        supabase
          .from("purchases")
          .select("*")
          .eq("auction_id", auctionData.id),
      ]);

      if (cancelled) return;

      if (teamError || playerError || purchaseError) {
        setDbError(
          teamError?.message ||
          playerError?.message ||
          purchaseError?.message ||
          "Unable to load auction data."
        );
        setLoading(false);
        return;
      }

      const teamRowsSafe = teamRows || [];
      const playerRowsSafe = playerRows || [];
      const purchaseRowsSafe = purchaseRows || [];

      const mappedTeams: Team[] = teamRowsSafe.map((team) => ({
        id: team.id,
        name: team.team_name,
        captain: team.captain_name,
        remaining: team.remaining_points,
        players:
          1 +
          purchaseRowsSafe.filter(
            (purchase) => purchase.team_id === team.id
          ).length,
      }));

      const mappedPlayers: Player[] = playerRowsSafe.map((player) => {
        const purchase = purchaseRowsSafe.find(
          (item) => item.player_id === player.id
        );

        const buyer = mappedTeams.find(
          (team) => team.id === purchase?.team_id
        );

        return {
          id: player.id,
          name: player.name,
          branch: player.branch,
          year: player.academic_year || "Not specified",
          category: "Registered Player",
          basePrice: auctionData.minimum_bid,
          status:
            player.status === "current"
              ? "live"
              : player.status === "sold"
                ? "sold"
                : player.status === "unsold"
                  ? "unsold"
                  : "available",
          soldPrice: purchase?.final_price,
          soldTo: buyer?.name,
        };
      });

      setAuction(auctionData as AuctionData);
      setTeams(mappedTeams);
      setPlayers(mappedPlayers);

      setSelectedTeam((previous) =>
        mappedTeams.some((team) => team.id === previous)
          ? previous
          : mappedTeams[0]?.id || ""
      );

      setLastUpdated(new Date().toLocaleTimeString());
      setLoading(false);

      // Listen for changes in this auction only.
      channel = supabase
        .channel(`auction-${auctionData.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "players",
            filter: `auction_id=eq.${auctionData.id}`,
          },
          () => loadAuctionData()
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "teams",
            filter: `auction_id=eq.${auctionData.id}`,
          },
          () => loadAuctionData()
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "purchases",
            filter: `auction_id=eq.${auctionData.id}`,
          },
          () => loadAuctionData()
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "auctions",
            filter: `id=eq.${auctionData.id}`,
          },
          () => loadAuctionData()
        )
        .subscribe();
    }

    loadAuctionData();

    return () => {
      cancelled = true;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [gender, supabase]);

  const livePlayer = players.find((player) => player.status === "live");
  const availablePlayers = players.filter(
    (player) => player.status === "available"
  );
  const soldPlayers = players.filter(
    (player) => player.status === "sold"
  );
  const unsoldPlayers = players.filter(
    (player) => player.status === "unsold"
  );

  const selectedTeamData = teams.find(
    (team) => team.id === selectedTeam
  );

  const auctionIsLive = auction?.status === "live";

  return (
    <main className="min-h-screen bg-[#050914] text-[#eaf4ff]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-48 left-1/2 h-[480px] w-[700px] -translate-x-1/2 rounded-full bg-blue-600/10 blur-[130px]" />
        <div className="absolute right-0 top-[40%] h-72 w-72 rounded-full bg-cyan-500/5 blur-[110px]" />
      </div>

      <div className="relative mx-auto max-w-[1500px] px-4 py-5 sm:px-7 lg:px-10">

        {/* HEADER */}
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-xl font-black text-cyan-300 shadow-[0_0_25px_rgba(0,170,255,0.12)]">
              A
            </div>

            <div>
              <h1 className="text-xl font-black tracking-wide sm:text-2xl">
                AISA <span className="text-cyan-400">AUCTION</span>
              </h1>
              <p className="text-xs tracking-[0.22em] text-slate-500">
                ARTIFICIAL INTELLIGENCE STUDENT ASSOCIATION
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
              <span
                className={`h-2 w-2 rounded-full ${
                  auctionIsLive ? "animate-pulse bg-green-400" : "bg-slate-500"
                }`}
              />
              {loading
                ? "LOADING"
                : auctionIsLive
                  ? "AUCTION LIVE"
                  : `AUCTION ${auction?.status?.toUpperCase() || "NOT FOUND"}`}
            </div>

            <button
              onClick={() => setIsAdminPreview(!isAdminPreview)}
              className="rounded-lg border border-cyan-400/20 bg-cyan-400/5 px-3 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-400/10"
            >
              Preview: {isAdminPreview ? "Admin" : "Captain"} view
            </button>
          </div>
        </header>

        {/* TITLE AND CATEGORY */}
        <section className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-xs font-bold tracking-[0.3em] text-cyan-400">
              THE BIGGEST GAME STARTS HERE
            </p>
            <h2 className="text-4xl font-black tracking-tight sm:text-5xl">
              PLAYER <span className="neon-text">AUCTION.</span>
            </h2>
            <p className="mt-3 max-w-xl text-sm text-slate-400">
              Build your squad. Make your strategy. Own the court.
            </p>
          </div>

          <div className="flex w-full max-w-sm rounded-xl border border-white/10 bg-[#0b1424] p-1.5">
            {(["boys", "girls"] as Gender[]).map((item) => (
              <button
                key={item}
                onClick={() => {
                  setGender(item);
                  setActiveTab("overview");
                }}
                className={`flex-1 rounded-lg px-5 py-3 text-sm font-bold capitalize transition ${
                  gender === item
                    ? "bg-gradient-to-r from-blue-600 to-cyan-400 text-[#03101d] shadow-lg shadow-cyan-500/10"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {item} Auction
              </button>
            ))}
          </div>
        </section>

        {/* DATABASE ERROR */}
        {dbError && (
          <div className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-300">
            <strong>Supabase error:</strong> {dbError}
          </div>
        )}

        {/* LOADING */}
        {loading && (
          <div className="mb-5 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4 text-sm text-cyan-300">
            Loading {gender} auction data from Supabase...
          </div>
        )}

        {/* STATS */}
        <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "TOTAL TEAMS", value: teams.length, icon: "◈" },
            { label: "TOTAL PLAYERS", value: players.length, icon: "♙" },
            { label: "PLAYERS SOLD", value: soldPlayers.length, icon: "✓" },
            { label: "PLAYERS AVAILABLE", value: availablePlayers.length, icon: "⌁" },
          ].map((stat) => (
            <div key={stat.label} className="glass-panel rounded-2xl p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-[0.2em] text-slate-500">
                  {stat.label}
                </span>
                <span className="text-lg text-cyan-400">{stat.icon}</span>
              </div>
              <p className="text-3xl font-black tracking-tight">
                {loading ? "—" : stat.value}
              </p>
            </div>
          ))}
        </section>

        {/* NAVIGATION */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-white/10">
          <div className="flex gap-6">
            {(["overview", "players", "teams"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`border-b-2 px-1 pb-3 text-sm font-semibold capitalize transition ${
                  activeTab === tab
                    ? "border-cyan-400 text-cyan-300"
                    : "border-transparent text-slate-500 hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <span className="mb-3 rounded-md border border-cyan-400/20 bg-cyan-400/5 px-3 py-1 text-[10px] font-bold tracking-wider text-cyan-300">
            {gender.toUpperCase()} DIVISION
          </span>
        </div>

        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <div className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">

            {/* LIVE AUCTION */}
            <section className="glass-panel overflow-hidden rounded-2xl">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
                <div>
                  <p className="text-xs font-bold tracking-[0.2em] text-slate-500">
                    LIVE AUCTION ROOM
                  </p>
                  <h3 className="mt-1 text-lg font-bold">Current Player</h3>
                </div>

                <span className="flex items-center gap-2 rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1.5 text-[10px] font-bold tracking-wider text-red-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
                  {livePlayer ? "ON THE BLOCK" : "WAITING"}
                </span>
              </div>

              {livePlayer ? (
                <div className="p-5 sm:p-7">
                  <div className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-center">
                    <div className="flex h-36 w-full items-center justify-center rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-blue-500/15 via-[#0b1424] to-cyan-400/10 sm:h-44 sm:w-44">
                      <span className="text-6xl font-black text-cyan-300/80">
                        {livePlayer.name.charAt(0)}
                      </span>
                    </div>

                    <div className="flex-1">
                      <p className="mb-2 text-xs font-bold tracking-[0.2em] text-cyan-400">
                        PLAYER UP FOR BIDDING
                      </p>
                      <h3 className="text-3xl font-black sm:text-4xl">
                        {livePlayer.name}
                      </h3>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {[livePlayer.branch, livePlayer.year, livePlayer.category].map((tag) => (
                          <span
                            key={tag}
                            className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mb-6 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                      <p className="text-[10px] font-bold tracking-widest text-slate-500">
                        BASE PRICE
                      </p>
                      <p className="mt-2 text-2xl font-black">
                        {livePlayer.basePrice}{" "}
                        <span className="text-xs text-slate-500">PTS</span>
                      </p>
                    </div>

                    <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] p-4">
                      <p className="text-[10px] font-bold tracking-widest text-cyan-400">
                        CURRENT PLAYER STATUS
                      </p>
                      <p className="mt-2 text-xl font-black text-cyan-300">
                        LIVE
                      </p>
                    </div>
                  </div>

                  <div className="mb-5">
                    <label className="mb-2 block text-xs font-semibold text-slate-400">
                      SELECT YOUR TEAM
                    </label>

                    <select
                      value={selectedTeam}
                      onChange={(e) => setSelectedTeam(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#101e32] px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
                    >
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name} — {team.remaining} points remaining
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4 text-center">
                    <p className="text-sm font-semibold text-cyan-300">
                      {isAdminPreview
                        ? "Admin dashboard — bidding controls will be enabled after secure setup."
                        : "Captain dashboard — bidding will be enabled after captain authentication."}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {selectedTeamData
                        ? `${selectedTeamData.name}: ${selectedTeamData.remaining} points remaining`
                        : "No team selected"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-80 flex-col items-center justify-center p-8 text-center">
                  <div className="mb-4 text-5xl text-cyan-400/40">◈</div>
                  <h3 className="text-xl font-bold">
                    No player on the auction block
                  </h3>
                  <p className="mt-2 max-w-sm text-sm text-slate-500">
                    {players.length === 0
                      ? "No players have been registered in this auction yet."
                      : "The next player will appear here when the administrator puts them up for auction."}
                  </p>
                </div>
              )}

              <div className="border-t border-white/10 bg-black/10 p-4 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-300">
                      AUCTION STATUS
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Status is controlled by the auction database.
                    </p>
                  </div>
                  <span
                    className={`rounded-lg px-4 py-2.5 text-xs font-bold ${
                      auctionIsLive
                        ? "border border-green-400/30 bg-green-400/10 text-green-300"
                        : "border border-white/10 bg-white/5 text-slate-400"
                    }`}
                  >
                    {auction?.status?.toUpperCase() || "NOT AVAILABLE"}
                  </span>
                </div>
              </div>
            </section>

            {/* SIDEBAR */}
            <div className="space-y-6">
              <section className="glass-panel rounded-2xl p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-bold">Teams Overview</h3>
                  <button
                    onClick={() => setActiveTab("teams")}
                    className="text-xs font-semibold text-cyan-400 hover:text-cyan-300"
                  >
                    View all →
                  </button>
                </div>

                {teams.length === 0 ? (
                  <p className="py-5 text-center text-sm text-slate-500">
                    No teams registered yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {teams.map((team) => (
                      <div
                        key={team.id}
                        className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold">{team.name}</p>
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              {team.captain}
                            </p>
                          </div>
                          <span className="text-sm font-bold text-cyan-300">
                            {team.remaining} pts
                          </span>
                        </div>

                        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400"
                            style={{
                              width: `${
                                auction?.starting_budget
                                  ? Math.min(
                                      100,
                                      (team.remaining / auction.starting_budget) * 100
                                    )
                                  : 0
                              }%`,
                            }}
                          />
                        </div>

                        <p className="mt-2 text-[10px] text-slate-500">
                          {team.players} player(s) including captain
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="glass-panel rounded-2xl p-5">
                <h3 className="mb-4 font-bold">Auction Summary</h3>
                <div className="space-y-4">
                  {[
                    ["Sold", soldPlayers.length, "text-green-400"],
                    ["Unsold", unsoldPlayers.length, "text-red-400"],
                    ["Available", availablePlayers.length, "text-cyan-400"],
                  ].map(([label, value, color]) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">{label}</span>
                      <span className={`text-lg font-black ${color}`}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* PLAYERS */}
        {activeTab === "players" && (
          <section className="glass-panel rounded-2xl p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold">Player Pool</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Players registered for this auction
                </p>
              </div>
              <span className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400">
                {players.length} players
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] tracking-widest text-slate-500">
                    <th className="px-3 py-3">PLAYER</th>
                    <th className="px-3 py-3">BRANCH / YEAR</th>
                    <th className="px-3 py-3">CATEGORY</th>
                    <th className="px-3 py-3">BASE PRICE</th>
                    <th className="px-3 py-3">STATUS</th>
                    <th className="px-3 py-3">SOLD DETAILS</th>
                  </tr>
                </thead>

                <tbody>
                  {players.map((player) => (
                    <tr
                      key={player.id}
                      className="border-b border-white/[0.06] last:border-0"
                    >
                      <td className="px-3 py-4 font-semibold">
                        {player.name}
                      </td>
                      <td className="px-3 py-4 text-xs text-slate-400">
                        {player.branch} · {player.year}
                      </td>
                      <td className="px-3 py-4 text-xs text-slate-400">
                        {player.category}
                      </td>
                      <td className="px-3 py-4 font-semibold">
                        {player.basePrice} pts
                      </td>
                      <td className="px-3 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                            player.status === "sold"
                              ? "bg-green-400/10 text-green-300"
                              : player.status === "live"
                                ? "bg-cyan-400/10 text-cyan-300"
                                : player.status === "unsold"
                                  ? "bg-red-400/10 text-red-300"
                                  : "bg-white/10 text-slate-400"
                          }`}
                        >
                          {player.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-xs text-slate-400">
                        {player.status === "sold"
                          ? `${player.soldTo || "Team"} · ${player.soldPrice ?? "—"} pts`
                          : "—"}
                      </td>
                    </tr>
                  ))}

                  {players.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-12 text-center text-sm text-slate-500"
                      >
                        No players found for this auction.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* TEAMS */}
        {activeTab === "teams" && (
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {teams.map((team) => (
              <div key={team.id} className="glass-panel rounded-2xl p-5">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400/10 text-xl text-cyan-300">
                  ◈
                </div>

                <h3 className="text-lg font-black">{team.name}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Captain: {team.captain}
                </p>

                <div className="my-5 border-t border-white/10" />

                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Remaining purse</span>
                  <strong className="text-cyan-300">
                    {team.remaining} pts
                  </strong>
                </div>

                <div className="mt-3 flex justify-between text-sm">
                  <span className="text-slate-500">Players in squad</span>
                  <strong>{team.players}</strong>
                </div>

                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400"
                    style={{
                      width: `${
                        auction?.starting_budget
                          ? Math.min(
                              100,
                              (team.remaining / auction.starting_budget) * 100
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            ))}

            {teams.length === 0 && (
              <div className="glass-panel col-span-full rounded-2xl p-12 text-center text-sm text-slate-500">
                No teams registered for this auction yet.
              </div>
            )}
          </section>
        )}

        {/* FOOTER */}
        <footer className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/10 py-6 text-center sm:flex-row sm:text-left">
          <p className="text-xs text-slate-600">
            © 2026 AISA · Artificial Intelligence Student Association
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-slate-600">
                Updated: {lastUpdated}
              </span>
            )}
            <button
              onClick={() => window.location.reload()}
              className="text-xs text-slate-500 transition hover:text-cyan-300"
            >
              Refresh data ↻
            </button>
            <span className="text-xs text-slate-700">|</span>
            <span className="text-xs text-slate-600">
              Powered by AISA Tech Team
            </span>
          </div>
        </footer>
      </div>
    </main>
  );
}
