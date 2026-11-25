export type TireSize = { width: number; aspect: number; rim: number };

export function parseTireSize(value: string): TireSize | undefined {
  const match = /^(\d{3})\s*\/\s*(\d{2})\s*R\s*(\d{2})(?:C)?$/i.exec(
    value.trim(),
  );
  if (!match) return;
  const [, widthText, aspectText, rimText] = match;
  const width = Number(widthText);
  const aspect = Number(aspectText);
  const rim = Number(rimText);
  if (
    width < 100 ||
    width > 450 ||
    aspect < 15 ||
    aspect > 95 ||
    rim < 10 ||
    rim > 30
  )
    return;
  return { width, aspect, rim };
}

export function tireGeometry({ width, aspect, rim }: TireSize) {
  const sidewall = (width * aspect) / 100;
  const diameter = rim * 25.4 + sidewall * 2;
  return { sidewall, diameter, circumference: Math.PI * diameter };
}
