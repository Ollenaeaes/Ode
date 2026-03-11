# Code Review Guidelines

## Always check
- New endpoints have corresponding tests that verify real behavior (not just status codes)
- Database queries use parameterized inputs (no string concatenation)
- Error messages don't leak internal details to users
- Access control: users can only access their own data unless they're admins
- Environment secrets are never hard-coded
- New dependencies are justified and from trusted sources

## Check against SDD spec
- Implementation matches the acceptance criteria in .claude/specs/
- Tests cover every GIVEN/WHEN/THEN in the spec
- Nothing out-of-scope was added
- The Development Approach section's simplification decisions were respected

## Skip
- Files in .claude/ (spec/config changes are expected)
- Generated files (lock files, build output)
- Formatting-only changes
