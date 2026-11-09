import { randomInt } from "node:crypto";

function shuffle<T>(values: T[]) {
  const copy = [...values];
  for (let end = copy.length - 1; end > 0; end--) {
    const index = randomInt(end + 1);
    [copy[end], copy[index]] = [copy[index], copy[end]];
  }
  return copy;
}

export function drawAssignments(members: string[], blocked: [string, string][]) {
  const ids = [...new Set(members)];
  if (ids.length < 2) return null;
  const exclusions = new Set(blocked.map(([giver, receiver]) => `${giver}:${receiver}`));
  const choices = new Map(ids.map((giver) => [
    giver, shuffle(ids.filter((receiver) => giver !== receiver && !exclusions.has(`${giver}:${receiver}`))),
  ]));
  const assigned = new Map<string, string>();

  function assign(giver: string, visited: Set<string>): boolean {
    for (const receiver of choices.get(giver)!) {
      if (visited.has(receiver)) continue;
      visited.add(receiver);
      const previous = assigned.get(receiver);
      if (!previous || assign(previous, visited)) {
        assigned.set(receiver, giver);
        return true;
      }
    }
    return false;
  }

  for (const giver of shuffle(ids)) {
    if (!assign(giver, new Set())) return null;
  }
  return Array.from(assigned, ([receiver, giver]) => ({ giver, receiver }));
}
