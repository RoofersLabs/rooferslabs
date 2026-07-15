# Coding Standards

## 1. Document Information

### Purpose

This document defines the coding standards, conventions, and engineering practices used throughout the RoofersLabs codebase.

It establishes a consistent approach to writing, organizing, reviewing, and maintaining code across all backend, frontend, and shared components.

---

### Scope

This document covers:

- Naming conventions
- Code organization
- TypeScript standards
- Function design
- Class design
- Interface design
- Error handling
- Dependency injection
- Documentation
- Code reviews
- Refactoring
- AI coding guidelines

---

### Out of Scope

Implementation details are documented separately:

- Backend Architecture
- Frontend Architecture
- API Standards
- Database Design
- Security Architecture
- AWS Infrastructure
- Testing Strategy

---

### Objectives

The coding standards aim to:

- Improve readability
- Reduce bugs
- Increase consistency
- Simplify maintenance
- Support scalable development
- Enable efficient AI-assisted coding

---

### Audience

This document is intended for:

- Backend Engineers
- Frontend Engineers
- Full-Stack Engineers
- Technical Leads
- AI Coding Assistants

---

### Ownership

This document is the authoritative reference for coding conventions across the RoofersLabs codebase.

## 2. Engineering Principles

Every contribution to the codebase should follow these principles.

### Core Principles

- Write code for humans first.
- Prefer clarity over cleverness.
- Keep implementations simple.
- Minimize duplication.
- Follow the Single Responsibility Principle.
- Prefer composition over inheritance.
- Keep business logic framework-independent.
- Make behavior predictable.
- Optimize only after measuring.
- Leave the codebase better than you found it.

---

### General Rules

- Follow established project conventions.
- Keep implementations consistent.
- Avoid unnecessary abstractions.
- Make dependencies explicit.
- Design for maintainability.

---

### Success Criteria

Good code should be:

- Readable
- Testable
- Maintainable
- Predictable
- Reusable

## 3. Project Structure Standards

### Directory Organization

Projects should be organized by business domains rather than technical layers.

Example:

```text
src/
├── auth/
├── companies/
├── customers/
├── ai/
├── appointments/
├── notifications/
├── shared/
└── config/
```

---

### Rules

- One business domain per module.
- Keep related files together.
- Avoid deeply nested directories.
- Shared code belongs in `shared/`.
- Configuration belongs in `config/`.
- Tests should remain close to implementation when practical.

---

### Avoid

- Mixed responsibilities
- Circular dependencies
- Generic utility folders containing unrelated code
- Excessively deep folder structures

## 4. Naming Conventions

### General Rules

Names should be:

- Descriptive
- Consistent
- Unambiguous
- Business-oriented

Avoid abbreviations unless they are universally recognized.

---

### Standards

| Item                  | Convention       |
| --------------------- | ---------------- |
| Variables             | camelCase        |
| Functions             | camelCase        |
| Methods               | camelCase        |
| Classes               | PascalCase       |
| Interfaces            | PascalCase       |
| Enums                 | PascalCase       |
| Constants             | UPPER_SNAKE_CASE |
| Files                 | kebab-case       |
| Folders               | kebab-case       |
| Environment Variables | UPPER_SNAKE_CASE |

---

### Examples

Good:

```ts
customerService;
createAppointment();
AppointmentController;
USER_SESSION_TIMEOUT;
customer - profile.ts;
```

Avoid:

```ts
cs;
func1();
DoStuff();
temp.ts;
data1;
```

## 5. File Organization Standards

### General Rules

Each file should have a single, well-defined responsibility.

Keep files focused, easy to navigate, and small enough to understand quickly.

---

### Recommended Order

1. Imports
2. Constants
3. Types & Interfaces
4. Class Declaration
5. Public Members
6. Private Members
7. Helper Functions
8. Exports

---

### Guidelines

- One primary class per file.
- Keep imports organized.
- Remove unused imports.
- Avoid wildcard imports.
- Export only what is necessary.
- Keep helper functions near their usage.

---

### Avoid

- Multiple unrelated classes
- Hidden side effects
- Large utility files
- Excessively long files
- Unused code

## 6. Function Standards

### Rules

- A function should have one responsibility.
- Prefer descriptive verb-based names.
- Keep functions small and focused.
- Minimize side effects.
- Return consistent data types.
- Prefer early returns over deep nesting.
- Validate inputs before processing.
- Extract reusable logic instead of duplicating code.

---

### Function Length

Recommended:

- 10–30 lines
- Maximum: 50 lines (unless strongly justified)

---

### Parameters

- Prefer 3 or fewer parameters.
- Group related values into objects.
- Avoid boolean flags that change behavior.

---

### Avoid

- Long functions
- Hidden side effects
- Duplicate logic
- Multiple responsibilities
- Excessive nesting

## 7. Class Standards

### Rules

- One responsibility per class.
- Keep classes cohesive.
- Prefer composition over inheritance.
- Use constructor injection.
- Expose only necessary public methods.
- Keep internal implementation private.

---

### Organization

Recommended order:

1. Constructor
2. Public Methods
3. Private Methods
4. Helper Methods

---

### Avoid

- God classes
- Static utility classes for business logic
- Circular dependencies
- Public mutable state

---

### Goal

Classes should model business concepts rather than technical implementation details.

## 8. Interface Standards

### Rules

Interfaces define contracts, not implementations.

They should describe behavior or data structures clearly and remain implementation-independent.

---

### Guidelines

- Keep interfaces small.
- Prefer multiple focused interfaces.
- Use meaningful names.
- Avoid unnecessary inheritance.
- Extend interfaces only when appropriate.

---

### Naming

Good:

```text
CustomerRepository
NotificationProvider
AIProvider
```

Avoid:

```text
IData
IObject
BaseInterface
```

---

### Goal

Interfaces should simplify dependency replacement and testing.

## 9. TypeScript Standards

### Rules

- Use strict mode.
- Prefer explicit types.
- Avoid `any`.
- Use enums only when appropriate.
- Prefer union types for fixed values.
- Use readonly where applicable.
- Favor type inference when obvious.

---

### Recommended

- DTOs for request models.
- Interfaces for contracts.
- Types for unions and utility types.
- Generics for reusable components.

---

### Avoid

- Implicit `any`
- Excessive type assertions
- Deep generic nesting
- Weak typing

---

### Goal

TypeScript should improve reliability through strong compile-time validation.

## 10. Dependency Injection Standards

### Rules

- Use constructor injection.
- Depend on abstractions.
- Never instantiate dependencies inside business classes.
- Keep dependencies explicit.
- Register services centrally.

---

### Benefits

- Loose coupling
- Better testing
- Easier maintenance
- Replaceable implementations

---

### Avoid

- Service locators
- Global singletons
- Hidden dependencies
- Manual dependency creation

---

### Goal

Every component should clearly declare the dependencies it requires.

## 11. Error Handling Standards

### Rules

- Fail fast.
- Throw meaningful exceptions.
- Catch exceptions only when recovery is possible.
- Never swallow errors.
- Log unexpected failures.
- Return standardized errors to callers.

---

### Error Categories

- Validation Errors
- Business Errors
- Authorization Errors
- Integration Errors
- Infrastructure Errors

---

### Avoid

- Empty catch blocks
- Generic error messages
- Exposing internal details
- Silent failures

---

### Goal

Errors should be predictable, informative, and actionable.

## 12. Code Formatting Standards

### Rules

- Use automated formatting.
- Keep indentation consistent.
- Limit line length to 100–120 characters.
- Remove trailing whitespace.
- End files with a newline.
- Use consistent import ordering.

---

### Formatting Tools

- Prettier
- ESLint

---

### Avoid

- Manual formatting differences
- Mixed indentation
- Inconsistent spacing
- Unformatted commits

---

### Goal

Formatting should remain consistent across the entire codebase through automation.

## 13. Commenting Standards

### Rules

Write comments only when they add value.

Code should explain _how_; comments should explain _why_.

---

### Appropriate Comments

- Business rules
- Complex algorithms
- Important decisions
- Temporary workarounds (with TODO)

---

### Avoid

- Obvious comments
- Outdated comments
- Commented-out code
- Duplicate explanations

---

### Example

Good:

```ts
// Required to prevent duplicate appointment creation.
```

Avoid:

```ts
// Increment counter.
counter++;
```

---

### Goal

Comments should clarify intent rather than restate the code.

## 14. Documentation Standards

### Rules

Document:

- Public APIs
- Complex business logic
- Module responsibilities
- Configuration requirements
- Architectural decisions

---

### Documentation Should

- Stay current
- Be concise
- Use examples when helpful
- Explain intent
- Avoid duplication

---

### Do Not Document

- Self-explanatory code
- Obvious getters/setters
- Internal implementation details
- Temporary debugging logic

---

### Goal

Documentation should accelerate understanding without becoming a maintenance burden.

## 15. SOLID Principles

### Rules

Every component should follow the SOLID principles whenever practical.

- **S** — Single Responsibility Principle
- **O** — Open/Closed Principle
- **L** — Liskov Substitution Principle
- **I** — Interface Segregation Principle
- **D** — Dependency Inversion Principle

---

### Guidelines

- Keep responsibilities focused.
- Extend behavior instead of modifying existing code.
- Depend on abstractions.
- Prefer multiple focused interfaces.
- Design for change without unnecessary complexity.

---

### Avoid

- God classes
- Tight coupling
- Large interfaces
- Framework-dependent business logic

---

### Goal

Produce modular, maintainable, and extensible code.

## 17. Code Reuse Standards

### Rules

Reuse existing implementations before introducing new ones.

Extract common functionality only after a genuine pattern emerges.

---

### Reusable Components

- Shared Services
- Utilities
- Validation Helpers
- Constants
- Configuration
- Interfaces
- Generic Components

---

### Avoid

- Copy-paste programming
- Premature abstractions
- Shared business logic across unrelated modules
- Generic utility files containing unrelated functions

---

### Goal

Maximize reuse while maintaining clear module boundaries.

## 18. Configuration Standards

### Rules

- Never hardcode configuration.
- Use environment variables.
- Keep defaults reasonable.
- Validate configuration during startup.
- Separate configuration by environment.

---

### Configuration Categories

- Database
- Authentication
- AI Providers
- AWS
- Email
- Telephony
- Logging
- Feature Flags

---

### Avoid

- Hardcoded secrets
- Environment-specific code
- Duplicate configuration
- Magic values

---

### Goal

Application behavior should be configurable without modifying source code.

## 20. Security Coding Standards

### Rules

- Validate all external input.
- Sanitize user data.
- Escape output where required.
- Use parameterized queries.
- Apply least privilege.
- Store secrets securely.
- Encrypt sensitive information.

---

### Never

- Trust client input
- Expose stack traces
- Hardcode credentials
- Disable security checks
- Bypass authorization

---

### Goal

Every feature should be secure by default.

> Detailed security architecture is documented in `11_Security_Architecture.md`.

## 21. Performance Coding Standards

### Rules

- Optimize only after measuring.
- Minimize database queries.
- Avoid unnecessary allocations.
- Cache expensive operations.
- Process long-running work asynchronously.

---

### Monitor

- Response Time
- Query Count
- Memory Usage
- CPU Usage
- Cache Efficiency

---

### Avoid

- N+1 queries
- Blocking operations
- Duplicate computations
- Excessive object creation

---

### Goal

Write efficient code without sacrificing readability.

## 22. Code Review Standards

### Review Checklist

Every pull request should verify:

- Correctness
- Readability
- Maintainability
- Security
- Performance
- Test Coverage
- Error Handling
- Documentation

---

### Review Principles

Review the code, not the developer.

Provide:

- Clear suggestions
- Actionable feedback
- Consistent standards

---

### Avoid

- Personal criticism
- Style debates already enforced by tooling
- Large unrelated changes

---

### Goal

Code reviews should improve quality while sharing engineering knowledge.

## 23. Refactoring Standards

### Rules

Refactor continuously to improve code quality without changing external behavior.

---

### Refactor When

- Code becomes difficult to understand.
- Duplication appears.
- Responsibilities become unclear.
- Complexity increases.
- New features become difficult to implement.

---

### Guidelines

- Refactor in small steps.
- Preserve behavior.
- Maintain test coverage.
- Remove obsolete code.
- Keep commits focused.

---

### Avoid

- Large uncontrolled rewrites
- Mixing refactoring with unrelated feature work
- Refactoring without tests

---

### Goal

The codebase should become easier to maintain with every iteration.

## 24. Testing-Oriented Coding

### Rules

Write code that is easy to test.

- Keep business logic independent.
- Avoid hidden dependencies.
- Inject dependencies.
- Keep methods deterministic.
- Separate I/O from business logic.
- Avoid global state.

---

### Design Practices

- Small functions
- Clear inputs
- Predictable outputs
- Mock external services
- Test business behavior

---

### Avoid

- Hardcoded dependencies
- Static mutable state
- Framework-dependent business logic
- Hidden side effects

---

### Goal

Every business component should be independently testable.

## 25. Git Commit Standards

### Rules

Commits should represent one logical change.

---

### Commit Messages

Preferred format:

```text
type(scope): short description
```

Examples:

```text
feat(auth): add JWT refresh endpoint
fix(ai): handle empty transcript
refactor(customer): simplify validation
docs(api): update authentication guide
```

---

### Guidelines

- Keep commits focused.
- Write meaningful messages.
- Commit frequently.
- Separate refactoring from new features.

---

### Avoid

- "fix"
- "update"
- "changes"
- Large unrelated commits

---

### Goal

Git history should clearly communicate project evolution.

## 26. Pull Request Standards

### Requirements

Every pull request should:

- Solve one problem
- Pass automated checks
- Include tests when applicable
- Update documentation if required
- Remain reasonably small

---

### Before Approval

Verify:

- Build succeeds
- Lint passes
- Tests pass
- No debug code remains
- Documentation is updated

---

### Avoid

- Massive pull requests
- Mixed unrelated changes
- Incomplete implementations

---

### Goal

Pull requests should remain easy to review and safe to merge.

## 27. AI Coding Guidelines

### Purpose

AI coding assistants should generate code that follows every standard defined in this document.

Generated code should prioritize correctness, readability, maintainability, and consistency.

---

### AI Requirements

Generated code should:

- Follow project architecture
- Respect module boundaries
- Use existing patterns
- Avoid duplicated implementations
- Produce production-ready code
- Include appropriate error handling
- Follow naming conventions

---

### AI Must Not

- Invent new architectures
- Ignore existing conventions
- Duplicate business logic
- Introduce unnecessary abstractions
- Leave placeholder implementations

---

### Goal

AI-generated code should be indistinguishable from well-written human code.

## 29. Deprecation Standards

### Rules

Deprecated code should remain functional during the migration period.

---

### Deprecation Process

1. Mark as deprecated.
2. Document replacement.
3. Notify developers.
4. Migrate usage.
5. Remove obsolete implementation.

---

### Avoid

- Immediate breaking removals
- Undocumented deprecations
- Multiple replacement paths

---

### Goal

Code evolution should remain predictable without disrupting development.

## 30. Development Checklist

Before submitting code, verify:

- Naming follows standards.
- Architecture is respected.
- Business logic is centralized.
- Errors are handled.
- Security is considered.
- Performance is acceptable.
- Tests pass.
- Documentation is updated.
- No dead code remains.
- Formatting and linting pass.

---

### Goal

Every contribution should satisfy the project's minimum quality standards before review.

## 31. Quick Reference

### Always

- Keep code simple.
- Follow existing patterns.
- Use descriptive names.
- Write reusable components.
- Validate inputs.
- Handle errors.
- Remove duplication.
- Keep modules focused.
- Refactor continuously.
- Document important decisions.

---

### Never

- Hardcode secrets
- Ignore errors
- Duplicate business logic
- Commit commented-out code
- Leave debug statements
- Bypass security
- Use `any` without justification
- Mix unrelated responsibilities

## 32. Appendix

### Related Documentation

This document complements:

- `03_Backend_Architecture.md`
- `04_Frontend_Architecture.md`
- `08_Database_Design.md`
- `09_API_Standards.md`
- `11_Security_Architecture.md`
- `12_AWS_Infrastructure.md`
- `13_Deployment_Guide.md`
- `Testing_Strategy.md`

---

### Revision History

Track:

- Version
- Date
- Author
- Summary of Changes

---

### Document Maintenance

Review this document whenever changes are made to:

- Coding conventions
- Technology stack
- Development workflow
- Engineering standards
- AI coding guidelines

This document serves as the definitive reference for coding practices across the RoofersLabs codebase.
