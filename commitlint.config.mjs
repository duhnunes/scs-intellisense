// Commit messages follow Conventional Commits: release-it builds the
// CHANGELOG from their types, and a mistyped one (`fex:`) was left out of
// it silently. The hook in .husky/commit-msg refuses such a message.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Each paragraph of a body is one line, as the owner's commit tool
    // writes it: valid, and every commit since 0.7.0 is written so.
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
  },
}
