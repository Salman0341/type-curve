// src/utils/svgWarpEngine.ts

export type PointTransformer = (
  x: number,
  y: number,
) => { x: number; y: number };

interface WarpPathArgs {
  pathData: string;
  transformer: PointTransformer;
}

const TOKEN_PATTERN = /[a-zA-Z]|-?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi;
const COMMAND_ARITY: Record<string, number> = {
  M: 2,
  L: 2,
  H: 1,
  V: 1,
  C: 6,
  S: 4,
  Q: 4,
  T: 2,
  A: 7,
  Z: 0,
};

const formatNumber = (value: number) =>
  Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/\.?0+$/, "");

function transformPoint(
  x: number,
  y: number,
  transformer: PointTransformer,
): [number, number] {
  if (typeof transformer !== "function") return [x, y];
  try {
    const res = transformer(x, y);
    if (res && typeof res.x === "number" && typeof res.y === "number") {
      if (Number.isNaN(res.x) || Number.isNaN(res.y)) return [x, y];
      return [res.x, res.y];
    }
  } catch (e) {
    console.error("Transform error:", e);
  }
  return [x, y];
}

function isCommand(token: string | undefined): token is string {
  return Boolean(token && /^[a-zA-Z]$/.test(token));
}

export function warpPathData({ pathData, transformer }: WarpPathArgs): string {
  const tokens = pathData.match(TOKEN_PATTERN) ?? [];
  const output: string[] = [];
  let index = 0;
  let command = "";
  let currentX = 0;
  let currentY = 0;

  while (index < tokens.length) {
    const token = tokens[index];
    if (isCommand(token)) {
      command = token;
      index += 1;
    }

    if (!command) break;

    const upperCommand = command.toUpperCase();
    const arity = COMMAND_ARITY[upperCommand];
    if (arity === undefined) break;

    if (arity === 0) {
      output.push("Z");
      command = "";
      continue;
    }

    while (index + arity <= tokens.length && !isCommand(tokens[index])) {
      const values = tokens
        .slice(index, index + arity)
        .map((value) => Number(value));
      index += arity;

      if (values.some((value) => Number.isNaN(value))) return pathData;

      const relative = command === command.toLowerCase();
      const absoluteX = (v: number) => (relative ? currentX + v : v);
      const absoluteY = (v: number) => (relative ? currentY + v : v);
      const activeCommand = command.toUpperCase();

      switch (activeCommand) {
        case "M":
        case "L":
        case "T": {
          const [nx, ny] = transformPoint(
            absoluteX(values[0] ?? 0),
            absoluteY(values[1] ?? 0),
            transformer,
          );
          output.push(
            `${activeCommand}${formatNumber(nx)} ${formatNumber(ny)}`,
          );
          currentX = absoluteX(values[0] ?? 0);
          currentY = absoluteY(values[1] ?? 0);
          break;
        }
        case "H": {
          const nextX = absoluteX(values[0] ?? 0);
          const [nx, ny] = transformPoint(nextX, currentY, transformer);
          output.push(`L${formatNumber(nx)} ${formatNumber(ny)}`);
          currentX = nextX;
          break;
        }
        case "V": {
          const nextY = absoluteY(values[0] ?? 0);
          const [nx, ny] = transformPoint(currentX, nextY, transformer);
          output.push(`L${formatNumber(nx)} ${formatNumber(ny)}`);
          currentY = nextY;
          break;
        }
        case "C": {
          const p1 = transformPoint(
            absoluteX(values[0] ?? 0),
            absoluteY(values[1] ?? 0),
            transformer,
          );
          const p2 = transformPoint(
            absoluteX(values[2] ?? 0),
            absoluteY(values[3] ?? 0),
            transformer,
          );
          const p3 = transformPoint(
            absoluteX(values[4] ?? 0),
            absoluteY(values[5] ?? 0),
            transformer,
          );
          output.push(`C${[...p1, ...p2, ...p3].map(formatNumber).join(" ")}`);
          currentX = absoluteX(values[4] ?? 0);
          currentY = absoluteY(values[5] ?? 0);
          break;
        }
        case "S":
        case "Q": {
          const p1 = transformPoint(
            absoluteX(values[0] ?? 0),
            absoluteY(values[1] ?? 0),
            transformer,
          );
          const p2 = transformPoint(
            absoluteX(values[2] ?? 0),
            absoluteY(values[3] ?? 0),
            transformer,
          );
          output.push(
            `${activeCommand}${[...p1, ...p2].map(formatNumber).join(" ")}`,
          );
          currentX = absoluteX(values[2] ?? 0);
          currentY = absoluteY(values[3] ?? 0);
          break;
        }
        case "A": {
          const [nx, ny] = transformPoint(
            absoluteX(values[5] ?? 0),
            absoluteY(values[6] ?? 0),
            transformer,
          );
          output.push(
            `A${formatNumber(values[0] ?? 0)} ${formatNumber(values[1] ?? 0)} ${formatNumber(
              values[2] ?? 0,
            )} ${formatNumber(values[3] ?? 0)} ${formatNumber(values[4] ?? 0)} ${formatNumber(
              nx,
            )} ${formatNumber(ny)}`,
          );
          currentX = absoluteX(values[5] ?? 0);
          currentY = absoluteY(values[6] ?? 0);
          break;
        }
      }

      if (activeCommand === "M") {
        command = relative ? "l" : "L";
      }
    }
  }

  return output.join(" ");
}
