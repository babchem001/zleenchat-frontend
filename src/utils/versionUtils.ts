type ParsedVersion = {
  parts: number[];
  prerelease: string[] | null;
};

function parseVersion(input: string): ParsedVersion | null {
  const value = input.trim().replace(/^v/i, "");
  const match = value.match(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/,
  );

  if (!match) {
    return null;
  }

  return {
    parts: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] ? match[4].split(".") : null,
  };
}

export function isVersionNewer(candidate: string, installed: string): boolean {
  const next = parseVersion(candidate);
  const current = parseVersion(installed);

  if (!next || !current) {
    return false;
  }

  for (let index = 0; index < 3; index += 1) {
    if (next.parts[index] !== current.parts[index]) {
      return next.parts[index] > current.parts[index];
    }
  }

  if (!next.prerelease && current.prerelease) {
    return true;
  }

  if (next.prerelease && !current.prerelease) {
    return false;
  }

  if (!next.prerelease || !current.prerelease) {
    return false;
  }

  const count = Math.max(next.prerelease.length, current.prerelease.length);

  for (let index = 0; index < count; index += 1) {
    const nextPart = next.prerelease[index];
    const currentPart = current.prerelease[index];

    if (nextPart === undefined) {
      return false;
    }

    if (currentPart === undefined) {
      return true;
    }

    if (nextPart === currentPart) {
      continue;
    }

    const nextIsNumeric = /^\d+$/.test(nextPart);
    const currentIsNumeric = /^\d+$/.test(currentPart);

    if (nextIsNumeric && currentIsNumeric) {
      return Number(nextPart) > Number(currentPart);
    }

    if (nextIsNumeric !== currentIsNumeric) {
      return !nextIsNumeric;
    }

    return nextPart > currentPart;
  }

  return false;
}
