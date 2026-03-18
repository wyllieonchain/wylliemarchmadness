'use client';

export default function HowItWorksPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-white">
          How It Works <span className="inline-block">🏀</span>
        </h1>
        <p className="text-[#9b8ab8] text-sm mt-1">
          Everything you need to know in 60 seconds
        </p>
      </div>

      {/* The Pool */}
      <section className="glass-card p-6 space-y-3">
        <h2 className="text-base font-bold text-[#a78bfa]">🏆 The Pool</h2>
        <p className="text-sm leading-relaxed text-white/80">
          This is the <span className="font-medium text-white">Wyllie Family Bracket Pool</span>.
          Fill out your bracket by picking the winner of all <span className="font-medium text-[#a78bfa]">63 games</span> before
          the tournament starts. That&apos;s it &mdash; first round through the championship.
        </p>
      </section>

      {/* Scoring */}
      <section className="glass-card p-6 space-y-5">
        <h2 className="text-base font-bold text-[#a78bfa]">🧮 Scoring (The Fun Part)</h2>
        <p className="text-sm leading-relaxed text-white/80">
          Every correct pick earns you points. The formula is dead simple:
        </p>

        {/* Formula */}
        <div className="glass-card-sm p-5 text-center">
          <p className="text-xl font-bold font-mono">
            <span className="text-green">1 pt</span>
            <span className="text-[#6b5a8a] mx-2">×</span>
            <span className="text-[#a78bfa]">winning team&apos;s seed</span>
          </p>
          <p className="text-xs text-[#6b5a8a] mt-2">Same formula every round. No escalation. No multipliers.</p>
        </div>

        <p className="text-sm leading-relaxed text-white/80">
          This means <span className="font-medium text-[#a78bfa]">upset picks are worth WAY more</span>.
          Picking chalk is safe but boring. Picking upsets is risky but rewarding.
        </p>

        {/* Example Cards */}
        <div className="space-y-3 pt-1">
          <p className="text-xs font-medium text-[#9b8ab8] uppercase tracking-wider">Examples</p>

          {/* Example 1 - Chalk pick */}
          <div className="glass-card-sm p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="text-[#a78bfa] font-mono font-bold">(1)</span>{' '}
                <span className="font-medium">Duke</span>
                <span className="text-[#6b5a8a] mx-2">beats</span>
                <span className="text-[#6b5a8a] font-mono">(16)</span>{' '}
                <span className="text-[#6b5a8a]">Siena</span>
              </div>
              <span className="text-green font-medium text-sm">✓ Correct</span>
            </div>
            <div className="flex items-center justify-between bg-white/[0.03] rounded-lg px-3 py-2">
              <span className="text-xs text-[#6b5a8a] font-mono">1 pt × 1 seed</span>
              <span className="text-lg font-bold font-mono">= 1 pt</span>
            </div>
          </div>

          {/* Example 2 - Upset pick */}
          <div className="glass-card-sm p-4 space-y-2 border-[#7c3aed]/20">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="text-[#a78bfa] font-mono font-bold">(12)</span>{' '}
                <span className="font-medium">UNI</span>
                <span className="text-[#6b5a8a] mx-2">beats</span>
                <span className="text-[#6b5a8a] font-mono">(5)</span>{' '}
                <span className="text-[#6b5a8a]">St. John&apos;s</span>
              </div>
              <span className="text-green font-medium text-sm">✓ Correct</span>
            </div>
            <div className="flex items-center justify-between bg-white/[0.03] rounded-lg px-3 py-2">
              <span className="text-xs text-[#6b5a8a] font-mono">1 pt × 12 seed</span>
              <span className="text-lg font-bold font-mono text-[#a78bfa]">= 12 pts</span>
            </div>
          </div>

          {/* Example 3 - Dream scenario */}
          <div className="glass-card-sm p-4 space-y-2 border-gold/20">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="text-gold font-mono font-bold">(16)</span>{' '}
                <span className="font-medium text-gold">Cinderella</span>
                <span className="text-[#6b5a8a] mx-2">wins it all</span>
              </div>
              <span className="text-gold font-medium text-sm">🤯 Dream</span>
            </div>
            <div className="flex items-center justify-between bg-white/[0.03] rounded-lg px-3 py-2">
              <span className="text-xs text-[#6b5a8a] font-mono">16 pts × 6 wins</span>
              <span className="text-lg font-bold font-mono text-gold">= 96 pts</span>
            </div>
          </div>
        </div>
      </section>

      {/* Possible Points */}
      <section className="glass-card p-6 space-y-3">
        <h2 className="text-base font-bold text-[#a78bfa]">📊 Possible Points</h2>
        <p className="text-sm leading-relaxed text-white/80">
          On the leaderboard you&apos;ll see a <span className="font-medium text-white">&ldquo;Poss&rdquo;</span> column.
          That&apos;s the <span className="font-medium text-white">maximum points you can still earn</span> from
          your remaining alive picks. When a team you picked gets eliminated, those future points vanish.
          Use it to see who&apos;s still in the hunt.
        </p>
      </section>

      {/* Deadline */}
      <section className="glass-card p-6 space-y-3 border-red/20">
        <h2 className="text-base font-bold text-red">⏰ Pick Deadline</h2>
        <div className="glass-card-sm p-5 text-center">
          <p className="text-xl font-bold text-white">Thursday, March 19</p>
          <p className="text-lg font-mono text-[#a78bfa]">12:15 PM ET</p>
          <p className="text-xs text-[#6b5a8a] mt-2">All 63 picks must be locked in before tip-off</p>
        </div>
      </section>

      {/* Have Fun */}
      <section className="glass-card p-6 space-y-3">
        <h2 className="text-base font-bold text-[#a78bfa]">💬 Have Fun With It</h2>
        <p className="text-sm leading-relaxed text-white/80">
          This is a family thing. Trash talk is <span className="font-medium text-green">encouraged</span>.
          Bold upset picks are <span className="font-medium text-[#a78bfa]">respected</span>.
          Complaining about your bracket after round one is <span className="font-medium text-[#6b5a8a]">mandatory</span>.
        </p>
        <p className="text-sm text-[#9b8ab8]">
          Good luck &mdash; you&apos;re gonna need it. 🏀
        </p>
      </section>
    </div>
  );
}
