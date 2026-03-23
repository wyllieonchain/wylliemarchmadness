'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLeaderboard, useUser } from '@/lib/hooks';

const rankEmojis: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function LeaderboardPage() {
  const router = useRouter();
  const { user } = useUser();
  const { leaderboard, loading } = useLeaderboard();
  const [sortBy, setSortBy] = useState<'pts' | 'poss'>('pts');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-[#9b8ab8]">Loading leaderboard...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
        <p className="text-[#9b8ab8] text-sm mt-1">{leaderboard.length} player{leaderboard.length !== 1 ? 's' : ''} in the pool</p>
      </div>

      {leaderboard.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <div className="text-4xl mb-3">👀</div>
          <p className="text-[#9b8ab8] text-lg">No one here yet</p>
          <p className="text-[#6b5a8a] text-sm mt-2">
            Share the link with your family to get started!
          </p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[3rem_1fr_4.5rem_4.5rem] gap-2 px-5 py-3 border-b border-white/[0.04]">
            <span className="text-[10px] text-[#6b5a8a] font-medium uppercase tracking-wider">#</span>
            <span className="text-[10px] text-[#6b5a8a] font-medium uppercase tracking-wider">Player</span>
            <button
              onClick={() => setSortBy('pts')}
              className={`text-[10px] font-medium uppercase tracking-wider text-right ${sortBy === 'pts' ? 'text-white' : 'text-[#6b5a8a]'}`}
            >
              Pts
            </button>
            <button
              onClick={() => setSortBy('poss')}
              className={`text-[10px] font-medium uppercase tracking-wider text-right ${sortBy === 'poss' ? 'text-white' : 'text-[#6b5a8a]'}`}
            >
              Poss
            </button>
          </div>

          {/* Rows */}
          {[...leaderboard].sort((a, b) =>
            sortBy === 'poss'
              ? b.possible_points - a.possible_points || b.total_points - a.total_points
              : b.total_points - a.total_points || b.possible_points - a.possible_points
          ).map((entry, index) => {
            const isCurrentUser = user?.id === entry.user_id;
            const rank = index + 1;
            const emoji = rankEmojis[rank];

            return (
              <div
                key={entry.user_id}
                className={index < leaderboard.length - 1 ? 'border-b border-white/[0.04]' : ''}
              >
                <button
                  onClick={() => router.push(`/leaderboard/${entry.user_id}`)}
                  className={`w-full grid grid-cols-[3rem_1fr_4.5rem_4.5rem] gap-2 px-5 py-4 items-center transition-colors hover:bg-white/[0.02] text-left ${
                    isCurrentUser ? 'bg-[#7c3aed]/[0.04]' : ''
                  }`}
                >
                  <span className={`text-sm font-mono tabular-nums ${emoji ? 'text-lg' : rank <= 3 ? 'text-[#a78bfa] font-bold' : 'text-[#6b5a8a]'}`}>
                    {emoji || rank}
                  </span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-sm truncate ${isCurrentUser ? 'font-medium text-[#a78bfa]' : ''}`}>
                      {entry.display_name}
                    </span>
                    {isCurrentUser && (
                      <span className="shrink-0 text-[10px] bg-[#7c3aed]/20 text-[#a78bfa] px-1.5 py-0.5 rounded-full font-medium">
                        YOU
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-mono tabular-nums text-right font-bold">
                    {entry.total_points}
                  </span>
                  <span className="text-sm font-mono tabular-nums text-right text-[#6b5a8a]">
                    {entry.possible_points}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
