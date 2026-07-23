# Frontend Architecture

> **Status: the UI layer described here has been removed.**
>
> The design system, theming, marketing site, and all feature page UIs were
> deleted ahead of a full product redesign. `apps/web` currently ships a
> deliberately minimal placeholder interface — stock Tailwind, no tokens, no
> component library — covering only landing, sign-in, sign-up, organization
> creation, payment, billing, dashboard, and settings.
>
> Everything below the UI layer is still accurate and still in force: routing,
> the API client and its response envelope, TanStack Query as the sole data
> layer, Zustand for session state, providers, forms and validation. Treat the
> component/design sections as the brief for the redesign, not a description of
> the current tree. See `14_Billing.md` for the payment wall the router enforces.

## 1. Document Information

### Purpose

This document defines the architecture, organization, and engineering standards of the RoofersLabs frontend application.

It serves as the primary reference for implementing pages, layouts, components, state management, routing, and user interactions.

---

### Scope

This document covers:

- Application architecture
- UI architecture
- Component architecture
- State management
- Routing
- Layouts
- API integration
- Performance
- Frontend engineering standards

---

### Out of Scope

The following topics are documented separately:

- Product Requirements
- Backend Architecture
- Database Design
- API Standards
- Security Architecture
- AWS Infrastructure

---

### Objectives

The frontend should:

- Deliver an intuitive user experience
- Maintain consistent interactions
- Support responsive design
- Encourage reusable components
- Scale efficiently
- Remain easy to maintain

---

### Audience

This document is intended for:

- Frontend Engineers
- Full-Stack Engineers
- UX Engineers
- Technical Leads
- AI Coding Assistants

---

### Ownership

This document is the authoritative reference for frontend architecture across the RoofersLabs platform.

## 2. Frontend Overview

### Overview

The frontend is the primary workspace used by roofing companies to manage customers, conversations, appointments, and business operations.

It presents business data through a consistent interface while coordinating communication with backend services.

---

### Core Responsibilities

The frontend manages:

- Authentication
- Dashboard
- Customer Management
- Call History
- Appointments
- Knowledge Base
- Notifications
- Search
- Settings
- Administration

---

### Design Goals

The frontend should:

- Be fast
- Be predictable
- Reduce user effort
- Maintain visual consistency
- Support desktop and mobile devices
- Integrate cleanly with backend services

---

### Success Criteria

Every user interaction should feel responsive, consistent, and intuitive.

## 3. Frontend Design Principles

### Core Principles

- Component-Driven Development
- Simplicity
- Consistency
- Responsive Design
- Accessibility
- Performance
- Reusability
- Separation of Concerns
- Maintainability

---

### Engineering Rules

The platform should ensure that:

- Components remain reusable.
- Business logic stays outside UI components.
- Interfaces remain consistent.
- User workflows remain predictable.
- Shared functionality is centralized.

---

### Success Criteria

Every frontend feature should align with these principles regardless of implementation details.

## 4. Frontend Architecture Overview

### Overview

The frontend is organized as a modular React application built from reusable pages, layouts, feature modules, and shared components.

Each layer has a clearly defined responsibility.

---

### Architecture Layers

- Pages
- Layouts
- Feature Modules
- Shared Components
- Design System
- State Management
- API Client
- Utility Services

---

### User Interaction Flow

1. User performs an action.
2. Component handles the interaction.
3. State updates.
4. API request is sent if required.
5. Response is received.
6. UI re-renders.
7. Feedback is displayed.

---

### Success Criteria

Presentation, business logic, and data access remain clearly separated.

## 5. Application Structure

### Overview

The application is organized around business capabilities rather than technical layers.

Each feature owns its pages, components, hooks, services, and supporting resources.

---

### Core Modules

- Authentication
- Dashboard
- Customers
- Calls
- Appointments
- Knowledge Base
- Notifications
- Search
- Settings
- Administration

---

### Rules

- One business capability per module.
- Keep modules independent.
- Centralize shared resources.
- Minimize cross-module dependencies.
- Follow consistent naming.

---

### Goal

Engineers should quickly locate everything related to a business feature.

## 6. Directory Structure

### Recommended Structure

```text
src/
├── app/
├── components/
├── features/
├── layouts/
├── hooks/
├── services/
├── state/
├── providers/
├── styles/
├── utils/
├── types/
├── constants/
└── config/
```

---

### Rules

- Organize by business domain.
- Keep related files together.
- Shared components belong in `components/`.
- Feature-specific code belongs inside its module.
- Avoid deeply nested folders.

---

### Goal

Provide a scalable and easily navigable project structure.

## 7. Module Architecture

### Overview

Each module represents a complete business capability and owns everything required to implement that feature.

---

### Module Contents

Each module may include:

- Pages
- Components
- Hooks
- Services
- Types
- Validation
- Constants
- Utilities

---

### Rules

- One business responsibility per module.
- Keep modules loosely coupled.
- Avoid circular dependencies.
- Share code only when broadly reusable.

---

### Goal

Modules should evolve independently without affecting unrelated features.

## 8. Component Architecture

### Overview

Components are the primary building blocks of the user interface.

Each component should solve one UI problem and remain reusable across multiple features whenever possible.

---

### Component Categories

- Layout Components
- Form Components
- Navigation Components
- Table Components
- Card Components
- Modal Components
- Feedback Components
- Dashboard Components
- Utility Components

---

### Rules

- Keep components small.
- Prefer composition.
- Separate business logic from presentation.
- Make components configurable.
- Minimize unnecessary re-renders.

---

### Goal

Build interfaces from reusable, predictable, and independently testable components.

## 9. Routing Architecture

### Overview

Routing defines how users navigate through the application and how pages are organized.

Routes should reflect business capabilities rather than implementation details.

---

### Primary Routes

- Authentication
- Dashboard
- Customers
- Calls
- Appointments
- Knowledge Base
- Notifications
- Search
- Settings
- Administration

---

### Rules

- Use meaningful URLs.
- Protect authenticated routes.
- Keep route hierarchy consistent.
- Lazy load feature routes where appropriate.
- Keep navigation predictable.

---

### Navigation Flow

1. User requests a route.
2. Authentication is verified.
3. Authorization is checked.
4. Required data is loaded.
5. Layout renders.
6. Page becomes interactive.

---

### Goal

Provide a fast, consistent, and scalable navigation experience.

## 10. Layout Architecture

### Overview

Layouts provide the structural framework for pages by defining shared interface elements such as navigation, headers, and content containers.

Pages should focus on business functionality while layouts manage the overall user experience.

---

### Layout Types

- Authentication Layout
- Main Application Layout
- Dashboard Layout
- Administration Layout
- Error Layout
- Full-Screen Layout

---

### Rules

- Keep layouts independent of business logic.
- Reuse layouts across multiple pages.
- Standardize navigation and spacing.
- Ensure responsive behavior.
- Keep page structure consistent.

---

### Goal

Provide a familiar and consistent experience across the application.

## 11. State Management Architecture

### Overview

State management coordinates how data is stored, updated, and shared throughout the application.

State should exist only where it is required and remain predictable.

---

### State Categories

- Local Component State
- Shared Application State
- Server State
- Persistent State
- Temporary UI State

---

### Managed Data

- Authentication
- User Profile
- Company Information
- Dashboard Data
- Customer Data
- Notifications
- Search
- Theme Preferences

---

### Rules

- Minimize duplicated state.
- Keep state centralized when shared.
- Separate UI state from server state.
- Keep business logic outside components.

---

### Goal

Maintain predictable data flow and efficient rendering.

## 12. API Communication

### Overview

Frontend components communicate with backend services through centralized API service layers.

Components should never perform direct network requests.

API behavior and standards are defined in **09_API_Standards.md**.

---

### Responsibilities

The API layer handles:

- Request Creation
- Authentication Headers
- Response Processing
- Error Handling
- Request Cancellation
- File Uploads

---

### Rules

- Centralize API requests.
- Reuse service functions.
- Handle errors consistently.
- Transform responses when needed.
- Keep networking outside UI components.

---

### Goal

Provide reliable and maintainable communication with backend services.

## 13. Authentication Flow

### Overview

The frontend manages the user authentication experience while delegating identity verification to backend services.

---

### Authentication Features

- Login
- Logout
- Session Creation
- Token Refresh
- Password Recovery
- Email Verification
- Session Validation

---

### Rules

- Keep authentication state centralized.
- Store tokens securely.
- Handle expired sessions gracefully.
- Redirect unauthorized users.
- Provide clear user feedback.

---

### Goal

Deliver a secure and seamless authentication experience.

## 14. Authorization & Route Protection

### Overview

Protected routes verify authentication and authorization before granting access to application features.

Authorization policies are enforced by the backend, while the frontend controls navigation.

---

### Protected Areas

- Dashboard
- Customers
- Company Settings
- Knowledge Base
- Administration
- Reports

---

### Rules

- Protect private routes.
- Hide unauthorized navigation.
- Check permissions before rendering.
- Redirect unauthorized users.
- Keep route guards reusable.

---

### Goal

Prevent unauthorized access while maintaining a smooth navigation experience.

## 15. User Session Management

### Overview

Session management maintains authenticated access while ensuring security and consistency across browser tabs and application reloads.

---

### Responsibilities

- Session Initialization
- Session Persistence
- Token Refresh
- Session Validation
- Secure Logout
- Multi-Tab Synchronization

---

### Rules

- Keep session state synchronized.
- Refresh tokens automatically.
- Remove invalid sessions immediately.
- Preserve user context when possible.

---

### Goal

Maintain secure and uninterrupted user sessions.

## 16. UI Component Library

### Overview

The UI component library contains reusable interface elements shared across the application.

Components should be configurable, documented, and independent of business logic.

---

### Component Library

- Buttons
- Inputs
- Dropdowns
- Tables
- Cards
- Modals
- Alerts
- Forms
- Navigation
- Loading Indicators
- Empty States

---

### Rules

- Reuse before creating new components.
- Maintain consistent APIs.
- Support accessibility.
- Follow the design system.
- Keep styling standardized.

---

### Goal

Build every interface from reusable components.

## 17. Design System

### Overview

The design system defines the visual language used throughout RoofersLabs.

Every component should derive its appearance from centralized design tokens.

---

### Design Elements

- Typography
- Colors
- Spacing
- Grid System
- Border Radius
- Shadows
- Icons
- Motion
- Interactive States

---

### Rules

- Maintain visual consistency.
- Reuse design tokens.
- Avoid hardcoded styles.
- Preserve brand identity.
- Keep interfaces predictable.

---

### Goal

Ensure a cohesive and professional user experience across the application.

## 18. Styling Architecture

### Overview

Styling defines how visual presentation is organized, maintained, and reused throughout the frontend.

Styles should remain modular and closely aligned with the design system.

---

### Styling Layers

- Global Styles
- Component Styles
- Layout Styles
- Utility Classes
- Theme Variables
- Animations

---

### Rules

- Keep styles modular.
- Minimize duplication.
- Use design tokens.
- Isolate component styling.
- Maintain responsive behavior.

---

### Goal

Create maintainable and scalable styling that remains consistent across the application.

## 19. Form Architecture

### Overview

Forms provide a consistent mechanism for collecting, validating, and submitting user input.

Form logic should remain reusable and independent of presentation.

---

### Form Features

- Input Validation
- Error Display
- Default Values
- Dynamic Fields
- File Uploads
- Submission Handling
- Reset Support

---

### Rules

- Validate on both client and server.
- Keep validation reusable.
- Display actionable error messages.
- Disable submission during processing.
- Preserve user input whenever possible.

---

### Goal

Deliver reliable and user-friendly form experiences.

## 20. Validation Strategy

### Overview

Validation improves user experience by identifying invalid input before submission while backend validation remains the authoritative source.

---

### Validation Types

- Required Fields
- Format Validation
- Length Validation
- Range Validation
- File Validation
- Business Rule Validation

---

### Rules

- Validate early.
- Keep rules consistent with backend.
- Display clear error messages.
- Prevent invalid submissions.
- Reuse validation logic.

---

### Goal

Reduce user errors while maintaining data integrity.

## 21. Search Architecture

### Overview

Search enables users to quickly locate customers, conversations, appointments, and other business records.

The interface should provide fast, accurate, and responsive search capabilities.

---

### Search Targets

- Customers
- Conversations
- Appointments
- Knowledge Base
- Notifications
- Users

---

### Rules

- Debounce user input.
- Support pagination.
- Display loading states.
- Handle empty results gracefully.
- Preserve search context.

---

### Goal

Enable efficient access to business information with minimal user effort.

## 22. Dashboard Architecture

### Overview

The dashboard provides a centralized overview of business activity and key operational metrics.

Widgets should remain modular and independently loadable.

---

### Dashboard Modules

- Activity Summary
- Recent Calls
- Upcoming Appointments
- Notifications
- AI Activity
- Business Metrics

---

### Rules

- Load data asynchronously.
- Keep widgets independent.
- Refresh data efficiently.
- Handle unavailable data gracefully.
- Support future dashboard customization.

---

### Goal

Provide actionable insights without overwhelming the user.

## 23. Data Fetching Strategy

### Overview

Data fetching should be centralized, predictable, and optimized for performance.

Components should request data through shared services or hooks rather than directly interacting with APIs.

---

### Fetching Principles

- Fetch only required data.
- Cache reusable responses.
- Avoid duplicate requests.
- Support request cancellation.
- Handle loading and error states consistently.

---

### Rules

- Keep fetching logic reusable.
- Separate server state from UI state.
- Retry transient failures when appropriate.
- Refresh stale data intelligently.

---

### Goal

Provide efficient, maintainable, and predictable data loading.

## 24. Error Handling

### Overview

The frontend should present errors clearly while preventing application failures from disrupting the user experience.

---

### Error Categories

- Validation Errors
- Network Errors
- Authentication Errors
- Authorization Errors
- Server Errors
- Unexpected Errors

---

### Rules

- Display user-friendly messages.
- Never expose internal details.
- Allow retry when appropriate.
- Log unexpected failures.
- Recover gracefully whenever possible.

---

### Goal

Maintain a stable user experience during failures.

## 25. Loading & Feedback States

### Overview

Visual feedback informs users that the application is processing requests or updating data.

Every asynchronous operation should communicate its current state.

---

### Feedback Components

- Loading Spinners
- Skeleton Screens
- Progress Indicators
- Success Messages
- Warning Messages
- Error Messages
- Empty States

---

### Rules

- Show immediate feedback.
- Avoid blocking the interface unnecessarily.
- Keep animations subtle.
- Maintain consistent messaging.

---

### Goal

Reduce uncertainty and improve perceived application responsiveness.

## 26. Notification Architecture

### Overview

Notifications communicate important system events, confirmations, warnings, and errors to users.

Presentation should remain consistent regardless of notification source.

---

### Notification Types

- Success
- Information
- Warning
- Error
- System Alerts

---

### Rules

- Display concise messages.
- Prioritize important notifications.
- Avoid repetitive alerts.
- Allow dismissal when appropriate.
- Preserve accessibility.

---

### Goal

Provide timely feedback without distracting users.

## 27. File Upload Architecture

### Overview

The frontend manages file selection, validation, upload progress, and user feedback while delegating storage to backend services.

---

### Supported Uploads

- Company Logos
- Images
- Documents
- Knowledge Base Files
- Attachments

---

### Rules

- Validate files before upload.
- Display upload progress.
- Support retry on failure.
- Restrict unsupported file types.
- Show clear success and error states.

---

### Goal

Provide a secure and intuitive file upload experience.

## 28. Responsive Design Strategy

### Overview

The interface should provide a consistent and usable experience across desktop, tablet, and mobile devices.

Layouts should adapt gracefully without compromising functionality.

---

### Supported Devices

- Desktop
- Laptop
- Tablet
- Mobile

---

### Rules

- Design mobile-first where practical.
- Use flexible layouts.
- Avoid horizontal scrolling.
- Optimize touch interactions.
- Maintain readable typography.

---

### Goal

Ensure every feature remains accessible and usable on supported devices.

## 30. Performance Optimization

### Overview

Frontend performance should be optimized to deliver fast loading times and smooth user interactions.

Optimization efforts should be based on measurable performance metrics.

---

### Optimization Areas

- Code Splitting
- Lazy Loading
- Image Optimization
- Memoization
- Virtualized Lists
- Asset Compression
- Efficient Rendering

---

### Rules

- Load only required resources.
- Avoid unnecessary re-renders.
- Optimize large lists.
- Compress static assets.
- Measure before optimizing.

---

### Goal

Provide a fast and responsive user experience under normal production workloads.

## 31. Frontend Security

### Overview

The frontend should protect user sessions, prevent common client-side vulnerabilities, and safely communicate with backend services.

Detailed security requirements are documented in **11_Security_Architecture.md**.

---

### Security Practices

- Secure Authentication
- Input Validation
- Output Escaping
- Secure Storage
- CSRF Protection
- XSS Prevention
- HTTPS Enforcement

---

### Rules

- Never store secrets in the frontend.
- Validate all user input.
- Escape dynamic content.
- Protect authenticated routes.
- Remove sensitive data from logs.

---

### Goal

Reduce client-side security risks while supporting secure application behavior.

## 32. Internationalization Strategy

### Overview

The frontend should support future localization without requiring major architectural changes.

Although the MVP targets English, the application should remain language-ready.

---

### Internationalization Scope

- UI Text
- Validation Messages
- Dates
- Times
- Numbers
- Currency
- Time Zones

---

### Rules

- Externalize user-facing text.
- Avoid hardcoded strings.
- Format locale-sensitive values.
- Keep translations centralized.

---

### Goal

Prepare the application for future multilingual support.

## 33. Frontend Testing

### Overview

Frontend features should be validated through automated testing to ensure reliability and prevent regressions.

Detailed testing practices are defined in **Testing_Strategy.md**.

---

### Testing Scope

- Component Tests
- Integration Tests
- UI Tests
- Accessibility Tests
- End-to-End Tests

---

### Rules

- Test critical workflows.
- Test reusable components.
- Verify user interactions.
- Keep tests deterministic.
- Automate execution.

---

### Goal

Maintain confidence in frontend behavior throughout development.

## 34. Technology Stack

### Core Technologies

| Component        | Technology      |
| ---------------- | --------------- |
| Framework        | React           |
| Language         | TypeScript      |
| Build Tool       | Vite            |
| Routing          | React Router    |
| State Management | Zustand         |
| Data Fetching    | TanStack Query  |
| Styling          | Tailwind CSS    |
| Forms            | React Hook Form |
| Validation       | Zod             |

---

### Selection Criteria

Technologies should be:

- Stable
- Well Supported
- Performant
- Production Proven
- Easy to Maintain

---

### Goal

Provide a modern, scalable foundation for frontend development.

## 35. Future Frontend Roadmap

### Phase 1 — MVP

- Authentication
- Dashboard
- Customer Management
- Call History
- Appointments
- Knowledge Base
- Notifications

---

### Phase 2 — Product-Market Fit

- Advanced Search
- Custom Dashboards
- Improved Analytics
- Better Mobile Experience
- Enhanced Accessibility

---

### Phase 3 — Scale

- Offline Support
- Progressive Web App Enhancements
- Multi-Language Support
- Advanced Personalization
- Real-Time Collaboration

---

### Goal

Allow the frontend to evolve without major architectural redesign.
