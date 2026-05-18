import { buildVacatedPositionTitle } from './offboarding.service';

describe('buildVacatedPositionTitle', () => {
  it('places the specific position first with the vacated suffix', () => {
    expect(
      buildVacatedPositionTitle({
        specificPositionTitle: 'Senior Software Engineer',
        firstName: 'John',
        lastName: 'Doe',
      }),
    ).toBe('Senior Software Engineer (Vacated Position)');
  });

  it('trims surrounding whitespace from the specific position title', () => {
    expect(
      buildVacatedPositionTitle({
        specificPositionTitle: '  HR Generalist  ',
        firstName: 'Jane',
        lastName: 'Smith',
      }),
    ).toBe('HR Generalist (Vacated Position)');
  });

  it('falls back to the employee-name label when no specific position is available', () => {
    expect(
      buildVacatedPositionTitle({
        specificPositionTitle: '',
        firstName: 'John',
        lastName: 'Doe',
      }),
    ).toBe('Vacated Position (John Doe)');
  });
});
