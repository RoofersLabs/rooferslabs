# CLAUDE.md

# RoofersLabs AI Development Guide

## 1. Purpose

Welcome to the RoofersLabs codebase.

This file is the primary entry point for every AI coding assistant working on this repository.

Before making any architectural, product, or implementation decisions, read this document completely.

This file does not contain the complete project specification.

Instead, it explains:

- What RoofersLabs is.
- How the repository is organized.
- Which documents are authoritative.
- How engineering decisions should be made.
- Which standards must always be followed.
- How new features should be implemented.
- Which files must be updated together.

This document serves as the operating manual for the entire project.

## 2. Project Overview

Project Name:

RoofersLabs

Product:

AI-Powered Front Office Platform for Roofing Companies

Primary Goal:

Answer every inbound customer call using conversational AI while capturing structured business information for roofing companies.

Current Stage:

MVP Development

Business Model:

Vertical SaaS

Primary Industry:

Roofing

Target Market:

Independent roofing companies across the United States.

Core Product Areas:

- AI Receptionist
- Customer Management
- Call Management
- Knowledge Base
- Appointment Management
- Dashboard
- Notifications

Every engineering decision should support the MVP before future expansion.

## 3. Product Mission

Mission

No roofing company should lose a qualified customer because nobody answered the phone.

Every feature should directly improve one or more of the following:

- Customer communication
- Lead capture
- Appointment generation
- Operational efficiency
- Business visibility

If a proposed feature does not support the mission, it should not be prioritized.

## 4. Development Philosophy

RoofersLabs follows several guiding principles.

Build:

- Simple systems
- Reliable software
- Modular architecture
- Production-quality code
- Maintainable solutions

Avoid:

- Overengineering
- Premature optimization
- Duplicate business logic
- Tight coupling
- Unnecessary abstractions

When multiple solutions exist, choose the one that maximizes clarity and long-term maintainability.

## 5. Documentation Hierarchy

All project documentation has a defined ownership.

Read the appropriate document before making changes.

00_Master_Project_Specification.md

Owns:

- Vision
- Mission
- Business Strategy

---

01_Product_Requirements.md

Owns:

- Product Behavior
- Functional Requirements
- Business Rules

---

02_System_Architecture.md

Owns:

- Overall Architecture
- Component Relationships

---

03_Backend_Architecture.md

Owns:

Backend implementation.

---

04_Frontend_Architecture.md

Owns:

Frontend implementation.

---

14_Billing.md

Owns:

Stripe subscription billing and the payment wall.

---

06_Telephony_Architecture.md

Owns:

Voice communication.

---

07_AI_Receptionist_Specification.md

Owns:

AI conversation behavior.

---

08_Database_Design.md

Owns:

Database schema.

---

09_API_Standards.md

Owns:

REST API standards.

---

10_AWS_Infrastructure.md

Owns:

Cloud infrastructure.

---

11_Coding_Standards.md

Owns:

Code quality.

---

12_Testing_Strategy.md

Owns:

Testing requirements.

## 6. Decision Hierarchy

If documentation conflicts, follow this order.

Highest Priority

1. CLAUDE.md

↓

2. Master Project Specification

↓

3. Product Requirements

↓

4. System Architecture

↓

5. Component Architecture Documents

↓

6. Coding Standards

↓

7. Testing Strategy

Never violate a higher-priority document.

## 7. Repository Structure

The repository follows a modular organization.

Example

/
├── docs/
├── apps/
├── packages/
├── prisma/
├── docker/
├── scripts/
├── tests/
├── .github/

Documentation belongs inside the docs directory.

Business logic belongs inside application packages.

Infrastructure belongs inside infrastructure directories.

Never mix responsibilities between directories.

## 8. Technology Stack

Frontend

- React
- TypeScript
- Vite
- TailwindCSS

Backend

- NestJS
- Node.js
- TypeScript

Database

- PostgreSQL
- Prisma ORM

AI

- OpenAI Realtime API
- Retrieval-Augmented Generation (RAG)

Infrastructure

- AWS
- Docker

Testing

- Unit Testing
- Integration Testing
- End-to-End Testing

Do not introduce additional frameworks without explicit approval.

## 9. Engineering Principles

Every implementation should prioritize:

- Readability
- Maintainability
- Reliability
- Scalability
- Security

Always:

- Keep controllers thin.
- Place business logic in services.
- Validate every request.
- Use dependency injection.
- Prefer composition over inheritance.
- Maintain strong typing.
- Keep modules loosely coupled.

Never duplicate business logic.

## 10. AI Development Principles

The AI Receptionist is the core product.

The AI should:

- Answer accurately.
- Follow company knowledge.
- Avoid hallucinations.
- Preserve conversation context.
- Detect emergencies.
- Capture structured information.
- Produce reliable summaries.

Never invent business information.

When uncertain, choose the safest response.

## 11. Coding Standards

All code must comply with:

docs/11_Coding_Standards.md

Key requirements:

- TypeScript strict mode.
- Strong typing.
- SOLID principles.
- Consistent naming.
- Small reusable functions.
- Comprehensive documentation.
- Error handling.
- Logging where appropriate.

Generated code should always match existing project conventions.

## 12. Definition of Done

A feature is complete only when:

- Requirements implemented.
- Architecture respected.
- Tests added.
- Documentation updated.
- Build passes.
- Lint passes.
- Type checking passes.
- Code reviewed.
- No critical defects remain.

Implementation alone is never considered complete.

## 13. File Update Policy

Whenever a feature changes, update every affected document.

Examples:

New API

Update:

- Product Requirements
- Backend Architecture
- API Standards
- Testing Strategy

Database change

Update:

- Database Design
- Backend Architecture
- Product Requirements
- Testing Strategy

AI behavior change

Update:

- AI Receptionist Specification
- Product Requirements
- Testing Strategy

Documentation must remain synchronized with implementation.

## 14. Development Workflow

Every task should follow this sequence:

1. Read relevant documentation.
2. Identify affected modules.
3. Design before implementation.
4. Implement incrementally.
5. Write or update tests.
6. Verify functionality.
7. Update documentation.
8. Prepare for review.

Avoid making architectural decisions during implementation unless explicitly required.

## 15. Rules for Claude Code

When contributing to this repository:

Always:

- Read relevant documentation first.
- Reuse existing patterns.
- Preserve architectural consistency.
- Prefer existing components over creating new ones.
- Explain significant architectural changes.
- Update affected documentation.
- Maintain backward compatibility whenever practical.

Never:

- Invent undocumented business rules.
- Duplicate functionality.
- Ignore coding standards.
- Bypass testing requirements.
- Introduce new dependencies without justification.
- Modify architecture without updating the corresponding documentation.
- Generate code that conflicts with the project's documented standards.

If documentation is unclear or conflicting, stop and surface the issue instead of making assumptions.

## 16. Documentation Usage Rules

Documentation is the authoritative source of project knowledge.

Always consult the relevant document before implementing a feature.

---

### Read Before Implementing

Business Changes

→ 00_Master_Project_Specification.md

Product Features

→ 01_Product_Requirements.md

Architecture

→ 02_System_Architecture.md

Backend

→ 03_Backend_Architecture.md

Frontend

→ 04_Frontend_Architecture.md

Billing

→ 14_Billing.md

Telephony

→ 06_Telephony_Architecture.md

AI

→ 07_AI_Receptionist_Specification.md

Database

→ 08_Database_Design.md

API

→ 09_API_Standards.md

Infrastructure

→ 10_AWS_Infrastructure.md

Coding

→ 11_Coding_Standards.md

Testing

→ 12_Testing_Strategy.md

Never implement features based on assumptions when documentation exists.

## 17. Feature Development Rules

Every feature should follow the same development lifecycle.

1. Understand the business objective.
2. Review relevant documentation.
3. Identify affected modules.
4. Design before coding.
5. Implement incrementally.
6. Add automated tests.
7. Update documentation.
8. Verify production readiness.

Never skip design or documentation updates.

## 18. Architectural Consistency

The architecture should remain internally consistent.

Always:

- Respect module boundaries.
- Keep services independent.
- Use existing abstractions.
- Follow established patterns.
- Preserve separation of concerns.

Never:

- Introduce circular dependencies.
- Duplicate business logic.
- Mix unrelated responsibilities.
- Bypass architectural layers.

Consistency is more valuable than novelty.

## 19. Code Generation Rules

Generated code should be production quality.

Always:

- Write readable code.
- Prefer explicit implementations.
- Follow project conventions.
- Use descriptive names.
- Handle failures gracefully.
- Add appropriate logging.
- Keep functions focused.

Never:

- Leave placeholder implementations.
- Generate dead code.
- Ignore linting rules.
- Ignore TypeScript errors.
- Introduce unnecessary complexity.

## 20. Documentation Synchronization

Documentation and implementation must remain synchronized.

Whenever code changes affect project behavior:

- Update requirements.
- Update architecture.
- Update API documentation.
- Update database documentation.
- Update testing documentation.

Documentation is part of the implementation, not an optional task.

## 21. Error Handling Philosophy

Errors should be predictable, informative, and recoverable.

Always:

- Validate inputs.
- Return meaningful errors.
- Log unexpected failures.
- Protect sensitive information.
- Fail safely.

Never expose:

- Internal stack traces.
- Secrets.
- Database details.
- Infrastructure information.

## 22. Security Rules

Security applies to every feature.

Always:

- Validate input.
- Authenticate protected requests.
- Authorize resource access.
- Encrypt sensitive data.
- Protect secrets.
- Follow least privilege.

Never:

- Store secrets in source code.
- Trust client input.
- Expose internal APIs.
- Bypass authentication.

## 23. Performance Expectations

Every implementation should consider performance.

Prioritize:

- Fast API responses.
- Efficient database access.
- Minimal network requests.
- Low memory usage.
- Responsive interfaces.

Avoid premature optimization while preventing obvious inefficiencies.

## 24. AI Implementation Rules

When working on AI features:

Always:

- Use company knowledge.
- Preserve conversation context.
- Validate AI outputs.
- Log important events.
- Produce structured business data.

Never:

- Fabricate company information.
- Ignore uncertainty.
- Break conversation continuity.
- Skip safety validation.

The AI should remain predictable, transparent, and reliable.

## 25. User Experience Rules

Every interface should prioritize usability.

Always:

- Minimize user effort.
- Maintain visual consistency.
- Provide immediate feedback.
- Keep navigation predictable.
- Support accessibility.

Never introduce unnecessary complexity or inconsistent interaction patterns.

## 26. Testing Requirements

Every implementation should include appropriate validation.

Required testing includes:

- Unit Tests
- Integration Tests
- API Tests
- End-to-End Tests (when applicable)

Critical workflows require regression protection before release.

Code without adequate testing is not considered complete.

## 27. Dependency Management

Dependencies should be introduced cautiously.

Before adding a dependency:

- Verify necessity.
- Evaluate maintenance.
- Assess security.
- Consider bundle size.
- Review licensing.

Prefer existing project capabilities whenever practical.

## 28. Refactoring Guidelines

Refactoring should improve software without changing observable behavior.

Goals include:

- Simpler code.
- Better readability.
- Reduced duplication.
- Improved modularity.
- Easier testing.

Avoid large-scale refactoring without a clear business or technical justification.

## 29. Pull Request Expectations

Every change should be easy to review.

Changes should:

- Have a clear purpose.
- Be logically grouped.
- Include documentation updates.
- Include tests.
- Pass automated validation.

Large unrelated changes should be split into smaller, focused updates.

## 31. Repository Conventions

Maintain a clean and predictable repository structure.

### General Rules

- One responsibility per directory.
- One primary purpose per document.
- Follow existing naming conventions.
- Keep files organized and modular.
- Avoid duplicate implementations.

### Naming Standards

Use consistent naming for:

- Files
- Directories
- Components
- Services
- Database Models
- API Routes
- Environment Variables

### Goal

Keep the repository easy to navigate for both engineers and AI assistants.

## 32. Logging & Observability

Every important operation should be observable.

### Log

- Errors
- Warnings
- Authentication Events
- AI Operations
- Telephony Events
- Background Jobs
- External Integrations

### Never Log

- Passwords
- API Keys
- Tokens
- Secrets
- Sensitive Personal Information

### Goal

Enable efficient debugging while protecting customer data.

## 33. Communication Principles

When generating code comments, documentation, or explanations:

Always be:

- Clear
- Concise
- Accurate
- Professional
- Consistent

Avoid:

- Ambiguous wording
- Unnecessary verbosity
- Contradicting documentation
- Unsupported assumptions

Communication should reduce confusion rather than introduce it.

## 34. Future Scalability

Every implementation should support future growth.

Design with consideration for:

- Additional customers
- Additional AI capabilities
- Increased call volume
- More integrations
- More developers
- Larger datasets

Do not optimize prematurely, but avoid architectural decisions that unnecessarily limit future expansion.

## 35. Continuous Improvement

The project should continuously improve over time.

Encourage improvements to:

- Architecture
- Documentation
- Testing
- Developer Experience
- Performance
- Security
- Maintainability

Improvements should preserve consistency with existing standards and documentation.

## 36. Maintenance Guidelines

This document should be reviewed whenever significant changes occur to:

- Product vision
- Architecture
- Technology stack
- Development workflow
- Documentation structure
- Coding standards

Whenever a new documentation file is introduced, update this document to reference it appropriately.

This file should remain concise, current, and authoritative.

## 37. AI Operating Principles

When working within this repository, prioritize the following order:

1. Understand the business problem.
2. Review the relevant documentation.
3. Respect the documented architecture.
4. Follow existing engineering patterns.
5. Produce maintainable implementations.
6. Validate correctness through testing.
7. Update documentation when behavior changes.

If uncertainty exists:

- Do not invent requirements.
- Do not contradict documented behavior.
- Surface ambiguity clearly.
- Prefer clarification over assumption.

The objective is to act as a disciplined engineering collaborator rather than an autonomous decision maker.

## 38j. Final Statement

CLAUDE.md is the operational guide for AI-assisted development within the RoofersLabs repository.

It defines how engineering decisions should be made, how documentation should be used, and how implementation should remain aligned with the project's architecture, coding standards, and long-term vision.

This document does not replace the specialized documentation contained in the `docs/` directory. Instead, it serves as the entry point that directs contributors to the appropriate source of truth for each aspect of the system.

Every contribution should aim to:

- Deliver business value.
- Preserve architectural integrity.
- Maintain code quality.
- Keep documentation synchronized.
- Protect security and reliability.
- Support the long-term evolution of the RoofersLabs platform.

If every contributor—human or AI—follows the guidance in this document, the project will remain consistent, maintainable, and scalable as it grows.
