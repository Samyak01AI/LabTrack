export function isUniqueViolation(error) {
  return error?.code === 'ER_DUP_ENTRY' || Number(error?.errno) === 1062;
}
