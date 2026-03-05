/**
 * Calculate age in years from a date of birth
 * @param dateOfBirth - ISO date string (YYYY-MM-DD)
 * @returns Age in years as a number, or null if invalid
 */
export function calculateAgeFromDOB(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) {
    return null;
  }

  try {
    const dob = new Date(dateOfBirth);
    const today = new Date();

    if (isNaN(dob.getTime())) {
      return null;
    }

    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();

    // If birthday hasn't occurred this year, subtract 1 from age
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }

    // Ensure age is not negative
    return age >= 0 ? age : null;
  } catch {
    return null;
  }
}
