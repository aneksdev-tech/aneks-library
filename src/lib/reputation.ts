export type ContributorLevel = {
  level: number;
  name: string;
  emoji: string;
  min: number;
  max: number;
  color: string;
};

export const contributorLevels: ContributorLevel[] = [
  {
    level: 1,
    name: "Beginner",
    emoji: "🌱",
    min: 0,
    max: 49,
    color: "text-gray-500",
  },
  {
    level: 2,
    name: "Contributor",
    emoji: "📚",
    min: 50,
    max: 149,
    color: "text-emerald-600",
  },
  {
    level: 3,
    name: "Scholar",
    emoji: "⭐",
    min: 150,
    max: 299,
    color: "text-amber-500",
  },
  {
    level: 4,
    name: "Expert",
    emoji: "🏆",
    min: 300,
    max: 599,
    color: "text-orange-500",
  },
  {
    level: 5,
    name: "Elite Contributor",
    emoji: "👑",
    min: 600,
    max: Number.MAX_SAFE_INTEGER,
    color: "text-purple-500",
  },
];

export function getContributorLevel(reputation: number): ContributorLevel {
  return (
    contributorLevels.find(
      (level) =>
        reputation >= level.min &&
        reputation <= level.max
    ) ?? contributorLevels[0]
  );
}

export function getNextContributorLevel(reputation: number) {
  const current = getContributorLevel(reputation);

  const next = contributorLevels.find(
    (level) => level.level === current.level + 1
  );

  if (!next) return null;

  return {
    ...next,
    pointsNeeded: next.min - reputation,
  };
}

export function getLevelProgress(reputation: number) {
  const current = getContributorLevel(reputation);

  if (current.level === contributorLevels.length) {
    return 100;
  }

  const range = current.max - current.min + 1;
  const progress = ((reputation - current.min) / range) * 100;

  return Math.max(0, Math.min(progress, 100));
}