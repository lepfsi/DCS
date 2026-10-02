# DailyOps Document Control System

## Detailed Wireframes Specification

**Version:** 0.1\
**Date:** 01 October 2026\
**Status:** Wireframe foundation\
**Scope:** Internal application UI/UX

------------------------------------------------------------------------

## 1. Purpose

This document translates the DCS Project Foundation into a functional
wireframe specification.

The wireframes define the application structure, navigation, information
architecture, primary actions, document lifecycle interactions,
business-record context, workflow interactions, evidence and audit
surfaces, template management, and administrative controls.

This is a functional wireframe specification, not a visual design
system.

The interface must feel **premium, restrained, operational,
information-dense without being crowded, highly legible and
consistent**.

It must not resemble a generic CRM, ERP, marketing dashboard, or
AI-generated card wall.

------------------------------------------------------------------------

## 2. Product Mental Model

The DCS revolves around five pillars:

``` text
                 DAILYOPS DOCUMENT CONTROL SYSTEM

        ┌──────────────┐      ┌──────────────┐
        │   DOCUMENT   │      │   WORKFLOW   │
        │    ENGINE    │──────│    ENGINE    │
        └──────┬───────┘      └──────┬───────┘
               │                     │
               └──────────┬──────────┘
                          ▼
                ┌─────────────────────┐
                │   DOCUMENT INBOX    │
                └──────────┬──────────┘
                           ▼
                ┌─────────────────────┐
                │  RECORD & EVIDENCE  │
                └──────────┬──────────┘
                           ▼
                ┌─────────────────────┐
                │    BUSINESS DATA    │
                └─────────────────────┘
```

Core principle:

> A document is an operational object. A record provides its business
> context.

------------------------------------------------------------------------

## 3. Global Application Shell

### Desktop

``` text
┌───────────────────────────────────────────────────────────────────────┐
│ DailyOps        Global Search                         Bell   User ▾   │
├────────────────┬──────────────────────────────────────────────────────┤
│ Overview       │                                                      │
│ Inbox          │                  APPLICATION CONTENT                 │
│ Documents      │                                                      │
│ Records        │                                                      │
│ Templates      │                                                      │
│                │                                                      │
│ Administration │                                                      │
└────────────────┴──────────────────────────────────────────────────────┘
```

### Primary navigation

  Section          Purpose
  ---------------- ------------------------------------------
  Overview         Personal operational starting point
  Inbox            Actions requiring attention
  Documents        Controlled document inventory
  Records          Business context and relationships
  Templates        Controlled document definitions
  Administration   Configuration, users, roles and policies

### Global header

-   Global search
-   Keyboard shortcut
-   Notifications
-   Current user
-   User menu

Search covers document reference/title, customer, person, employee,
project, service, product, transaction and template.

------------------------------------------------------------------------

## 4. Visual Direction

The previous dashboard explorations establish a critical direction:

> **The DCS should feel premium through hierarchy, typography, spacing
> and restraint, not through color.**

### Use color for

-   status
-   alerts
-   selected state
-   critical actions
-   DailyOps accent

### Avoid

-   one color per document type
-   rainbow category systems
-   decorative colored cards
-   large gradients
-   excessive colored icons
-   identical cards everywhere

### Preferred visual language

-   deep DailyOps navy
-   white
-   very light neutral surfaces
-   graphite text
-   restrained turquoise accent
-   muted status colors
-   thin borders
-   subtle shadows
-   strong typography
-   generous whitespace

------------------------------------------------------------------------

# 5. Screen Inventory

### Core

1.  Application Shell
2.  Overview
3.  Document Inbox
4.  Documents
5.  Document Workspace

### Creation

6.  Create Document
7.  Document Type Selection
8.  Dynamic Document Builder
9.  Document Preview
10. Generate / Issue

### Workflow

11. Review Workspace
12. Approval Workspace
13. Signature Workspace
14. Version History
15. Audit Trail

### Records

16. Records
17. Customer Record
18. Employee Record
19. Project Record
20. Transaction Record
21. Relationship View

### Templates

22. Template Library
23. Template Editor
24. Template Version History

### Administration

25. Workflow Configuration
26. Roles & Permissions
27. Document Numbering
28. Document Type Configuration
29. Retention & Archival
30. System Activity

------------------------------------------------------------------------

# 6. SCREEN 01 --- Application Shell

## Purpose

Provide a stable environment around every module.

``` text
┌───────────────────────────────────────────────────────────────────────┐
│ DailyOps     Search documents, records, people...       🔔  User ▾   │
├────────────────┬──────────────────────────────────────────────────────┤
│ Overview       │                                                      │
│ Inbox          │                  CONTENT AREA                        │
│ Documents      │                                                      │
│ Records        │                                                      │
│ Templates      │                                                      │
│                │                                                      │
│ Administration │                                                      │
└────────────────┴──────────────────────────────────────────────────────┘
```

### Rules

-   Sidebar is **fixed** and always visible: it is the primary
    orientation device. It never scrolls away with the content.
-   Current module is clearly identified.
-   No marketing navigation.
-   No DailyOps public website navigation.
-   Content area owns most of the screen.
-   Search remains globally available.

------------------------------------------------------------------------

# 7. SCREEN 02 --- Overview

## Purpose

Answer:

> **What requires my attention?**

This is an operational dashboard, not an analytics dashboard.

``` text
┌───────────────────────────────────────────────────────────────────────┐
│ Good afternoon.                                                       │
│ Here's what needs your attention today.                               │
│                                                                       │
│  03 To Review    02 To Approve    01 To Sign    01 Expiring          │
│                                                                       │
│ ┌───────────────────────────────┐ ┌────────────────────────────────┐ │
│ │ Recent Activity               │ │ Attention / Deadlines           │ │
│ │ Proposal       In Review      │ │ Contract renewal   3 days      │ │
│ │ Certificate   Issued          │ │ Certificate        7 days      │ │
│ │ Invoice        Sent           │ │ Invoice            15 days     │ │
│ └───────────────────────────────┘ └────────────────────────────────┘ │
│                                                                       │
│ Recent Documents                                                      │
│ Reference | Type | Status | Updated | Owner                           │
└───────────────────────────────────────────────────────────────────────┘
```

### Primary actions

-   Open Inbox
-   Create Document
-   Open document
-   Search
-   View expiring documents

### Dashboard density rules

The dashboard must stay clean. No panel is unlimited:

-   **Recent Activity**, **Attention / Deadlines** and **Recent Documents**
    each show a small fixed cap (5 items by default).
-   The full lists remain one click away via an explicit **View all**
    link on each panel (Inbox, System Activity, Documents).
-   The Overview never scrolls through raw inventory; it surfaces what
    requires attention and delegates depth to the dedicated screens.

### Avoid

-   revenue charts
-   sales funnels
-   generic KPI walls
-   decorative analytics
-   unlimited feeds or tables on the dashboard

------------------------------------------------------------------------

# 8. SCREEN 03 --- Document Inbox

## Purpose

The Inbox is the operational command center.

It answers:

-   What requires action?
-   What action?
-   Why?
-   By when?
-   What changed?

``` text
┌───────────────────────────────────────────────────────────────────────┐
│ Document Inbox                                                        │
│ Your actions keep the business moving.                                │
│                                                                       │
│ To Review 3 | To Approve 2 | To Sign 1 | Expiring 1 | Exceptions 0  │
│                                                                       │
│ All | To Review | To Approve | To Sign | Expiring | Exceptions       │
│                                                                       │
│ Search | Type | Domain | Priority | Due Date          Sort ▾          │
├───────────────────────────────────────────────┬───────────────────────┤
│ DOCUMENT QUEUE                                │ SELECTED ITEM         │
│                                               │                       │
│ Proposal — Acme Ltd                           │ Proposal — Acme Ltd   │
│ DO-BIZ-2026-0047                              │ DO-BIZ-2026-0047      │
│ Review required · Due today                   │                       │
│                                               │ Status                │
│ Service Contract — Global Systems             │ To Review             │
│ Approval required · Due today                 │                       │
│                                               │ Version 1.3           │
│ Invoice — Zenith Solutions                    │                       │
│ Review required · Tomorrow                    │ Changes                │
│                                               │ Scope expanded        │
│ ...                                           │ Amount changed        │
│                                               │                       │
│                                               │ [Start Review]        │
└───────────────────────────────────────────────┴───────────────────────┘
```

### Queue types

-   All
-   To Review
-   To Approve
-   To Sign
-   Expiring
-   Exceptions
-   Completed

The Inbox always opens on **All** by default: the user sees everything
requiring attention first, then narrows down by queue if needed.

### Queue row

Each item exposes:

-   document
-   reference
-   document type
-   domain
-   required action
-   priority
-   deadline
-   current status
-   owner
-   last change

### Selected-item panel

Shows:

-   identity
-   action required
-   deadline
-   current version
-   reason for action
-   recent changes
-   workflow state
-   related records
-   primary action

------------------------------------------------------------------------

# 9. SCREEN 04 --- Documents

## Purpose

Provide controlled inventory of all documents.

``` text
┌───────────────────────────────────────────────────────────────────────┐
│ DOCUMENTS                                                             │
│ Create, manage and track company documents.                           │
│                                                                       │
│ 248 Documents | 23 In Progress | 12 Awaiting Approval | 8 Expiring   │
│                                                                       │
│ Search documents...     Filters ▾       Sort ▾       + Create          │
├───────────────────────────────────────────────────────────┬───────────┤
│ Reference | Title | Type | Domain | Status | Owner | Date │ Filters   │
│ ────────────────────────────────────────────────────────── │           │
│ DO-BIZ... | Proposal | Proposal | Business | Review      │ Type      │
│ DO-LEG... | Contract | Contract | Legal | Issued         │ Domain    │
│ DO-FIN... | Invoice | Invoice | Finance | Sent           │ Status    │
│ DO-CER... | Certificate | Certificate | HR | Issued      │ Owner     │
│ ...                                                        │ Date      │
└───────────────────────────────────────────────────────────┴───────────┘
```

### Controls

-   Search
-   Filters
-   Sort
-   Create Document
-   Bulk selection
-   Export where authorized
-   Pagination

### Pagination rule

Inventory lists are never unlimited. Documents, Records and Templates
are paginated in fixed blocks: **10 / 20 / 50 / 100 per page**
(user-selectable, default 20). Changing a filter or sort resets the
list to the first page.

### Primary representation

The primary representation is the **table**, not a grid of colored
cards.

------------------------------------------------------------------------

# 10. SCREEN 05 --- Document Workspace

## Purpose

Central workspace for one document.

``` text
┌───────────────────────────────────────────────────────────────────────┐
│ ← Documents                                                           │
│ PROPOSAL                                                               │
│ DO-BIZ-2026-0047                                                      │
│ ● IN REVIEW                                                            │
│                                                                       │
│ [Edit] [Review] [Approve] [Generate]                                  │
├───────────────────────────────────────┬───────────────────────────────┤
│                                       │ CONTROL                       │
│         DOCUMENT PREVIEW              │ Status: In Review             │
│                                       │ Version: 1.3                  │
│         A4 / PDF preview              │ Owner: Steve                  │
│                                       │ Pending: Review               │
│                                       │ Customer: Acme Ltd             │
│                                       │ Project: Infrastructure       │
├───────────────────────────────────────┴───────────────────────────────┤
│ Related Records                                                        │
│ Customer | Project | Service | Contract                                │
├───────────────────────────────────────────────────────────────────────┤
│ History                                                                │
│ Versions | Reviews | Approvals | Signatures | Audit                    │
└───────────────────────────────────────────────────────────────────────┘
```

The document preview is only one part of the screen. Its operational
context must remain visible.

------------------------------------------------------------------------

# 11. SCREEN 06 --- Create Document

``` text
CREATE DOCUMENT

What do you want to create?

Official
Business
Legal / Formal
Certificate
HR
Finance
```

### Entry points

-   Overview
-   Documents
-   Inbox
-   Customer record
-   Project record
-   Template Library

The system then narrows available document types.

------------------------------------------------------------------------

# 12. SCREEN 07 --- Document Type Selection

``` text
CREATE DOCUMENT

BUSINESS

Proposal
Commercial proposal for a customer or project

Quotation
Pricing document

Service Report
Report documenting delivered work

Invoice
Financial document for a completed or contracted service

SOW
Defined scope of work

...

Selected:
[ Proposal ]

[ Continue ]
```

After selection the system loads:

1.  document schema
2.  approved template
3.  default workflow
4.  required fields
5.  related-record context
6.  numbering rules

------------------------------------------------------------------------

# 13. SCREEN 08 --- Dynamic Document Builder

The Builder creates structured documents without forcing users to
manually format them.

``` text
┌───────────────┬──────────────────────────────┬───────────────────┐
│ SECTIONS      │ LIVE DOCUMENT               │ PROPERTIES        │
│               │                              │                   │
│ 01 Cover      │ Proposal                     │ Title             │
│ 02 Context    │ Acme Ltd                     │ Customer          │
│ 03 Scope      │                              │ Project           │
│ 04 Deliverables│ ...                         │ Currency          │
│ 05 Pricing    │                              │ Validity          │
│ 06 Terms      │                              │ Payment Terms     │
│ 07 Signature  │                              │                   │
└───────────────┴──────────────────────────────┴───────────────────┘
```

### Responsibilities

-   field population
-   structured sections
-   template rules
-   conditional sections
-   calculations
-   references
-   related records
-   validation
-   revision

### Explicitly not

-   Canva clone
-   free-form design editor
-   page-layout application

------------------------------------------------------------------------

# 14. SCREEN 09 --- Document Preview

``` text
┌───────────────────────────────────────────────────────────────────────┐
│ PREVIEW                                                               │
│ Proposal — Acme Ltd                                                   │
│ DO-BIZ-2026-0047 · Draft v1.3                                         │
│                                                                       │
│ [Desktop Preview] [Page View] [Download Preview]                      │
│                                                                       │
│              ┌────────────────────────────┐                           │
│              │                            │                           │
│              │        A4 DOCUMENT         │                           │
│              │                            │                           │
│              └────────────────────────────┘                           │
│                                                                       │
│ Validation: ✓ Required fields complete                                │
│            ✓ Pricing validated                                        │
│            ✓ Template version current                                 │
│                                                                       │
│ [Back to Edit]                         [Generate Document]             │
└───────────────────────────────────────────────────────────────────────┘
```

------------------------------------------------------------------------

# 15. SCREEN 10 --- Generate / Issue

Generation is a controlled state transition.

``` text
GENERATE DOCUMENT

Document
DO-BIZ-2026-0047

Version
1.3

Template
Business Proposal v2.0

Workflow
Review → Approval → Signature → Issue

Output
PDF

[Cancel]                     [Generate]
```

After generation:

``` text
DOCUMENT GENERATED

Reference: DO-BIZ-2026-0047
Version: 1.3
Status: In Review

Next action:
Technical Review

[Open Document] [Go to Inbox]
```

------------------------------------------------------------------------

# 16. SCREEN 11 --- Review Workspace

``` text
┌───────────────────────────────────────────────────────────────────────┐
│ REVIEW · DO-BIZ-2026-0047                                             │
├───────────────────────────────────────┬───────────────────────────────┤
│ DOCUMENT                              │ REVIEW                        │
│                                       │                               │
│ Page preview                          │ Review checklist               │
│                                       │ ☑ Customer correct              │
│                                       │ ☑ Scope correct                 │
│                                       │ ☐ Pricing verified              │
│                                       │                               │
│                                       │ Comments                        │
│                                       │ [.........................]     │
│                                       │                               │
│                                       │ [Request Changes] [Approve]    │
└───────────────────────────────────────┴───────────────────────────────┘
```

Review decision is evidence and must be recorded.

------------------------------------------------------------------------

# 17. SCREEN 12 --- Approval Workspace

Approval is distinct from review.

``` text
APPROVAL

Document
DO-BIZ-2026-0047

Reviewed by
Technical Team

Review result
Approved

Approval context
Scope and commercial terms verified.

[Reject] [Approve]
```

Record:

-   approver
-   timestamp
-   version
-   decision
-   comments
-   workflow state

------------------------------------------------------------------------

# 18. SCREEN 13 --- Signature Workspace

``` text
SIGNATURE

DO-LEG-2026-0012

Service Agreement
Acme Ltd

SIGNATORIES

DailyOps.Tech
Authorized Signatory
● Pending

Acme Ltd
Authorized Representative
● Pending

Document status
Approved · Awaiting signature

[Open Document] [Send for Signature]
```

External signature integration may come later, but signature state and
evidence remain in DCS.

------------------------------------------------------------------------

# 19. SCREEN 14 --- Version History

``` text
VERSION HISTORY

DO-BIZ-2026-0047

v1.3   Current     01 Oct 2026   Steve
v1.2   Superseded  30 Sep 2026   Steve
v1.1   Superseded  29 Sep 2026   Sarah
v1.0   Superseded  28 Sep 2026   Steve

v1.3 changes:
- Scope expanded
- Amount updated
- Payment terms updated

[Compare with v1.2]
```

Rules:

-   previous versions remain immutable
-   no destructive overwrite
-   every version has author and timestamp
-   material changes can be compared

------------------------------------------------------------------------

# 20. SCREEN 15 --- Audit Trail

The audit trail is evidence, not a generic activity feed.

``` text
AUDIT TRAIL

DO-BIZ-2026-0047

01 Oct 09:24
Steve
Created version 1.3

01 Oct 09:31
Steve
Submitted for review

01 Oct 10:02
Sarah
Started review

01 Oct 10:17
Sarah
Requested clarification

01 Oct 10:42
Steve
Updated document

01 Oct 10:45
Steve
Submitted version 1.3 for review
```

Filters:

-   actor
-   action
-   date
-   version
-   state

Audit entries are immutable.

------------------------------------------------------------------------

# 21. SCREEN 16 --- Records

Records provide the structured business context required by document
operations.

### Categories

-   Customers
-   People
-   Employees
-   Projects
-   Services
-   Products
-   Transactions
-   Relationships

``` text
RECORDS

Customers 24 | Projects 12 | Services 18 | Products 6
Transactions 32 | Relationships 47

All | Customers | Projects | Services | Products
    | Transactions | Relationships

Search records...
Filters...

Name / Reference | Type | Status | Documents | Updated | Owner
```

Records are not intended to reproduce a full CRM.

------------------------------------------------------------------------

# 22. SCREEN 17 --- Customer Record

``` text
CUSTOMER RECORD

Acme Ltd
Customer ID: CUS-2025-0008
Status: Active

Overview | Documents | Projects | Transactions | Relationships

KEY INFORMATION

Legal name     Acme Ltd
Industry       Technology
Country        Cameroon
Account owner  Steve

RELATED DOCUMENTS

Proposal
Contract
Invoice
Service Report
Certificate

QUICK ACTIONS

[View Documents]
[Create Document]
[Add Note]
```

The customer record is a context hub.

------------------------------------------------------------------------

# 23. SCREEN 18 --- Employee Record

Employee records support document operations, not a complete HRIS.

``` text
EMPLOYEE

Employee Reference

Employment information

Role
Department
Manager
Start date
Status

DOCUMENTS

Employment Contract
Confidentiality Agreement
Leave Decision
Training Certificate
Performance Document

[Create Document]
```

Sensitive HR data requires stronger access control.

------------------------------------------------------------------------

# 24. SCREEN 19 --- Project Record

``` text
PROJECT

Infrastructure Assessment
PRJ-2026-0012

Customer
Acme Ltd

Status
In Progress

DOCUMENTS
Proposal
SOW
Contract
Reports
Invoice

SERVICES
Infrastructure Assessment

RELATIONSHIPS
Customer → Project → Contract → Documents → Transactions
```

------------------------------------------------------------------------

# 25. SCREEN 20 --- Transaction Record

Finance remains documentary.

``` text
TRANSACTION

TRX-2026-0047

Customer
Acme Ltd

Project
Infrastructure Assessment

Amount
4,500,000 XAF

Status
Invoice Issued

RELATED DOCUMENTS

Proposal
Contract
Invoice
Payment Evidence

Payment Terms
30 days
```

This record is not a general ledger entry.

------------------------------------------------------------------------

# 26. SCREEN 21 --- Relationship View

``` text
CUSTOMER
   │
   ▼
PROJECT
   │
   ▼
PROPOSAL
   │
   ▼
CONTRACT
   │
   ├──────────────► SERVICE
   │
   ▼
INVOICE
   │
   ▼
PAYMENT EVIDENCE
```

Purpose:

-   reconstruct business history
-   understand dependencies
-   navigate related documents
-   support audit and investigation

------------------------------------------------------------------------

# 27. SCREEN 22 --- Template Library

``` text
TEMPLATES

Official
Business
Legal / Formal
Certificate
HR
Finance

Search templates...

Template                    Version     Status
Business Proposal           v2.0        Active
Service Contract            v1.4        Active
Internship Certificate      v1.0        Active
Official Notice             v1.2        Active
Invoice                     v1.1        Active
```

### Template states

-   Draft
-   Review
-   Approved
-   Active
-   Retired

Only approved/active templates may be used for controlled issuance.

------------------------------------------------------------------------

# 28. SCREEN 23 --- Template Editor

The editor controls document structure rather than arbitrary visual
design.

``` text
TEMPLATE EDITOR

Service Proposal v2.0

┌────────────────┬────────────────────────────┬─────────────────────┐
│ STRUCTURE      │ PREVIEW                    │ FIELD / RULES       │
│ Cover          │                            │ Customer             │
│ Introduction   │                            │ Project              │
│ Scope          │                            │ Currency             │
│ Deliverables   │                            │ Pricing              │
│ Pricing        │                            │ Payment Terms        │
│ Terms          │                            │ Required: Yes        │
│ Signature      │                            │                     │
└────────────────┴────────────────────────────┴─────────────────────┘
```

Template rules include:

-   field definitions
-   required/optional state
-   conditional sections
-   default values
-   numbering
-   workflow
-   signature requirements
-   output format

------------------------------------------------------------------------

# 29. SCREEN 24 --- Template Version History

``` text
TEMPLATE HISTORY

Service Proposal

v2.0   Active
v1.9   Retired
v1.8   Retired
v1.7   Retired

v2.0 changes:
+ New payment section
+ Updated legal terms
+ New approval workflow

Used by
124 documents
```

Existing issued documents retain the template version used when
generated.

------------------------------------------------------------------------

# 30. SCREEN 25 --- Workflow Configuration

``` text
WORKFLOW CONFIGURATION

DOCUMENT TYPE
Business Proposal

LIFECYCLE

Draft
  ↓
Review
  ↓
Approval
  ↓
Signature
  ↓
Issued
  ↓
Archived

CONFIGURATION

Reviewer
Technical Lead

Approver
Managing Director

Signatory
Authorized Signatory

Expiry
30 days

Reminder
2 days before deadline
```

Workflows are configurable by document type.

------------------------------------------------------------------------

# 31. SCREEN 26 --- Roles & Permissions

Access and authority are separate.

``` text
ROLES

Author
Reviewer
Approver
Signatory
Issuer
Administrator
Auditor

PERMISSION MATRIX (editable)

                    View  Edit  Review  Approve  Sign  Issue  Admin
Author               ✓     ✓
Reviewer             ✓           ✓
Approver             ✓                    ✓
Signatory            ✓                           ✓
Issuer               ✓                                      ✓
Administrator        ✓     ✓      ✓       ✓      ✓     ✓      ✓
Auditor              ✓
```

Visibility never implies approval, signature or administration
authority.

### Editable authority model

In an enterprise context, several people manipulate different document
types at different levels of scale and criticality. The authority model
is therefore **configurable, not hard-coded**:

-   The permission matrix is **editable** by an Administrator. Each
    cell (role x action) can be toggled; tightening a cell is how the
    organization encodes separation of duties (e.g. removing `approve`
    from `reviewer` separates review and approval by construction).
-   Every change to the matrix is itself an audited event.

### Users and departments

Users are not just a flat list of accounts:

-   each user belongs to a **department** (Direction, Technique,
    Finance, RH, Juridique, Opérations...);
-   an Administrator can edit a user's role and department at any
    time, and activate/deactivate accounts;
-   a user can never change their own role or activation state;
-   department membership is the foundation for future scoping rules
    (e.g. a Finance approver validates financial documents, an HR
    reviewer only sees HR-domain documents).

The workflow defines which steps exist; the matrix defines who holds
the authority; the department defines the organizational scope.

------------------------------------------------------------------------

# 32. SCREEN 27 --- Document Numbering

``` text
DOCUMENT NUMBERING

Business
DO-BIZ-{YEAR}-{SEQUENCE}

Legal
DO-LEG-{YEAR}-{SEQUENCE}

Official
DO-OFF-{YEAR}-{SEQUENCE}

Certificate
DO-CER-{YEAR}-{SEQUENCE}

HR
DO-HR-{YEAR}-{SEQUENCE}

Finance
DO-FIN-{YEAR}-{SEQUENCE}

Current sequence
Business: 0047
Legal: 0012
Official: 0031
Certificate: 0019
```

Number generation must be centralized and collision-safe.

------------------------------------------------------------------------

# 33. SCREEN 28 --- Document Type Configuration

``` text
DOCUMENT TYPE

Business Proposal

IDENTITY
Reference prefix: DO-BIZ

REQUIRED DATA
Customer
Project
Scope
Pricing
Validity

WORKFLOW
Review → Approval → Signature → Issue

OUTPUT
PDF

SIGNATURE
Required

EXPIRY
30 days

RETENTION
7 years
```

This configuration connects schema, template and workflow.

------------------------------------------------------------------------

# 34. SCREEN 29 --- Retention & Archival

``` text
RETENTION

DOCUMENT DOMAIN

Official
Retention: 7 years

Legal
Retention: Contract + 7 years

Finance
Retention: According to applicable policy

Certificate
Retention: Permanent

HR
Retention: Controlled policy

ACTIONS

Archive
Supersede
Revoke
Restore where permitted
```

Retention rules must be configurable and auditable.

------------------------------------------------------------------------

# 35. SCREEN 30 --- System Activity

``` text
SYSTEM ACTIVITY

Date        Actor       Event                         Object

01 Oct      Steve       Created document              DO-BIZ...
01 Oct      Sarah       Reviewed document             DO-BIZ...
01 Oct      Admin       Activated template            TMP-BIZ...
30 Sep      Steve       Generated invoice              DO-FIN...
```

This is broader than an individual document audit trail.

------------------------------------------------------------------------

# 36. Core Interaction Patterns

## Create

``` text
Create Document
      ↓
Select Domain
      ↓
Select Type
      ↓
Select / Load Template
      ↓
Populate Structured Data
      ↓
Validate
      ↓
Generate Draft
```

## Review

``` text
Inbox
 ↓
Open Document
 ↓
Review Workspace
 ↓
Approve
      OR
Request Changes
```

## Approval

``` text
Inbox
 ↓
Approval Task
 ↓
Review Decision Context
 ↓
Approve
      OR
Reject
```

## Signature

``` text
Approved
 ↓
Signature Request
 ↓
Signer
 ↓
Signed
 ↓
Issue
```

## Expiry

``` text
Active
 ↓
Expiry threshold reached
 ↓
Inbox notification
 ↓
Renew / Replace / Close
```

------------------------------------------------------------------------

# 37. Document Status Model

The UI must distinguish lifecycle status from action status.

### Lifecycle

``` text
Draft
Review
Approved
Signature
Issued
Active
Expired
Superseded
Revoked
Archived
```

### Action

``` text
No Action
Review Required
Approval Required
Signature Required
Correction Required
Exception
```

Examples:

``` text
Lifecycle: Active
Action: No Action
```

or:

``` text
Lifecycle: Review
Action: Review Required
```

This distinction is fundamental to the Inbox.

------------------------------------------------------------------------

# 38. Document Detail Information Hierarchy

Every document workspace prioritizes:

1.  Identity
2.  Current status
3.  Required action
4.  Version
5.  Document content
6.  Business context
7.  Workflow
8.  History
9.  Evidence
10. Related documents

Do not bury the current action below analytics.

------------------------------------------------------------------------

# 39. Mobile / Responsive Strategy

Desktop is the first implementation target because the product is
information-heavy.

Mobile prioritizes:

-   Inbox
-   document status
-   review
-   approval
-   signature
-   notifications
-   quick lookup

Mobile does not attempt to reproduce the complete desktop Builder.

------------------------------------------------------------------------

# 40. Empty States

Example:

``` text
NO DOCUMENTS REQUIRE YOUR REVIEW

Everything is up to date.

[View Documents]
```

Avoid generic:

``` text
No data.
```

------------------------------------------------------------------------

# 41. Error States

Errors must identify:

-   what failed
-   whether data was saved
-   what the user can do
-   whether the workflow was affected

Example:

``` text
DOCUMENT COULD NOT BE GENERATED

The document data was saved, but PDF generation failed.

Reference:
DO-BIZ-2026-0047

[Retry Generation] [Return to Document]
```

------------------------------------------------------------------------

# 42. Permission States

If a user can view but not act:

``` text
APPROVAL REQUIRED

You can view this document, but you are not
authorized to approve it.

Assigned approver:
Managing Director
```

Do not hide information merely because the user cannot execute the next
action.

------------------------------------------------------------------------

# 43. Global Search

Search behaves as a command surface.

``` text
SEARCH

DO-BIZ-2026-0047

Documents
  Proposal — Acme Ltd

Records
  Acme Ltd

Projects
  Infrastructure Assessment

Templates
  Business Proposal
```

Target: one or two interactions to reach the relevant object.

------------------------------------------------------------------------

# 44. Notification Model

Notifications are subordinate to Inbox.

> Notifications inform. Inbox drives action.

Example notification:

``` text
Proposal DO-BIZ-2026-0047 requires review.
```

Inbox representation:

``` text
Proposal DO-BIZ-2026-0047
Review required
Due today
Scope changed in v1.3

[Start Review]
```

------------------------------------------------------------------------

# 45. Bulk Operations

Safe bulk operations may include:

-   archive
-   assign
-   export
-   metadata changes

Bulk approval or signature should not be enabled unless explicitly
supported by the authority model.

------------------------------------------------------------------------

# 46. Permission-Aware UI

Example for Reviewer:

``` text
[Open]
[Review]
[Request Changes]
```

No:

``` text
[Approve]
[Sign]
```

Approver:

``` text
[Open]
[Review]
[Approve]
[Reject]
```

Administrator:

``` text
[Open]
[Edit]
[Configure]
```

------------------------------------------------------------------------

# 47. First Implementation Slice

Do not code all 30 screens initially.

Build first:

1.  Application Shell
2.  Overview
3.  Inbox
4.  Documents
5.  Document Workspace
6.  Create Document
7.  Document Builder
8.  Review
9.  Approval
10. Template Library

This proves the central loop:

``` text
Create
  ↓
Document
  ↓
Inbox
  ↓
Review
  ↓
Approval
  ↓
Controlled Record
```

------------------------------------------------------------------------

# 48. Prototype Test Scenario

Use one complete scenario:

``` text
Create Document
        ↓
Business
        ↓
Proposal
        ↓
Select Customer
        ↓
Select Project
        ↓
Populate scope and price
        ↓
Generate v1.0
        ↓
Submit Review
        ↓
Reviewer receives Inbox item
        ↓
Reviewer approves
        ↓
Approver receives Inbox item
        ↓
Approver approves
        ↓
Document becomes ready for signature
```

The prototype should prove that DCS removes manual document operations,
not merely prove that the interface looks good.

------------------------------------------------------------------------

# 49. Wireframe Acceptance Criteria

The wireframes are coherent when:

-   the user always knows where they are
-   the user always knows what requires action
-   documents are distinct from records
-   workflow state is visible
-   authority is explicit
-   version history is accessible
-   audit evidence is reconstructable
-   related documents are discoverable
-   templates are controlled
-   document creation does not require manual formatting
-   finance remains documentary rather than becoming accounting
-   records do not become a hidden CRM
-   Inbox is operational rather than a notification list
-   interface remains visually restrained

------------------------------------------------------------------------

# 50. Final Navigation Model

``` text
DAILYOPS DCS

├── Overview
│
├── Inbox
│   ├── All
│   ├── To Review
│   ├── To Approve
│   ├── To Sign
│   ├── Expiring
│   ├── Exceptions
│   └── Completed
│
├── Documents
│   ├── All Documents
│   ├── Official
│   ├── Business
│   ├── Legal / Formal
│   ├── Certificate
│   ├── HR
│   └── Finance
│
├── Records
│   ├── Customers
│   ├── People
│   ├── Employees
│   ├── Projects
│   ├── Services
│   ├── Products
│   ├── Transactions
│   └── Relationships
│
├── Templates
│   ├── Library
│   ├── Drafts
│   ├── Active
│   └── Retired
│
└── Administration
    ├── Document Types
    ├── Workflows
    ├── Numbering
    ├── Roles & Permissions
    ├── Retention
    └── System Activity
```

------------------------------------------------------------------------

# 51. Design Direction

The DCS should deliberately differ from a typical modern SaaS dashboard.

Premium comes from:

``` text
TYPOGRAPHY
     +
WHITESPACE
     +
STRUCTURE
     +
PRECISION
     +
RESTRAINT
```

Not from:

``` text
COLOR
+
GRADIENT
+
CARDS
+
ICONS
+
DECORATION
```

The DailyOps brand should remain visible but restrained. The application
should feel like a serious **document-control instrument**, not a
marketing interface.

The `>_` motif can appear subtly in the shell, empty states or system
moments, while the full DailyOps.Tech identity remains controlled.

------------------------------------------------------------------------

# 52. Product Principle

> **The user manages the decision.\
> The system manages the document mechanics.**

Every wireframe and every future interaction should be evaluated against
this principle.

If an interaction makes the user manually perform work the system
already has enough information to perform deterministically, that
interaction should be reconsidered.
