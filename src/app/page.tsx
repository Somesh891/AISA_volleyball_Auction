"use client";

import { useMemo, useState } from "react";

type Gender = "boys" | "girls";
type PlayerStatus = "available" | "live" | "sold" | "unsold";

type Player = {
  id: number;
  name: string;
  branch: string;
  year: string;
  category: string;
  basePrice: number;
  status: PlayerStatus;
  soldPrice?: number;
  soldTo?: string;
};

type Team = {
  id: number;
  name: string;
  captain: string;
  remaining: number;
  players: number;
};

const initialTeams: Record<Gender, Team[]> = {
  boys: [
    { id: 1, name: "Team Alpha", captain: "Captain 1", remaining: 200, players: 1 },
    { id: 2, name: "Team Nova", captain: "Captain 2", remaining: 200, players: 1 },
    { id: 3, name: "Team Titans", captain: "Captain 3", remaining: 200, players: 1 },
    { id: 4, name: "Team Phoenix", captain: "Captain 4", remaining: 200, players: 1 },
  ],
  girls: [
    { id: 1, name: "Team Alpha", captain: "Captain 1", remaining: 200, players: 1 },
    { id: 2, name: "Team Nova", captain: "Captain 2", remaining: 200, players: 1 },
    { id: 3, name: "Team Titans", captain: "Captain 3", remaining: 200, players: 1 },
    { id: 4, name: "Team Phoenix", captain: "Captain 4", remaining: 200, players: 1 },
  ],
};

const initialPlayers: Record<Gender, Player[]> = {
  boys: [
    { id: 1, name: "Player One", branch: "AI & DS", year: "Second Year", category: "All Rounder", basePrice: 5, status: "live" },
    { id: 2, name: "Player Two", branch: "AI & DS", year: "Third Year", category: "Attacker", basePrice: 5, status: "available" },
    { id: 3, name: "Player Three", branch: "AI & DS", year: "First Year", category: "Defender", basePrice: 5, status: "available" },
    { id: 4, name: "Player Four", branch: "AI & DS", year: "Second Year", category: "Setter", basePrice: 5, status: "available" },
  ],
  girls: [
    { id: 1, name: "Player One", branch: "AI & DS", year: "Second Year", category: "All Rounder", basePrice: 5, status: "live" },
    { id: 2, name: "Player Two", branch: "AI & DS", year: "Third Year", category: "Attacker", basePrice: 5, status: "available" },
    { id: 3, name: "Player Three", branch: "AI & DS", year: "First Year", category: "Defender", basePrice: 5, status: "available" },
    { id: 4, name: "Player Four", branch: "AI & DS", year: "Second Year", category: "Setter", basePrice: 5, status: "available" },
  ],
};

export default function Home() {
  const [gender, setGender] = useState<Gender>("boys");
  const [teams, setTeams] = useState(initialTeams);
  const [players, setPlayers] = useState(initialPlayers);
  const [selectedTeam, setSelectedTeam] = useState(1);
  const [bidAmount, setBidAmount] = useState(5);
  const [isAdmin, setIsAdmin] = useState(true);
  const [auctionLive, setAuctionLive] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "players" | "teams">("overview");
  const [notice, setNotice] = useState("");

  const currentTeams = teams[gender];
  const currentPlayers = players[gender];

  const livePlayer = currentPlayers.find((p) => p.status === "live");
  const availablePlayers = currentPlayers.filter((p) => p.status === "available");
  const soldPlayers = currentPlayers.filter((p) => p.status === "sold");
  const unsoldPlayers = currentPlayers.filter((p) => p.status === "unsold");

  const highestBid = useMemo(() => {
    return livePlayer ? Math.max(livePlayer.basePrice, bidAmount - 5) : 0;
  }, [livePlayer, bidAmount]);

  const selectedTeamData = currentTeams.find((team) => team.id === selectedTeam);

  function updatePlayers(nextPlayers: Player[]) {
    setPlayers((prev) => ({ ...prev, [gender]: nextPlayers }));
  }

  function updateTeams(nextTeams: Team[]) {
    setTeams((prev) => ({ ...prev, [gender]: nextTeams }));
  }

  function placeBid() {
    if (!livePlayer || !selectedTeamData) return;

    const nextBid = bidAmount;
    const minimumNextBid = livePlayer.basePrice + 5;

    if (nextBid < minimumNextBid) {
      setNotice(`The opening bid must be at least ${minimumNextBid} points.`);
      return;
    }

    if (nextBid > selectedTeamData.remaining) {
      setNotice("This team does not have enough points for that bid.");
      return;
    }

    setNotice(`${selectedTeamData.name} placed a bid of ${nextBid} points.`);
    setBidAmount(nextBid + 5);
  }

  function markPlayer(status: "sold" | "unsold") {
    if (!livePlayer || !isAdmin) return;

    if (status === "sold" && selectedTeamData) {
      const price = Math.max(livePlayer.basePrice, bidAmount - 5);

      if (price > selectedTeamData.remaining) {
        setNotice("The selected team does not have enough points.");
        return;
      }

      updateTeams(
        currentTeams.map((team) =>
          team.id === selectedTeam
            ? { ...team, remaining: team.remaining - price, players: team.players + 1 }
            : team
        )
      );

      updatePlayers(
        currentPlayers.map((player) =>
          player.id === livePlayer.id
            ? { ...player, status: "sold", soldPrice: price, soldTo: selectedTeamData.name }
            : player
        )
      );

      setNotice(`${livePlayer.name} sold to ${selectedTeamData.name} for ${price} points.`);
    } else {
      updatePlayers(
        currentPlayers.map((player) =>
          player.id === livePlayer.id ? { ...player, status: "unsold" } : player
        )
      );
      setNotice(`${livePlayer.name} marked as unsold.`);
    }

    setBidAmount(5);
  }

  function startNextPlayer(playerId: number) {
    if (!isAdmin) return;

    const selectedPlayer = currentPlayers.find((p) => p.id === playerId);
    if (!selectedPlayer) return;

    updatePlayers(
      currentPlayers.map((player) => {
        if (player.status === "live") return { ...player, status: "available" };
        if (player.id === playerId) return { ...player, status: "live" };
        return player;
      })
    );

    setBidAmount(selectedPlayer.basePrice);
    setNotice(`${selectedPlayer.name} is now up for auction.`);
  }

  function resetAuctionView() {
    setTeams(initialTeams);
    setPlayers(initialPlayers);
    setBidAmount(5);
    setSelectedTeam(1);
    setAuctionLive(false);
    setNotice("Preview data has been reset.");
  }

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
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-400 sm:flex">
              <span className={`h-2 w-2 rounded-full ${auctionLive ? "animate-pulse bg-green-400" : "bg-slate-500"}`} />
              {auctionLive ? "AUCTION LIVE" : "AUCTION NOT STARTED"}
            </div>

            <button
              onClick={() => setIsAdmin(!isAdmin)}
              className="rounded-lg border border-cyan-400/20 bg-cyan-400/5 px-3 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-400/10"
            >
              Preview: {isAdmin ? "Admin" : "Captain"} view
            </button>
          </div>
        </header>

        {/* TITLE + CATEGORY */}
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
                  setSelectedTeam(1);
                  setBidAmount(5);
                  setNotice("");
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

        {/* STATS */}
        <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "TOTAL TEAMS", value: currentTeams.length, icon: "◈" },
            { label: "TOTAL PLAYERS", value: currentPlayers.length, icon: "♙" },
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
              <p className="text-3xl font-black tracking-tight">{stat.value}</p>
            </div>
          ))}
        </section>

        {/* NAVIGATION */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-white/10">
          <div className="flex gap-6">
            {(["overview", "players", "teams"] as const).map((tab) => (
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

        {notice && (
          <div className="mb-5 flex items-center justify-between rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-3 text-sm text-cyan-200">
            <span>{notice}</span>
            <button onClick={() => setNotice("")} className="ml-3 text-cyan-400">✕</button>
          </div>
        )}

        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <div className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
            {/* LIVE AUCTION PANEL */}
            <section className="glass-panel overflow-hidden rounded-2xl">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
                <div>
                  <p className="text-xs font-bold tracking-[0.2em] text-slate-500">LIVE AUCTION ROOM</p>
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
                      <h3 className="text-3xl font-black sm:text-4xl">{livePlayer.name}</h3>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {[livePlayer.branch, livePlayer.year, livePlayer.category].map((tag) => (
                          <span key={tag} className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mb-6 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                      <p className="text-[10px] font-bold tracking-widest text-slate-500">BASE PRICE</p>
                      <p className="mt-2 text-2xl font-black">{livePlayer.basePrice} <span className="text-xs text-slate-500">PTS</span></p>
                    </div>
                    <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] p-4">
                      <p className="text-[10px] font-bold tracking-widest text-cyan-400">NEXT BID</p>
                      <p className="mt-2 text-2xl font-black text-cyan-300">{bidAmount} <span className="text-xs text-cyan-500">PTS</span></p>
                    </div>
                  </div>

                  <div className="mb-5">
                    <label className="mb-2 block text-xs font-semibold text-slate-400">SELECT YOUR TEAM</label>
                    <select
                      value={selectedTeam}
                      onChange={(e) => setSelectedTeam(Number(e.target.value))}
                      className="w-full rounded-xl border border-white/10 bg-[#101e32] px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
                    >
                      {currentTeams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name} — {team.remaining} points remaining
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    {!isAdmin && (
                      <button
                        onClick={placeBid}
                        disabled={!auctionLive}
                        className="neon-button flex-1 rounded-xl px-5 py-4 text-sm font-black tracking-wider disabled:opacity-40"
                      >
                        PLACE BID · {bidAmount} PTS
                      </button>
                    )}

                    {isAdmin && (
                      <>
                        <button
                          onClick={() => markPlayer("sold")}
                          className="flex-1 rounded-xl border border-green-400/30 bg-green-400/10 px-5 py-4 text-sm font-black tracking-wider text-green-300 transition hover:bg-green-400/20"
                        >
                          ✓ MARK SOLD
                        </button>
                        <button
                          onClick={() => markPlayer("unsold")}
                          className="flex-1 rounded-xl border border-red-400/30 bg-red-400/10 px-5 py-4 text-sm font-black tracking-wider text-red-300 transition hover:bg-red-400/20"
                        >
                          ✕ MARK UNSOLD
                        </button>
                      </>
                    )}
                  </div>

                  {isAdmin && (
                    <p className="mt-3 text-center text-[11px] text-slate-500">
                      Admin preview: only the administrator should finalize player status.
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex min-h-80 flex-col items-center justify-center p-8 text-center">
                  <div className="mb-4 text-5xl text-cyan-400/40">◈</div>
                  <h3 className="text-xl font-bold">No player on the auction block</h3>
                  <p className="mt-2 max-w-sm text-sm text-slate-500">
                    Select a player from the available list to start the next bidding round.
                  </p>
                </div>
              )}

              {isAdmin && (
                <div className="border-t border-white/10 bg-black/10 p-4 sm:px-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-slate-300">AUCTION CONTROL</p>
                      <p className="mt-1 text-[11px] text-slate-500">Manage the auction session</p>
                    </div>
                    <button
                      onClick={() => setAuctionLive(!auctionLive)}
                      className={`rounded-lg px-4 py-2.5 text-xs font-bold transition ${
                        auctionLive
                          ? "border border-red-400/30 bg-red-400/10 text-red-300"
                          : "neon-button"
                      }`}
                    >
                      {auctionLive ? "PAUSE AUCTION" : "START AUCTION"}
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* SIDEBAR */}
            <div className="space-y-6">
              <section className="glass-panel rounded-2xl p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-bold">Teams Overview</h3>
                  <button onClick={() => setActiveTab("teams")} className="text-xs font-semibold text-cyan-400 hover:text-cyan-300">
                    View all →
                  </button>
                </div>
                <div className="space-y-3">
                  {currentTeams.map((team) => (
                    <div key={team.id} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold">{team.name}</p>
                          <p className="mt-0.5 text-[11px] text-slate-500">{team.captain}</p>
                        </div>
                        <span className="text-sm font-bold text-cyan-300">{team.remaining} pts</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400"
                          style={{ width: `${(team.remaining / 200) * 100}%` }}
                        />
                      </div>
                      <p className="mt-2 text-[10px] text-slate-500">{team.players} player(s) including captain</p>
                    </div>
                  ))}
                </div>
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
                      <span className={`text-lg font-black ${color}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* PLAYERS TAB */}
        {activeTab === "players" && (
          <section className="glass-panel rounded-2xl p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold">Player Pool</h3>
                <p className="mt-1 text-xs text-slate-500">Players registered for this auction</p>
              </div>
              <span className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400">
                {currentPlayers.length} players
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
                    {isAdmin && <th className="px-3 py-3">ACTION</th>}
                  </tr>
                </thead>
                <tbody>
                  {currentPlayers.map((player) => (
                    <tr key={player.id} className="border-b border-white/[0.06] last:border-0">
                      <td className="px-3 py-4 font-semibold">{player.name}</td>
                      <td className="px-3 py-4 text-xs text-slate-400">{player.branch} · {player.year}</td>
                      <td className="px-3 py-4 text-xs text-slate-400">{player.category}</td>
                      <td className="px-3 py-4 font-semibold">{player.basePrice} pts</td>
                      <td className="px-3 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          player.status === "sold" ? "bg-green-400/10 text-green-300" :
                          player.status === "live" ? "bg-cyan-400/10 text-cyan-300" :
                          player.status === "unsold" ? "bg-red-400/10 text-red-300" :
                          "bg-white/10 text-slate-400"
                        }`}>
                          {player.status.toUpperCase()}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-3 py-4">
                          {player.status === "available" || player.status === "unsold" ? (
                            <button
                              onClick={() => startNextPlayer(player.id)}
                              className="rounded-lg border border-cyan-400/20 bg-cyan-400/5 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-400/10"
                            >
                              Put up
                            </button>
                          ) : (
                            <span className="text-xs text-slate-600">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* TEAMS TAB */}
        {activeTab === "teams" && (
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {currentTeams.map((team) => (
              <div key={team.id} className="glass-panel rounded-2xl p-5">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400/10 text-xl text-cyan-300">◈</div>
                <h3 className="text-lg font-black">{team.name}</h3>
                <p className="mt-1 text-xs text-slate-500">Captain: {team.captain}</p>
                <div className="my-5 border-t border-white/10" />
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Remaining purse</span>
                  <strong className="text-cyan-300">{team.remaining} pts</strong>
                </div>
                <div className="mt-3 flex justify-between text-sm">
                  <span className="text-slate-500">Players in squad</span>
                  <strong>{team.players}</strong>
                </div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400"
                    style={{ width: `${(team.remaining / 200) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </section>
        )}

        {/* FOOTER */}
        <footer className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/10 py-6 text-center sm:flex-row sm:text-left">
          <p className="text-xs text-slate-600">© 2026 AISA · Artificial Intelligence Student Association</p>
          <div className="flex items-center gap-3">
            <button onClick={resetAuctionView} className="text-xs text-slate-500 transition hover:text-cyan-300">
              Reset preview
            </button>
            <span className="text-xs text-slate-700">|</span>
            <span className="text-xs text-slate-600">Powered by AISA Tech Team</span>
          </div>
        </footer>
      </div>
    </main>
  );
}