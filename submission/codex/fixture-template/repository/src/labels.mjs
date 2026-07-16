/** Return true when a GitHub label belongs to the release namespace. */
export function isReleaseLabel(label) {
  return typeof label === 'string' && /^release:/i.test(label.trim());
}
