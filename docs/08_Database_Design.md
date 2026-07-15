# Database Design

## 1. Document Information

### Purpose

This document defines the database architecture, schema design, data organization, and engineering standards used throughout the RoofersLabs platform.

It serves as the authoritative reference for designing, storing, querying, and maintaining business data.

Unlike the Backend Architecture document, which explains how services interact with data, this document focuses exclusively on the design of the data layer.

---

### Scope

This document defines:

- Database architecture
- Schema organization
- Entity design
- Relationships
- Data modeling
- Indexing
- Transactions
- Migrations
- Performance optimization
- Database engineering standards

---

### Out of Scope

The following topics are documented separately:

- Product Requirements
- Backend Architecture
- API Standards
- Security Architecture
- AWS Infrastructure
- AI Receptionist Specification

---

### Objectives

The database should:

- Preserve data integrity
- Support multi-tenancy
- Scale efficiently
- Minimize redundancy
- Maintain high performance
- Simplify future expansion

---

### Audience

This document is intended for:

- Backend Engineers
- Database Engineers
- Platform Engineers
- Solution Architects
- AI Coding Assistants

---

### Ownership

This document is the authoritative engineering reference for database design across the RoofersLabs platform.

## 2. Database Overview

### Overview

The database serves as the single source of truth for all persistent business information within RoofersLabs.

It stores customer information, AI conversations, appointments, company configuration, operational history, and supporting business data.

Every business entity should exist in exactly one authoritative location while remaining accessible through clearly defined relationships.

---

### Core Data Domains

The database stores:

- Companies
- Users
- Customers
- AI Conversations
- Appointments
- Knowledge Base
- Notifications
- Phone Numbers
- Call Records
- System Configuration

---

### Design Goals

The database should:

- Maintain consistency
- Prevent duplication
- Support efficient querying
- Preserve historical information
- Remain easy to maintain
- Scale predictably

---

### Success Criteria

The database should provide a reliable and consistent foundation for every backend service.

## 3. Database Design Principles

### Core Principles

Every database decision should follow these principles:

- Single Source of Truth
- Data Integrity
- Multi-Tenant Isolation
- Normalization by Default
- Explicit Relationships
- Security by Design
- Scalability
- Maintainability
- Auditability
- Consistency

---

### Engineering Rules

The platform should ensure that:

- Business entities remain independent.
- Duplicate data is minimized.
- Constraints enforce correctness.
- Relationships remain explicit.
- Schema evolution remains manageable.
- Performance is considered during design.

---

### Success Criteria

Database structures should remain understandable, scalable, and resilient throughout the platform lifecycle.

## 4. Database Architecture Overview

### Overview

The database is organized around business domains rather than technical implementation.

Each domain owns a set of related entities that model a specific business capability.

---

### Business Domains

- Companies
- Users
- Customers
- AI Conversations
- Appointments
- Knowledge Base
- Notifications
- Telephony
- Authentication
- Configuration

---

### Data Processing Flow

1. Request Validated
2. Business Rules Evaluated
3. Transaction Started
4. Data Created or Updated
5. Relationships Maintained
6. Transaction Committed

---

### Success Criteria

Each business domain should remain modular while maintaining well-defined relationships with other domains.

## 5. Data Modeling Standards

### Rules

Every entity should represent one real business concept.

---

### Guidelines

- One responsibility per entity.
- Keep entities normalized.
- Minimize duplicate data.
- Keep relationships explicit.
- Store only relevant attributes.
- Prefer composition over duplication.

---

### Entity Characteristics

Entities should be:

- Stable
- Extendable
- Predictable
- Business-oriented
- Independent

---

### Avoid

- Generic tables
- Duplicate business information
- Implicit relationships
- Mixed responsibilities

---

### Goal

The data model should accurately represent the business while remaining easy to evolve.

## 6. Multi-Tenant Architecture

### Overview

RoofersLabs operates as a multi-tenant SaaS platform where every company's data remains completely isolated.

Tenant isolation is enforced at both the application and database levels.

---

### Tenant-Owned Data

Every company owns:

- Users
- Customers
- Conversations
- Appointments
- Knowledge Base
- Notifications
- Phone Numbers
- Configuration

---

### Rules

The platform should ensure that:

- Every record belongs to one company.
- Cross-tenant access is impossible.
- Queries remain tenant-aware.
- Ownership is explicit.
- Relationships remain tenant-scoped.

---

### Success Criteria

Thousands of companies should safely share infrastructure without exposing each other's data.

## 7. Schema Organization

### Overview

Database tables are organized by business domains rather than technical implementation.

Each domain owns its related entities, relationships, and constraints.

---

### Business Schemas

- Companies
- Users
- Customers
- Conversations
- Appointments
- Knowledge
- Notifications
- Telephony
- Authentication
- Configuration

---

### Rules

- Keep related tables together.
- Maintain clear ownership.
- Minimize cross-domain dependencies.
- Use consistent naming.
- Keep schemas modular.

---

### Goal

Database organization should simplify maintenance and future expansion.

## 8. Entity Relationship Strategy

### Overview

Relationships define how business entities interact while preserving referential integrity.

Business ownership should always be represented through explicit relationships rather than duplicated information.

---

### Primary Relationships

- Company → Users
- Company → Customers
- Company → Knowledge Base
- Customer → Conversations
- Customer → Appointments
- Conversation → Transcript
- Conversation → Summary
- User → Notifications

---

### Rules

The platform should ensure that:

- Relationships remain explicit.
- Foreign keys enforce integrity.
- Orphaned records are prevented.
- Cascading operations are controlled.

---

### Goal

Relationships should accurately model business dependencies while minimizing redundancy.

## 9. Primary & Foreign Key Standards

### Primary Keys

Every table must have one immutable primary key.

Primary keys should:

- Be globally unique.
- Never change.
- Remain independent of business logic.
- Support distributed systems.

---

### Foreign Keys

Foreign keys define ownership and relationships.

They should:

- Preserve referential integrity.
- Prevent orphaned records.
- Reflect real business relationships.
- Support cascading rules where appropriate.

---

### Rules

The platform should ensure that:

- Every relationship references primary keys.
- Business identifiers are never used as primary keys.
- Constraints remain consistent.
- Relationships remain understandable.

---

### Goal

Keys should provide stable identification while preserving structural integrity throughout the database.

## 10. Core Business Entities

### Overview

Each entity represents a single business concept and owns its corresponding data, relationships, and constraints.

---

### Core Entities

The platform manages:

- Company
- User
- Customer
- Conversation
- Call
- Appointment
- Knowledge Article
- Notification
- Phone Number
- Settings
- Transcript
- Summary

---

### Rules

- One responsibility per entity.
- Keep entities independent.
- Maintain explicit relationships.
- Support future expansion.
- Preserve business ownership.

---

### Goal

Every business concept should have one authoritative representation within the database.

## 11. Customer Data Model

### Overview

The Customer entity represents homeowners and businesses interacting with a roofing company.

Customer records act as the central reference for conversations, appointments, and service history.

---

### Stored Information

Customer records include:

- Personal Information
- Contact Details
- Property Information
- Service History
- Appointment History
- Conversation History
- Notes
- Preferences
- Status

---

### Rules

The platform should ensure that:

- Duplicate customers are minimized.
- Contact information remains current.
- Historical relationships are preserved.
- Customer ownership remains explicit.

---

### Goal

Provide a complete customer profile throughout the customer lifecycle.

## 12. Company Data Model

### Overview

The Company entity is the root of the multi-tenant architecture.

Nearly every business record ultimately belongs to one company.

---

### Stored Information

Company records include:

- Business Details
- Contact Information
- Service Areas
- Business Hours
- Phone Numbers
- Branding
- AI Configuration
- Subscription Details
- Company Settings

---

### Rules

The platform should ensure that:

- Company ownership remains explicit.
- Configuration is centralized.
- Tenant isolation is preserved.
- Relationships remain consistent.

---

### Goal

Provide a stable organizational foundation for every tenant.

## 13. User Data Model

### Overview

Users represent authenticated individuals operating on behalf of a company.

Each user belongs to exactly one tenant.

---

### Stored Information

User records include:

- Profile Information
- Contact Details
- Role
- Permissions
- Preferences
- Notification Settings
- Account Status
- Activity History

---

### Rules

The platform should ensure that:

- Users belong to one company.
- Permissions remain role-based.
- User history is preserved.
- Security remains independent of profile data.

---

### Goal

Support secure and scalable user management.

## 14. Conversation Data Model

### Overview

Conversation records capture every interaction between customers and the AI Receptionist.

Conversation content remains linked to customers, calls, summaries, and business outcomes.

---

### Stored Information

Conversation records include:

- Customer Reference
- Company Reference
- Transcript
- Summary
- Intent
- Extracted Entities
- Structured Output
- Status
- Outcome

---

### Rules

The platform should ensure that:

- Conversations remain searchable.
- Context is preserved.
- AI metadata remains available.
- Customer relationships remain intact.

---

### Goal

Create a complete historical record of every customer interaction.

## 15. Knowledge Base Data Model

### Overview

Knowledge Articles provide company-specific information used by the AI Receptionist.

Each article belongs exclusively to one company.

---

### Stored Information

Knowledge articles include:

- Title
- Content
- Category
- Keywords
- Status
- Version
- Author
- Last Updated
- Retrieval Metadata

---

### Rules

The platform should ensure that:

- Articles remain searchable.
- Version history is preserved.
- Ownership remains explicit.
- AI retrieval remains efficient.

---

### Goal

Provide accurate and maintainable knowledge for AI responses.

## 16. Appointment Data Model

### Overview

Appointments represent customer scheduling requests generated through conversations.

Appointments remain linked to customers, companies, and conversations.

---

### Stored Information

Appointment records include:

- Customer Reference
- Company Reference
- Service Requested
- Property Address
- Preferred Date
- Preferred Time
- Status
- Priority
- Notes

---

### Rules

The platform should ensure that:

- Appointment history is preserved.
- Scheduling information remains accurate.
- Business workflows remain supported.
- Future calendar integrations remain possible.

---

### Goal

Convert scheduling requests into structured business records.

## 17. Notification Data Model

### Overview

Notifications inform users about important business events occurring throughout the platform.

Notification records remain linked to their originating business entities.

---

### Stored Information

Notifications include:

- Type
- Title
- Message
- Priority
- Status
- Recipient
- Delivery Channel
- Related Entity
- Read Status
- Created Timestamp

---

### Rules

The platform should ensure that:

- Duplicate notifications are minimized.
- Delivery status is tracked.
- User preferences are respected.
- Notification history is preserved.

---

### Goal

Provide reliable and traceable user notifications.

## 18. Authentication & Authorization Data

### Overview

Authentication and authorization data support secure platform access while remaining separate from business entities.

Detailed security policies are defined in **11_Security_Architecture.md**.

---

### Authentication Data

- User Reference
- Login Provider
- Password Metadata
- MFA Configuration
- Session Information
- Login History

---

### Authorization Data

- Roles
- Permissions
- Company Ownership
- Access Policies
- Feature Access

---

### Rules

The platform should ensure that:

- Identity remains protected.
- Permissions remain centralized.
- Sessions remain traceable.
- Access decisions remain auditable.

---

### Goal

Provide secure identity management while maintaining clear separation between authentication and business data.

## 19. Data Integrity Standards

### Overview

Data integrity ensures that all stored information remains accurate, complete, and internally consistent throughout its lifecycle.

Integrity should be enforced primarily by the database, with additional validation performed by the application.

---

### Integrity Mechanisms

The database uses:

- Primary Keys
- Foreign Keys
- Unique Constraints
- NOT NULL Constraints
- CHECK Constraints
- Transactions

---

### Rules

The platform should ensure that:

- Every record is uniquely identifiable.
- Invalid relationships cannot exist.
- Duplicate business records are prevented where appropriate.
- Constraints enforce business rules.
- Manual data modification is minimized.

---

### Goal

Maintain accurate and trustworthy data regardless of application failures.

## 20. Normalization Strategy

### Overview

The database follows normalization principles to minimize redundancy while maintaining efficient query performance.

Denormalization should be introduced only when supported by measurable performance requirements.

---

### Standards

- Normalize to Third Normal Form (3NF) by default.
- Eliminate duplicate business data.
- Store each fact in one location.
- Use foreign keys instead of repeated values.
- Denormalize only with documented justification.

---

### Avoid

- Duplicate columns
- Repeated business information
- Circular dependencies
- Unnecessary denormalization

---

### Goal

Maintain a schema that is both consistent and efficient.

## 21. Indexing Strategy

### Overview

Indexes improve query performance by reducing the amount of data scanned during database operations.

Indexes should support common query patterns without introducing unnecessary write overhead.

---

### Index Candidates

Create indexes for:

- Primary Keys
- Foreign Keys
- Frequently Filtered Columns
- Frequently Sorted Columns
- Search Fields
- Unique Constraints

---

### Rules

- Index frequently queried columns.
- Remove unused indexes.
- Monitor index usage.
- Avoid duplicate indexes.
- Review indexing after schema changes.

---

### Goal

Provide fast query execution while maintaining efficient write performance.

## 22. Query Optimization

### Rules

Queries should retrieve only the data required by the application.

---

### Best Practices

- Select required columns only.
- Use pagination for large datasets.
- Filter as early as possible.
- Minimize joins where practical.
- Prefer indexed lookups.
- Batch related operations when appropriate.

---

### Avoid

- `SELECT *`
- N+1 query patterns
- Unbounded result sets
- Repeated identical queries
- Unnecessary database round trips

---

### Goal

Deliver predictable query performance under production workloads.

## 23. Transaction Strategy

### Overview

Transactions guarantee that related operations either complete successfully together or are rolled back entirely.

---

### Use Transactions For

- Customer Creation
- Appointment Scheduling
- Call Processing
- AI Conversation Storage
- Multi-Table Updates

---

### Rules

- Keep transactions short.
- Avoid long-running operations.
- Roll back on failure.
- Maintain ACID guarantees.
- Prevent deadlocks where possible.

---

### Goal

Protect business data from partial updates and inconsistencies.

## 24. Soft Delete Strategy

### Overview

Business records should generally be retained rather than permanently removed.

Soft deletes preserve historical data while preventing deleted records from appearing in normal application workflows.

---

### Suitable Entities

- Customers
- Users
- Knowledge Articles
- Appointments
- Notifications

---

### Rules

- Record deletion timestamps.
- Preserve relationships.
- Exclude deleted records from default queries.
- Permanently delete only when legally or operationally required.

---

### Goal

Maintain historical data while supporting recovery and auditing.

## 25. Audit Trail Strategy

### Overview

Critical business actions should be traceable through audit records.

Audit data supports debugging, compliance, operational analysis, and accountability.

---

### Audit Events

Track:

- Record Creation
- Record Updates
- Record Deletion
- Login Events
- Permission Changes
- Configuration Changes
- Administrative Actions

---

### Rules

Audit records should include:

- Timestamp
- Actor
- Entity
- Action
- Previous Value (where applicable)
- New Value (where applicable)

---

### Goal

Provide complete visibility into significant business operations.

## 26. Migration Strategy

### Overview

Database schema changes should be applied through version-controlled migrations.

Every schema modification must be repeatable and reversible whenever practical.

---

### Migration Rules

- One logical change per migration.
- Review before deployment.
- Test in non-production environments.
- Preserve existing data.
- Maintain backward compatibility where possible.

---

### Avoid

- Manual production changes
- Untracked schema updates
- Destructive migrations without backups

---

### Goal

Ensure consistent schema evolution across all environments.

## 27. Backup & Recovery

### Overview

Regular backups protect business data against accidental loss, corruption, and infrastructure failures.

AWS implementation details are documented in **12_AWS_Infrastructure.md**.

---

### Backup Scope

Protect:

- Business Data
- User Data
- Customer Data
- Configuration
- AI Metadata
- Knowledge Base
- Migration History

---

### Rules

- Automate backups.
- Verify backup integrity.
- Test restoration procedures.
- Define retention policies.
- Document recovery procedures.

---

### Goal

Enable reliable restoration of critical business data while minimizing downtime.

## 28. Database Security

### Overview

The database should protect sensitive business information through access controls, encryption, and least-privilege principles.

Platform-wide security policies are defined in **11_Security_Architecture.md**.

---

### Security Measures

- Authentication
- Role-Based Access
- Encryption at Rest
- Encryption in Transit
- Audit Logging
- Backup Protection
- Connection Security

---

### Rules

- Grant minimum required privileges.
- Encrypt sensitive data.
- Rotate credentials regularly.
- Restrict direct database access.
- Audit privileged operations.

---

### Goal

Protect customer and business data against unauthorized access.

## 30. Connection Management

### Overview

Database connections are a limited resource and should be managed efficiently.

Applications should reuse connections through pooling rather than creating new connections for every request.

---

### Rules

- Use connection pooling.
- Close unused connections.
- Configure pool limits.
- Monitor connection usage.
- Retry transient failures appropriately.

---

### Avoid

- Connection leaks
- Unlimited pools
- Long-lived idle connections
- Manual connection management

---

### Goal

Provide efficient and reliable database connectivity.

## 31. Data Retention Policy

### Overview

Different categories of data require different retention periods based on business, operational, and legal requirements.

---

### Retention Categories

- Customer Records
- AI Conversations
- Call History
- Notifications
- Audit Logs
- System Logs
- Backups

---

### Rules

- Define retention periods.
- Archive historical data where appropriate.
- Remove obsolete records securely.
- Preserve legally required information.

---

### Goal

Balance operational efficiency with historical record preservation.

## 32. Archiving Strategy

### Overview

Historical records that are no longer actively used should be archived to reduce database size and improve performance.

---

### Archive Candidates

- Completed Appointments
- Historical Conversations
- Old Notifications
- Inactive Customers
- Legacy Reports

---

### Rules

- Preserve referential integrity.
- Maintain searchability when required.
- Support restoration.
- Archive without affecting active workloads.

---

### Goal

Improve operational performance while preserving historical information.

## 33. Scalability Strategy

### Overview

The database should support increasing customer volume without requiring fundamental schema redesign.

---

### Scalability Techniques

- Efficient Indexing
- Read Optimization
- Connection Pooling
- Query Optimization
- Horizontal Read Scaling (Future)
- Table Partitioning (Future)

---

### Rules

- Design for growth.
- Monitor capacity.
- Minimize contention.
- Optimize before scaling infrastructure.

---

### Goal

Support long-term platform growth with predictable performance.

## 34. Technology Stack

### Core Technologies

| Component      | Technology                |
| -------------- | ------------------------- |
| Database       | PostgreSQL                |
| ORM            | Prisma                    |
| Migration Tool | Prisma Migrate            |
| Cache          | Redis                     |
| Backup         | AWS RDS Automated Backups |

---

### Selection Criteria

Technologies should be:

- Stable
- Production Proven
- Secure
- Well Supported
- Scalable

---

### Goal

Provide a reliable and maintainable foundation for persistent data storage.

## 35. Future Database Roadmap

### Phase 1 — MVP

- PostgreSQL
- Prisma ORM
- Multi-Tenant Schema
- Core Business Entities
- Automated Migrations

---

### Phase 2 — Product-Market Fit

- Improved Query Optimization
- Advanced Reporting
- Enhanced Auditing
- Better Search

---

### Phase 3 — Scale

- Table Partitioning
- Read Replicas
- Cross-Region Replication
- Advanced Analytics
- Data Warehousing

---

### Goal

Allow the database architecture to evolve incrementally while maintaining compatibility.

## 36. Appendix

### Related Documentation

This document should be used with:

- `02_System_Architecture.md`
- `03_Backend_Architecture.md`
- `05_AI_Receptionist_Specification.md`
- `09_API_Standards.md`
- `11_Security_Architecture.md`
- `12_AWS_Infrastructure.md`

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

- Database schema
- Entity relationships
- Migrations
- Storage strategy
- Performance optimization
- Security model

This document serves as the authoritative reference for all database design decisions within the RoofersLabs platform.
