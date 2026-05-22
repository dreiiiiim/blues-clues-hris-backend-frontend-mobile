export function toStartCaseName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('en-US')
    .replace(/(^|[\s'-])([a-z])/g, (_match, prefix: string, letter: string) =>
      `${prefix}${letter.toLocaleUpperCase('en-US')}`,
    );
}

export function normalizeNamePart(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const trimmed = value.trim();
  return trimmed ? toStartCaseName(trimmed) : null;
}

export function isAtLeastAge(dateOfBirth: string, minimumAge: number, today = new Date()): boolean {
  const [year, month, day] = dateOfBirth.split('-').map(Number);
  if (!year || !month || !day) return false;

  const birthDate = new Date(Date.UTC(year, month - 1, day));
  if (
    birthDate.getUTCFullYear() !== year ||
    birthDate.getUTCMonth() !== month - 1 ||
    birthDate.getUTCDate() !== day
  ) {
    return false;
  }

  const referenceParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(today)
    .split('-')
    .map(Number);
  const [referenceYear, referenceMonth, referenceDay] = referenceParts;
  const reference = new Date(Date.UTC(referenceYear, referenceMonth - 1, referenceDay));

  let age = reference.getUTCFullYear() - birthDate.getUTCFullYear();
  const birthdayThisYear = new Date(Date.UTC(
    reference.getUTCFullYear(),
    birthDate.getUTCMonth(),
    birthDate.getUTCDate(),
  ));

  if (reference < birthdayThisYear) age -= 1;
  return age >= minimumAge;
}
